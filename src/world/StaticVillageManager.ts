import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import villageBlueprintData from '../assets/props/village_blueprints.json';

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

type ModuleTemplate = {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
};

type StaticVillageChunkRuntime = {
    id: string;
    root: THREE.Group;
    colliderBodies: RAPIER.RigidBody[];
};

const BLUEPRINT = villageBlueprintData as StaticVillageBlueprint;

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
            this.chunks.push(this.buildChunk(chunk));
        }
    }

    buildChunk(chunk: StaticVillageChunkDef) {
        const root = new THREE.Group();
        root.name = `static-village-${chunk.id}`;
        this.scene.add(root);

        const moduleLibrary = this.createFallbackModuleLibrary(chunk.moduleNames);
        const matricesByModule = new Map<string, THREE.Matrix4[]>();
        const colliderBodies: RAPIER.RigidBody[] = [];

        for (const moduleName of chunk.moduleNames) {
            matricesByModule.set(moduleName, []);
        }

        for (const building of chunk.buildings) {
            const buildingRotation = (building.rotationSteps ?? 0) * (Math.PI / 2);
            const buildingBaseX = chunk.origin[0] + building.origin[0];
            const buildingBaseZ = chunk.origin[1] + building.origin[1];
            const buildingBaseY = this.heightAt(buildingBaseX, buildingBaseZ);
            const buildingBase = new THREE.Vector3(buildingBaseX, buildingBaseY, buildingBaseZ);

            for (const [moduleIndex, x, y, z, rotationSteps] of building.modules) {
                const moduleName = chunk.moduleNames[moduleIndex];
                const piecePos = new THREE.Vector3(x, y, z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, buildingRotation);
                piecePos.add(buildingBase);

                const totalRotation = buildingRotation + rotationSteps * (Math.PI / 2);
                const matrix = new THREE.Matrix4().compose(
                    piecePos,
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, totalRotation, 0)),
                    new THREE.Vector3(1, 1, 1)
                );

                matricesByModule.get(moduleName)?.push(matrix);
            }

            colliderBodies.push(this.createBuildingCollider(building, buildingBase, buildingRotation));
        }

        for (const moduleName of chunk.moduleNames) {
            const matrices = matricesByModule.get(moduleName) ?? [];
            if (matrices.length === 0) continue;

            const template = moduleLibrary.get(moduleName);
            if (!template) continue;

            const instanced = new THREE.InstancedMesh(template.geometry, template.material, matrices.length);
            instanced.name = `${chunk.id}:${moduleName}`;
            instanced.castShadow = true;
            instanced.receiveShadow = true;
            matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix));
            instanced.instanceMatrix.needsUpdate = true;
            root.add(instanced);
            this.collisionMeshes.push(instanced);
        }

        return {
            id: chunk.id,
            root,
            colliderBodies
        };
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

    createFallbackModuleLibrary(moduleNames: string[]) {
        const library = new Map<string, ModuleTemplate>();
        for (const moduleName of moduleNames) {
            library.set(moduleName, this.createFallbackModule(moduleName));
        }
        return library;
    }

    createFallbackModule(moduleName: string): ModuleTemplate {
        switch (moduleName) {
            case 'Foundation':
                return {
                    geometry: new THREE.BoxGeometry(2.05, 0.6, 2.05).translate(0, 0.3, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0x7b756b, roughness: 1 })
                };
            case 'Wall_Window':
                return {
                    geometry: new THREE.BoxGeometry(2.04, 2.45, 0.22).translate(0, 1.225, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0xd0c0a6, roughness: 1 })
                };
            case 'Wall_Door':
                return {
                    geometry: new THREE.BoxGeometry(2.04, 2.2, 0.22).translate(0, 1.1, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0x6a4c34, roughness: 1 })
                };
            case 'Corner_Brick':
                return {
                    geometry: new THREE.BoxGeometry(0.34, 3.0, 0.34).translate(0, 1.5, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0x876d55, roughness: 1 })
                };
            case 'Roof_Left': {
                const geometry = new THREE.BoxGeometry(3.6, 0.18, 6.6);
                geometry.rotateZ(-0.62);
                geometry.translate(0, 1.05, 0);
                return {
                    geometry,
                    material: new THREE.MeshStandardMaterial({ color: 0xa6533a, roughness: 0.95 })
                };
            }
            case 'Roof_Right': {
                const geometry = new THREE.BoxGeometry(3.6, 0.18, 6.6);
                geometry.rotateZ(0.62);
                geometry.translate(0, 1.05, 0);
                return {
                    geometry,
                    material: new THREE.MeshStandardMaterial({ color: 0xa6533a, roughness: 0.95 })
                };
            }
            case 'Roof_Gable':
                return {
                    geometry: new THREE.BoxGeometry(6.1, 1.9, 0.18).translate(0, 0.95, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0xc9b79a, roughness: 1 })
                };
            case 'Chimney':
                return {
                    geometry: new THREE.BoxGeometry(0.44, 1.4, 0.44).translate(0, 0.7, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0x6e655d, roughness: 1 })
                };
            case 'Wall_Straight':
            default:
                return {
                    geometry: new THREE.BoxGeometry(2.04, 2.8, 0.22).translate(0, 1.4, 0),
                    material: new THREE.MeshStandardMaterial({ color: 0xe0d0b4, roughness: 1 })
                };
        }
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    reset() {
        return;
    }
}
