import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import villageBlueprintData from '../assets/props/village_blueprints.json';
import villageModuleManifestData from '../assets/props/village_modules.json';
import villageModulesUrl from '../assets/props/VillageStatic_House_A_mobile.glb?url';
import { createGltfLoader } from './gltfLoader';

type StaticVillageModulePlacement = [number, number, number, number, number];

type StaticVillageColliderDef = {
    type: 'box';
    size: [number, number, number];
    offset: [number, number, number];
};

type StaticVillageBuildingDef = {
    id: string;
    origin: [number, number];
    rotationSteps?: number;
    modules: StaticVillageModulePlacement[];
    collider: StaticVillageColliderDef;
};

type StaticVillageChunkDef = {
    id: string;
    origin: [number, number];
    moduleNames: string[];
    buildings: StaticVillageBuildingDef[];
};

type StaticVillageBlueprint = {
    schemaVersion: number;
    layoutVersion: string;
    assetPackVersion: string;
    chunks: StaticVillageChunkDef[];
};

type StaticVillageModuleDef = {
    id: string;
    kind: 'prefab';
    nodeName: string;
    placementOffset?: [number, number, number];
};

type StaticVillageModuleManifest = {
    schemaVersion: number;
    assetPackVersion: string;
    libraryKind: 'prefab_glb';
    modules: StaticVillageModuleDef[];
};

type PrefabModuleTemplate = {
    root: THREE.Object3D;
    placementOffset: THREE.Vector3;
};

type StaticVillageChunkRuntime = {
    id: string;
    definition: StaticVillageChunkDef;
    root: THREE.Group;
    colliderBodies: RAPIER.RigidBody[];
};

const BLUEPRINT = villageBlueprintData as StaticVillageBlueprint;
const MODULE_MANIFEST = villageModuleManifestData as StaticVillageModuleManifest;
const villageLoader = createGltfLoader();
const authoredModuleLibraryPromise = villageLoader.loadAsync(villageModulesUrl).then((gltf) => {
    const manifestById = new Map(MODULE_MANIFEST.modules.map((moduleDef) => [moduleDef.id, moduleDef]));
    const library = new Map<string, PrefabModuleTemplate>();
    const lookup = new Map<string, THREE.Object3D>();

    gltf.scene.traverse((object) => {
        lookup.set(object.name, object);
    });

    for (const [moduleId, moduleDef] of manifestById) {
        const root = lookup.get(moduleDef.nodeName);
        if (!root) {
            console.warn(`StaticVillageManager: module node "${moduleDef.nodeName}" not found in static village asset.`);
            continue;
        }
        library.set(moduleId, {
            root,
            placementOffset: new THREE.Vector3(...(moduleDef.placementOffset ?? [0, 0, 0]))
        });
    }

    return library;
});

export class StaticVillageManager {
    collisionMeshes: THREE.Mesh[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    heightAt: (x: number, z: number) => number;
    chunks: StaticVillageChunkRuntime[] = [];

    constructor(scene: THREE.Scene, physics: RAPIER.World, heightAt?: (x: number, z: number) => number) {
        this.scene = scene;
        this.physics = physics;
        this.heightAt = heightAt ?? (() => 0);
        this.buildVillage();
    }

    buildVillage() {
        for (const chunk of BLUEPRINT.chunks) {
            this.chunks.push(this.createChunkRuntime(chunk));
        }

        void this.populateVisuals();
    }

    createChunkRuntime(chunk: StaticVillageChunkDef) {
        const root = new THREE.Group();
        root.name = `static-village-${chunk.id}`;
        this.scene.add(root);

        const colliderBodies: RAPIER.RigidBody[] = [];
        for (const building of chunk.buildings) {
            const buildingRotation = (building.rotationSteps ?? 0) * (Math.PI / 2);
            const buildingBaseX = chunk.origin[0] + building.origin[0];
            const buildingBaseZ = chunk.origin[1] + building.origin[1];
            const buildingBaseY = this.heightAt(buildingBaseX, buildingBaseZ);
            const buildingBase = new THREE.Vector3(buildingBaseX, buildingBaseY, buildingBaseZ);
            colliderBodies.push(this.createBuildingCollider(building, buildingBase, buildingRotation));
        }

        return {
            id: chunk.id,
            definition: chunk,
            root,
            colliderBodies
        };
    }

    async populateVisuals() {
        try {
            const moduleLibrary = await authoredModuleLibraryPromise;
            this.rebuildChunkVisuals(moduleLibrary);
        } catch (error) {
            console.warn('StaticVillageManager: failed to load authored village modules, using fallback prefabs instead.', error);
            this.rebuildChunkVisuals(this.createFallbackModuleLibrary());
        }
    }

    rebuildChunkVisuals(moduleLibrary: Map<string, PrefabModuleTemplate>) {
        this.collisionMeshes = [];

        for (const chunkRuntime of this.chunks) {
            chunkRuntime.root.clear();
            this.populateChunk(chunkRuntime, moduleLibrary);
        }
    }

    populateChunk(chunkRuntime: StaticVillageChunkRuntime, moduleLibrary: Map<string, PrefabModuleTemplate>) {
        const chunk = chunkRuntime.definition;

        for (const building of chunk.buildings) {
            const buildingRotation = (building.rotationSteps ?? 0) * (Math.PI / 2);
            const buildingBaseX = chunk.origin[0] + building.origin[0];
            const buildingBaseZ = chunk.origin[1] + building.origin[1];
            const buildingBaseY = this.heightAt(buildingBaseX, buildingBaseZ);
            const buildingBase = new THREE.Vector3(buildingBaseX, buildingBaseY, buildingBaseZ);

            for (const [moduleIndex, x, y, z, rotationSteps] of building.modules) {
                const moduleId = chunk.moduleNames[moduleIndex];
                const template = moduleLibrary.get(moduleId);
                if (!template) continue;

                const localPosition = new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, buildingRotation);
                const totalRotation = buildingRotation + rotationSteps * (Math.PI / 2);
                const placementOffset = template.placementOffset.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalRotation);

                const instance = template.root.clone(true);
                instance.position.copy(buildingBase).add(localPosition).add(placementOffset);
                instance.rotation.y = totalRotation;
                instance.name = `${building.id}:${moduleId}`;
                chunkRuntime.root.add(instance);

                instance.traverse((object) => {
                    if (!(object instanceof THREE.Mesh)) return;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    this.collisionMeshes.push(object);
                });
            }
        }
    }

    createBuildingCollider(building: StaticVillageBuildingDef, buildingBase: THREE.Vector3, buildingRotation: number) {
        const offset = new THREE.Vector3(...building.collider.offset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, buildingRotation);
        const center = buildingBase.clone().add(offset);
        const rotation = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, buildingRotation);
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(center.x, center.y, center.z)
            .setRotation({
                x: rotation.x,
                y: rotation.y,
                z: rotation.z,
                w: rotation.w
            });
        const body = this.physics.createRigidBody(bodyDesc);
        const halfSize = building.collider.size.map((value) => value * 0.5) as [number, number, number];
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize[0], halfSize[1], halfSize[2]);
        this.physics.createCollider(colliderDesc, body);
        return body;
    }

    createFallbackModuleLibrary() {
        const library = new Map<string, PrefabModuleTemplate>();
        const moduleIds = new Set(BLUEPRINT.chunks.flatMap((chunk) => chunk.moduleNames));
        for (const moduleId of moduleIds) {
            library.set(moduleId, this.createFallbackPrefab(moduleId));
        }
        return library;
    }

    createFallbackPrefab(moduleId: string): PrefabModuleTemplate {
        const root = new THREE.Group();
        root.name = moduleId;

        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xd7ccb7, roughness: 0.96 });
        const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5b45, roughness: 0.92 });
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xa6563d, roughness: 0.9 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(7.4, 6.2, 7.8), wallMaterial);
        body.position.y = 3.1;
        root.add(body);

        const frameA = new THREE.Mesh(new THREE.BoxGeometry(0.26, 6.6, 0.26), trimMaterial);
        frameA.position.set(-3.55, 3.3, -3.75);
        root.add(frameA);
        const frameB = frameA.clone();
        frameB.position.set(3.55, 3.3, -3.75);
        root.add(frameB);
        const frameC = frameA.clone();
        frameC.position.set(-3.55, 3.3, 3.75);
        root.add(frameC);
        const frameD = frameA.clone();
        frameD.position.set(3.55, 3.3, 3.75);
        root.add(frameD);

        const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.24, 8.8), roofMaterial);
        roofLeft.position.set(-1.15, 6.65, 0);
        roofLeft.rotation.z = -0.62;
        root.add(roofLeft);

        const roofRight = roofLeft.clone();
        roofRight.position.x = 1.15;
        roofRight.rotation.z = 0.62;
        root.add(roofRight);

        return {
            root,
            placementOffset: new THREE.Vector3()
        };
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    reset() {
        return;
    }
}
