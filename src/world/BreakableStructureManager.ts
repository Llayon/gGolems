import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import sectionedHouseUrl from '../assets/props/VillagePrefab_House_A_breakable_web.glb?url';
import staticHouseUrl from '../assets/props/VillageStatic_House_A_mobile.glb?url';
import brickBaseUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_Brick_BaseColor.png?url';
import brickNormalUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_Brick_Normal.png?url';
import plasterBaseUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_Plaster_BaseColor.png?url';
import plasterNormalUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_Plaster_Normal.png?url';
import roundTilesBaseUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_RoundTiles_BaseColor.png?url';
import roundTilesNormalUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_RoundTiles_Normal.png?url';
import unevenBrickBaseUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_UnevenBrick_BaseColor.png?url';
import unevenBrickNormalUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_UnevenBrick_Normal.png?url';
import woodTrimBaseUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_WoodTrim_BaseColor.png?url';
import woodTrimNormalUrl from '../../Medieval Village MegaKit[Standard]/glTF/T_WoodTrim_Normal.png?url';
import {
    FallingSection,
    HouseProp,
    HouseSectionHit,
    HouseSectionProp,
    HouseSnapshot,
    PropFxEvent,
    BREAKABLE_HOUSE_LAYOUT,
    HOUSE_COLLAPSIBLE_SECTION_IDS,
    collectMeshes,
    markShadows
} from './propShared';
import { createGltfLoader } from './gltfLoader';

const houseLoader = createGltfLoader();
const houseTextureLoader = new THREE.TextureLoader();
let housePrefabTemplatePromise: Promise<THREE.Group> | null = null;
let houseProxyTemplatePromise: Promise<THREE.Group> | null = null;
let sectionedHouseMaterialLibraryPromise: Promise<Map<string, THREE.Material>> | null = null;
const BREAKABLE_PROXY_ACTIVATION_RADIUS = 0;
const USE_BREAKABLE_HOUSE_PROXIES = true;

type HouseProxy = {
    root: THREE.Group;
    meshes: THREE.Mesh[];
    body: RAPIER.RigidBody | null;
    collisionEntries: THREE.Mesh[];
};

function loadSectionedHouseTemplate() {
    if (!housePrefabTemplatePromise) {
        housePrefabTemplatePromise = houseLoader.loadAsync(sectionedHouseUrl).then((gltf) => {
            gltf.scene.updateMatrixWorld(true);
            return gltf.scene as THREE.Group;
        });
    }
    return housePrefabTemplatePromise;
}

function loadHouseProxyTemplate() {
    if (!houseProxyTemplatePromise) {
        houseProxyTemplatePromise = houseLoader.loadAsync(staticHouseUrl).then((gltf) => {
            gltf.scene.updateMatrixWorld(true);
            return gltf.scene as THREE.Group;
        });
    }
    return houseProxyTemplatePromise;
}

function loadHouseTexture(url: string, color = false) {
    return houseTextureLoader.loadAsync(url).then((texture) => {
        texture.flipY = false;
        if (color) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }
        texture.needsUpdate = true;
        return texture;
    });
}

function loadSectionedHouseMaterialLibrary() {
    if (!sectionedHouseMaterialLibraryPromise) {
        sectionedHouseMaterialLibraryPromise = Promise.all([
            loadHouseTexture(plasterBaseUrl, true),
            loadHouseTexture(plasterNormalUrl),
            loadHouseTexture(woodTrimBaseUrl, true),
            loadHouseTexture(woodTrimNormalUrl),
            loadHouseTexture(roundTilesBaseUrl, true),
            loadHouseTexture(roundTilesNormalUrl),
            loadHouseTexture(unevenBrickBaseUrl, true),
            loadHouseTexture(unevenBrickNormalUrl),
            loadHouseTexture(brickBaseUrl, true),
            loadHouseTexture(brickNormalUrl)
        ]).then(([
            plasterBase,
            plasterNormal,
            woodBase,
            woodNormal,
            roofBase,
            roofNormal,
            stoneBase,
            stoneNormal,
            brickBase,
            brickNormal
        ]) => {
            const materialLibrary = new Map<string, THREE.Material>();
            materialLibrary.set('BH_Plaster', new THREE.MeshStandardMaterial({
                name: 'BH_Plaster_Textured',
                map: plasterBase,
                normalMap: plasterNormal,
                roughness: 0.98,
                metalness: 0
            }));
            materialLibrary.set('BH_Wood', new THREE.MeshStandardMaterial({
                name: 'BH_Wood_Textured',
                map: woodBase,
                normalMap: woodNormal,
                roughness: 0.92,
                metalness: 0
            }));
            materialLibrary.set('BH_Roof', new THREE.MeshStandardMaterial({
                name: 'BH_Roof_Textured',
                map: roofBase,
                normalMap: roofNormal,
                roughness: 0.9,
                metalness: 0
            }));
            materialLibrary.set('BH_Stone', new THREE.MeshStandardMaterial({
                name: 'BH_Stone_Textured',
                map: stoneBase,
                normalMap: stoneNormal,
                roughness: 1,
                metalness: 0
            }));
            materialLibrary.set('BH_Brick', new THREE.MeshStandardMaterial({
                name: 'BH_Brick_Textured',
                map: brickBase,
                normalMap: brickNormal,
                roughness: 0.96,
                metalness: 0
            }));
            materialLibrary.set('BH_Window', new THREE.MeshStandardMaterial({
                name: 'BH_Window_Textured',
                color: 0x1f2530,
                roughness: 0.2,
                metalness: 0,
                transparent: true,
                opacity: 0.82
            }));
            return materialLibrary;
        });
    }

    return sectionedHouseMaterialLibraryPromise;
}

function applySectionedHouseMaterials(root: THREE.Object3D, materialLibrary: Map<string, THREE.Material>) {
    root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;

        if (Array.isArray(node.material)) {
            node.material = node.material.map((material) => materialLibrary.get(material.name) ?? material);
            return;
        }

        node.material = materialLibrary.get(node.material.name) ?? node.material;
    });
}

export class BreakableStructureManager {
    collisionMeshes: THREE.Mesh[] = [];
    houses: HouseProp[] = [];
    houseByObjectId = new Map<number, HouseProp>();
    houseSectionByObjectId = new Map<number, HouseSectionHit>();
    houseProxyByObjectId = new Map<number, HouseProp>();
    houseProxyState = new Map<string, HouseProxy>();
    fxEvents: PropFxEvent[] = [];
    scene: THREE.Scene;
    physics: RAPIER.World;
    heightAt: (x: number, z: number) => number;
    pendingHouseSnapshots: HouseSnapshot[] | null = null;
    fallingSections: FallingSection[] = [];

    constructor(scene: THREE.Scene, physics: RAPIER.World, heightAt?: (x: number, z: number) => number) {
        this.scene = scene;
        this.physics = physics;
        this.heightAt = heightAt ?? (() => 0);
        void this.addHouses();
    }

    async addHouses() {
        try {
            const [template, proxyTemplate] = await Promise.all([
                loadSectionedHouseTemplate(),
                loadHouseProxyTemplate(),
                loadSectionedHouseMaterialLibrary()
            ]);
            applySectionedHouseMaterials(template, await loadSectionedHouseMaterialLibrary());
            this.addSectionedHouses(template, proxyTemplate);
            if (this.pendingHouseSnapshots) {
                this.applySnapshot(this.pendingHouseSnapshots);
                this.pendingHouseSnapshots = null;
            }
        } catch (error) {
            console.warn('Failed to load sectioned village house prefab. Falling back to procedural houses.', error);
            this.addProceduralHouses();
            if (this.pendingHouseSnapshots) {
                this.applySnapshot(this.pendingHouseSnapshots);
                this.pendingHouseSnapshots = null;
            }
        }
    }

    addProceduralHouses() {
        BREAKABLE_HOUSE_LAYOUT.forEach((layout, index) => {
            const root = new THREE.Group();
            root.position.set(layout.x, this.heightAt(layout.x, layout.z), layout.z);
            root.rotation.y = layout.rot ?? 0;
            this.scene.add(root);

            const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x7d1c18, roughness: 0.9 });
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 1 });
            const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x655648, roughness: 1 });

            const intact = new THREE.Group();
            const intactWalls = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 3.1), wallMat);
            intactWalls.position.y = 1.6;
            intact.add(intactWalls);

            const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.45, 0.14), trimMat);
            door.position.set(0, 0.72, -1.58);
            intact.add(door);

            const windowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.12), trimMat.clone());
            windowLeft.position.set(-0.9, 1.7, -1.6);
            intact.add(windowLeft);

            const windowRight = windowLeft.clone();
            windowRight.position.x = 0.9;
            intact.add(windowRight);

            const intactRoof = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.9, 4), roofMat);
            intactRoof.position.y = 4.15;
            intactRoof.rotation.y = Math.PI / 4;
            intact.add(intactRoof);

            const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), trimMat);
            chimney.position.set(0.55, 4.4, 0.28);
            intact.add(chimney);

            const damaged = new THREE.Group();
            const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.75, 0.34), wallMat.clone());
            backWall.position.set(0, 1.35, 1.26);
            damaged.add(backWall);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.7, 2.55), wallMat.clone());
            leftWall.position.set(-1.48, 1.35, 0.02);
            damaged.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.4, 2.15), wallMat.clone());
            rightWall.position.set(1.48, 1.2, -0.18);
            damaged.add(rightWall);

            const frontStubLeft = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.8, 0.34), wallMat.clone());
            frontStubLeft.position.set(-0.95, 0.9, -1.28);
            damaged.add(frontStubLeft);

            const frontStubRight = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.34), wallMat.clone());
            frontStubRight.position.set(1.05, 0.55, -1.28);
            damaged.add(frontStubRight);

            const damagedRoof = new THREE.Mesh(new THREE.ConeGeometry(2.25, 1.35, 4), roofMat.clone());
            damagedRoof.position.set(0.4, 3.15, 0.2);
            damagedRoof.rotation.set(0.36, Math.PI / 4 + 0.18, -0.2);
            damaged.add(damagedRoof);

            const beam = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.16, 0.16), trimMat.clone());
            beam.position.set(-0.35, 2.15, -0.65);
            beam.rotation.z = -0.42;
            damaged.add(beam);

            damaged.visible = false;
            root.add(intact, damaged);

            const rubble = new THREE.Group();
            const rubbleBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 2.8), rubbleMat);
            rubbleBase.position.set(0, 0.45, 0);
            rubble.add(rubbleBase);

            const roofChunk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.34, 1.4), roofMat.clone());
            roofChunk.position.set(-0.6, 0.95, 0.25);
            roofChunk.rotation.set(0.2, 0.4, -0.22);
            rubble.add(roofChunk);

            const wallChunk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.2, 0.42), wallMat.clone());
            wallChunk.position.set(0.85, 0.62, -0.5);
            wallChunk.rotation.set(0, -0.3, 0.2);
            rubble.add(wallChunk);

            const spar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.16), trimMat.clone());
            spar.position.set(0.15, 0.86, 0.85);
            spar.rotation.set(0.22, 0.55, -0.4);
            rubble.add(spar);

            rubble.visible = false;
            root.add(rubble);

            markShadows(root);

            const house: HouseProp = {
                id: `house-${index}`,
                root,
                active: true,
                intact,
                damaged,
                rubble,
                body: this.createHouseBody(root.position, layout.rot ?? 0),
                hp: 60,
                maxHp: 60,
                stage: 0,
                collisionEntries: [],
                position: root.position.clone(),
                prefabKind: 'procedural',
                sections: [],
                sectionById: new Map(),
                loaded: true
            };

            for (const mesh of [...collectMeshes(intact), ...collectMeshes(damaged)]) {
                this.houseByObjectId.set(mesh.id, house);
            }

            this.setHouseStage(house, 0);
            this.houses.push(house);
            this.registerHouseProxy(house);
            if (USE_BREAKABLE_HOUSE_PROXIES) {
                this.deactivateHouse(house);
            }
        });
    }

    addSectionedHouses(template: THREE.Group, proxyTemplate?: THREE.Group) {
        BREAKABLE_HOUSE_LAYOUT.forEach((layout, index) => {
            const root = template.clone(true);
            root.name = `village-house-${index}`;
            root.position.set(layout.x, this.heightAt(layout.x, layout.z), layout.z);
            root.rotation.y = layout.rot ?? 0;
            this.scene.add(root);
            root.updateMatrixWorld(true);
            markShadows(root);

            const house: HouseProp = {
                id: `house-${index}`,
                root,
                active: true,
                body: null,
                hp: 0,
                maxHp: 0,
                stage: 0,
                collisionEntries: [],
                position: root.position.clone(),
                prefabKind: 'sectioned',
                sections: [],
                sectionById: new Map(),
                loaded: true
            };

            root.traverse((node) => {
                const userData = node.userData ?? {};
                const sectionId = typeof userData.section_id === 'string'
                    ? userData.section_id
                    : (node.name.startsWith('SEC_') ? node.name : null);
                if (!sectionId || house.sectionById.has(sectionId)) return;

                const meshes = collectMeshes(node);
                if (meshes.length === 0) return;

                const sectionType = typeof userData.section_type === 'string'
                    ? userData.section_type
                    : this.inferSectionType(sectionId);
                const maxHp = Math.max(1, Number(userData.hp ?? this.defaultSectionHp(sectionId, sectionType)));
                const destructible = userData.destructible !== false;
                const position = node.getWorldPosition(new THREE.Vector3());
                const section: HouseSectionProp = {
                    id: sectionId,
                    root: node,
                    meshes,
                    body: null,
                    hp: maxHp,
                    maxHp,
                    destroyed: false,
                    destructible,
                    sectionType,
                    position,
                    collisionEntries: []
                };

                section.collisionEntries = this.shouldSectionBlockShots(section)
                    ? [...meshes]
                    : [];
                if (section.collisionEntries.length > 0) {
                    this.collisionMeshes.push(...section.collisionEntries);
                    house.collisionEntries.push(...section.collisionEntries);
                }
                for (const mesh of meshes) {
                    this.houseByObjectId.set(mesh.id, house);
                    this.houseSectionByObjectId.set(mesh.id, { house, section });
                }

                if (this.shouldSectionBlockMovement(section)) {
                    section.body = this.createSectionBody(node);
                }

                house.sections.push(section);
                house.sectionById.set(section.id, section);
            });

            this.recomputeSectionedHouseState(house);
            this.houses.push(house);
            this.registerHouseProxy(house, proxyTemplate);
            if (USE_BREAKABLE_HOUSE_PROXIES) {
                this.deactivateHouse(house);
            }
        });
    }

    inferSectionType(sectionId: string) {
        if (sectionId.includes('FOUNDATION')) return 'foundation';
        if (sectionId.includes('ROOF')) return 'roof';
        if (sectionId.includes('CHIMNEY')) return 'chimney';
        if (sectionId.includes('DECO')) return 'prop';
        return 'wall';
    }

    defaultSectionHp(sectionId: string, sectionType: string) {
        if (sectionType === 'roof') return 180;
        if (sectionType === 'chimney') return 60;
        if (sectionType === 'prop') return 40;
        if (sectionType === 'foundation') return 9999;
        if (sectionId.includes('CENTER')) return 140;
        return 120;
    }

    shouldSectionBlockMovement(section: HouseSectionProp) {
        return section.sectionType === 'wall' || section.sectionType === 'chimney';
    }

    shouldSectionBlockShots(section: HouseSectionProp) {
        return section.sectionType !== 'foundation' && section.destroyed === false;
    }

    createSectionBody(sectionRoot: THREE.Object3D) {
        const bounds = this.computeSectionLocalBounds(sectionRoot);
        if (!bounds) return null;

        const size = bounds.getSize(new THREE.Vector3());
        if (size.x < 0.08 || size.y < 0.08 || size.z < 0.08) {
            return null;
        }

        const centerLocal = bounds.getCenter(new THREE.Vector3());
        const centerWorld = sectionRoot.localToWorld(centerLocal.clone());
        const rotation = sectionRoot.getWorldQuaternion(new THREE.Quaternion());

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(centerWorld.x, centerWorld.y, centerWorld.z)
            .setRotation({
                x: rotation.x,
                y: rotation.y,
                z: rotation.z,
                w: rotation.w
            });
        const body = this.physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            Math.max(size.x * 0.48, 0.05),
            Math.max(size.y * 0.48, 0.05),
            Math.max(size.z * 0.48, 0.05)
        );
        this.physics.createCollider(colliderDesc, body);
        return body;
    }

    computeSectionLocalBounds(sectionRoot: THREE.Object3D) {
        sectionRoot.updateMatrixWorld(true);
        const sectionInverse = new THREE.Matrix4().copy(sectionRoot.matrixWorld).invert();
        const box = new THREE.Box3();
        let hasGeometry = false;

        sectionRoot.traverse((child) => {
            if (!(child instanceof THREE.Mesh) || !child.geometry) return;
            if (!child.geometry.boundingBox) {
                child.geometry.computeBoundingBox();
            }
            if (!child.geometry.boundingBox) return;
            const localBox = child.geometry.boundingBox.clone();
            const childToSection = new THREE.Matrix4().multiplyMatrices(sectionInverse, child.matrixWorld);
            localBox.applyMatrix4(childToSection);
            if (!hasGeometry) {
                box.copy(localBox);
                hasGeometry = true;
            } else {
                box.union(localBox);
            }
        });

        return hasGeometry ? box : null;
    }

    createHouseBody(position: THREE.Vector3, rotationY: number) {
        const houseRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y + 1.6, position.z)
            .setRotation({
                x: houseRotation.x,
                y: houseRotation.y,
                z: houseRotation.z,
                w: houseRotation.w
            });
        const body = this.physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1.8, 1.6, 1.55);
        this.physics.createCollider(colliderDesc, body);
        return body;
    }

    registerHouseProxy(house: HouseProp, proxyTemplate?: THREE.Group) {
        if (!USE_BREAKABLE_HOUSE_PROXIES) return;
        const proxyRoot = proxyTemplate ? proxyTemplate.clone(true) : new THREE.Group();
        proxyRoot.name = `${house.id}-proxy`;
        proxyRoot.position.copy(house.position);
        proxyRoot.rotation.y = house.root.rotation.y;

        proxyRoot.visible = false;
        markShadows(proxyRoot);
        this.scene.add(proxyRoot);

        const meshes = collectMeshes(proxyRoot);
        const proxy: HouseProxy = {
            root: proxyRoot,
            meshes,
            body: null,
            collisionEntries: meshes
        };
        this.houseProxyState.set(house.id, proxy);
        for (const mesh of meshes) {
            this.houseProxyByObjectId.set(mesh.id, house);
        }
    }

    activateHouse(house: HouseProp) {
        if (house.active) return;
        house.active = true;
        house.root.visible = true;

        const proxy = this.houseProxyState.get(house.id);
        if (proxy) {
            proxy.root.visible = false;
            this.removeCollisionEntries(proxy.collisionEntries);
            if (proxy.body) {
                this.physics.removeRigidBody(proxy.body);
                proxy.body = null;
            }
        }

        if (house.sections.length > 0) {
            for (const section of house.sections) {
                if (section.hp > 0) {
                    this.restoreHouseSection(section);
                } else {
                    section.root.visible = false;
                }
            }
            if (this.shouldCollapseSectionedHouse(house)) {
                this.collapseSectionedHouse(house, false);
            } else {
                this.restoreCollapsedHouseExtras(house, false);
            }
            this.recomputeSectionedHouseState(house);
            return;
        }

        if (!house.body && house.stage < 2) {
            house.body = this.createHouseBody(house.position, house.root.rotation.y);
        }
        this.setHouseStage(house, house.stage);
    }

    deactivateHouse(house: HouseProp) {
        if (!USE_BREAKABLE_HOUSE_PROXIES) return;
        if (!house.active) return;
        house.active = false;
        house.root.visible = false;

        if (house.sections.length > 0) {
            this.removeCollisionEntries(house.collisionEntries);
            for (const section of house.sections) {
                if (section.body) {
                    this.physics.removeRigidBody(section.body);
                    section.body = null;
                }
            }
        } else {
            this.removeCollisionEntries(house.collisionEntries);
            if (house.body) {
                this.physics.removeRigidBody(house.body);
                house.body = null;
            }
            house.collisionEntries = [];
        }

        const proxy = this.houseProxyState.get(house.id);
        if (!proxy) return;

        proxy.root.visible = true;
        this.removeCollisionEntries(proxy.collisionEntries);
        this.collisionMeshes.push(...proxy.collisionEntries);
        if (!proxy.body) {
            proxy.body = this.createHouseBody(house.position, house.root.rotation.y);
        }
    }

    promoteNearbyHouses(observerPositions: THREE.Vector3[]) {
        if (!USE_BREAKABLE_HOUSE_PROXIES) return;
        if (observerPositions.length === 0) return;
        const activationRadiusSq = BREAKABLE_PROXY_ACTIVATION_RADIUS * BREAKABLE_PROXY_ACTIVATION_RADIUS;
        for (const house of this.houses) {
            if (house.active) continue;
            const shouldActivate = observerPositions.some((position) => house.position.distanceToSquared(position) <= activationRadiusSq);
            if (shouldActivate) {
                this.activateHouse(house);
            }
        }
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    consumeFxEvents() {
        const events = this.fxEvents;
        this.fxEvents = [];
        return events;
    }

    update(dt: number, observerPositions: THREE.Vector3[] = []) {
        this.promoteNearbyHouses(observerPositions);

        for (let i = this.fallingSections.length - 1; i >= 0; i--) {
            const piece = this.fallingSections[i];
            piece.life -= dt;
            piece.velocity.y -= dt * 9.6;
            piece.velocity.multiplyScalar(0.992);
            piece.root.position.addScaledVector(piece.velocity, dt);
            piece.root.rotation.x += piece.spin.x * dt;
            piece.root.rotation.y += piece.spin.y * dt;
            piece.root.rotation.z += piece.spin.z * dt;

            const groundY = this.heightAt(piece.root.position.x, piece.root.position.z) + piece.halfHeight;
            if (piece.root.position.y <= groundY) {
                piece.root.position.y = groundY;
                if (Math.abs(piece.velocity.y) > 0.9) {
                    piece.velocity.y *= -0.18;
                    piece.velocity.x *= 0.84;
                    piece.velocity.z *= 0.84;
                    piece.spin.multiplyScalar(0.72);
                } else {
                    piece.velocity.set(0, 0, 0);
                    piece.spin.multiplyScalar(0.86);
                    piece.settleTimer += dt;
                }
            }

            if (piece.life <= 0 || piece.settleTimer > 2.2) {
                this.scene.remove(piece.root);
                this.fallingSections.splice(i, 1);
            }
        }
    }

    getSnapshot(): HouseSnapshot[] {
        return this.houses.map((house) => ({
            id: house.id,
            hp: house.hp,
            stage: house.stage,
            sections: house.sections.length > 0
                ? Object.fromEntries(house.sections.map((section) => [section.id, section.hp]))
                : undefined
        }));
    }

    applySnapshot(snapshot: HouseSnapshot[]) {
        if (snapshot.length > 0 && this.houses.length === 0) {
            this.pendingHouseSnapshots = snapshot;
            return;
        }

        for (const state of snapshot) {
            const house = this.houses.find((entry) => entry.id === state.id);
            if (!house) continue;
            if (house.sections.length > 0 && state.sections) {
                this.applyHouseSectionSnapshot(house, state.sections);
            } else {
                house.hp = state.hp;
                if (house.active) {
                    this.setHouseStage(house, state.stage);
                } else {
                    house.stage = state.stage;
                }
            }
        }
    }

    applyHouseSnapshots(houseStates: HouseSnapshot[]) {
        this.applySnapshot(houseStates);
    }

    handleProjectileHit(object: THREE.Object3D, point: THREE.Vector3, damage: number, authoritative: boolean) {
        const proxyHouse = this.findHouseProxy(object);
        if (proxyHouse) {
            if (authoritative) {
                const section = this.findClosestSection(proxyHouse, point);
                if (section) {
                    const previousHp = section.hp;
                    this.damageHouseSection(proxyHouse, section, damage, point);
                    if (previousHp > 0 && section.hp <= 0) {
                        this.activateHouse(proxyHouse);
                    }
                } else {
                    this.damageHouse(proxyHouse, damage);
                    if (proxyHouse.stage > 0) {
                        this.activateHouse(proxyHouse);
                    }
                }
            }
            return true;
        }

        const sectionHit = this.findHouseSection(object);
        if (sectionHit) {
            if (authoritative) {
                this.damageHouseSection(sectionHit.house, sectionHit.section, damage, point);
            }
            return true;
        }

        const house = this.findHouse(object);
        if (house) {
            if (authoritative) {
                this.damageHouse(house, damage);
            }
            return true;
        }

        return false;
    }

    findHouseProxy(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const house = this.houseProxyByObjectId.get(current.id);
            if (house) return house;
            current = current.parent;
        }
        return null;
    }

    findHouse(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const house = this.houseByObjectId.get(current.id);
            if (house) return house;
            current = current.parent;
        }
        return null;
    }

    findHouseSection(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const hit = this.houseSectionByObjectId.get(current.id);
            if (hit) return hit;
            current = current.parent;
        }
        return null;
    }

    findClosestSection(house: HouseProp, point: THREE.Vector3) {
        let bestSection: HouseSectionProp | null = null;
        let bestDistanceSq = Number.POSITIVE_INFINITY;
        for (const section of house.sections) {
            if (section.destroyed || !section.destructible) continue;
            const distanceSq = section.position.distanceToSquared(point);
            if (distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestSection = section;
            }
        }
        return bestSection;
    }

    damageHouse(house: HouseProp, damage: number) {
        if (house.sections.length > 0) return;
        if (house.stage === 2) return;
        house.hp = Math.max(0, house.hp - damage);

        if (house.hp <= 0) {
            this.setHouseStage(house, 2);
        } else if (house.hp <= house.maxHp * 0.55) {
            this.setHouseStage(house, 1);
        }
    }

    damageHouseSection(house: HouseProp, section: HouseSectionProp, damage: number, point: THREE.Vector3) {
        if (section.destroyed || !section.destructible) return;
        section.hp = Math.max(0, section.hp - damage);
        if (section.hp > 0) {
            this.recomputeSectionedHouseState(house);
            return;
        }

        const previousStage = house.stage;
        this.destroyHouseSection(section, true, true, point);
        this.recomputeSectionedHouseState(house);

        if (this.shouldCollapseSectionedHouse(house)) {
            this.collapseSectionedHouse(house);
        }

        const eventKind = house.stage === 2 && previousStage < 2 ? 'house_collapse' : 'house_damage';
        this.fxEvents.push({
            kind: eventKind,
            x: point.x,
            y: point.y,
            z: point.z,
            intensity: eventKind === 'house_collapse' ? 1.35 : 0.95
        });
    }

    applyHouseSectionSnapshot(house: HouseProp, sectionState: Record<string, number>) {
        for (const section of house.sections) {
            const nextHp = sectionState[section.id] ?? section.maxHp;
            const wasDestroyed = section.destroyed;
            section.hp = THREE.MathUtils.clamp(nextHp, 0, section.maxHp);
            if (section.hp <= 0) {
                this.destroyHouseSection(section, false, house.active && !wasDestroyed);
            } else {
                this.restoreHouseSection(section, house.active);
            }
        }
        if (this.shouldCollapseSectionedHouse(house)) {
            this.collapseSectionedHouse(house, false);
        } else {
            this.restoreCollapsedHouseExtras(house, false);
        }
        this.recomputeSectionedHouseState(house);
        if (!house.active && house.sections.some((section) => section.destroyed)) {
            this.activateHouse(house);
        }
    }

    recomputeSectionedHouseState(house: HouseProp) {
        if (house.sections.length === 0) return;
        const trackedSections = house.sections.filter((section) => section.destructible && section.sectionType !== 'foundation');
        house.maxHp = trackedSections.reduce((sum, section) => sum + section.maxHp, 0);
        house.hp = trackedSections.reduce((sum, section) => sum + section.hp, 0);
        const destroyedCount = trackedSections.filter((section) => section.destroyed).length;
        if (destroyedCount === 0) {
            house.stage = 0;
        } else if (this.shouldCollapseSectionedHouse(house)) {
            house.stage = 2;
        } else {
            house.stage = 1;
        }
    }

    shouldCollapseSectionedHouse(house: HouseProp) {
        if (house.sections.length === 0) return false;
        return HOUSE_COLLAPSIBLE_SECTION_IDS.every((sectionId) => {
            const section = house.sectionById.get(sectionId);
            return !section || section.destroyed;
        });
    }

    collapseSectionedHouse(house: HouseProp, emitFx = true) {
        for (const section of house.sections) {
            if (section.sectionType === 'roof' || section.sectionType === 'chimney' || section.sectionType === 'prop') {
                this.destroyHouseSection(section, false, emitFx && house.active);
            }
        }
        house.stage = 2;
        this.recomputeSectionedHouseState(house);
        if (emitFx) {
            this.fxEvents.push({
                kind: 'house_collapse',
                x: house.position.x,
                y: 1.8,
                z: house.position.z,
                intensity: 1.35
            });
        }
    }

    restoreCollapsedHouseExtras(house: HouseProp, recompute = true) {
        for (const section of house.sections) {
            if ((section.sectionType === 'roof' || section.sectionType === 'chimney' || section.sectionType === 'prop') && section.hp > 0) {
                this.restoreHouseSection(section, house.active);
            }
        }
        if (recompute) {
            this.recomputeSectionedHouseState(house);
        }
    }

    destroyHouseSection(section: HouseSectionProp, removeHp = true, spawnDrop = true, impulseOrigin?: THREE.Vector3) {
        if (section.destroyed) return false;
        section.destroyed = true;
        if (removeHp) {
            section.hp = 0;
        }
        if (spawnDrop && this.shouldSpawnSectionDrop(section)) {
            this.spawnSectionDrop(section, impulseOrigin);
        }
        section.root.visible = false;
        this.removeCollisionEntries(section.collisionEntries);
        for (const mesh of section.meshes) {
            this.houseSectionByObjectId.delete(mesh.id);
        }
        if (section.body) {
            this.physics.removeRigidBody(section.body);
            section.body = null;
        }
        return true;
    }

    restoreHouseSection(section: HouseSectionProp, addCollision = true) {
        if (!section.destroyed && section.body) return;
        section.destroyed = false;
        section.root.visible = true;
        if (addCollision) {
            this.removeCollisionEntries(section.collisionEntries);
            this.collisionMeshes.push(...section.collisionEntries);
        }
        for (const mesh of section.meshes) {
            const hit = this.houseByObjectId.get(mesh.id);
            if (hit) {
                this.houseSectionByObjectId.set(mesh.id, { house: hit, section });
            }
        }
        if (addCollision && !section.body && this.shouldSectionBlockMovement(section)) {
            section.body = this.createSectionBody(section.root);
        }
    }

    setHouseStage(house: HouseProp, stage: 0 | 1 | 2) {
        if (!house.intact || !house.damaged || !house.rubble) return;
        if (house.stage === stage && house.collisionEntries.length > 0) return;

        const previousStage = house.stage;
        house.stage = stage;
        house.intact.visible = stage === 0;
        house.damaged.visible = stage === 1;
        house.rubble.visible = stage === 2;

        const nextCollisionEntries =
            stage === 0 ? collectMeshes(house.intact) :
            stage === 1 ? collectMeshes(house.damaged) :
            [];

        this.replaceCollisionEntries(house.collisionEntries, nextCollisionEntries);
        house.collisionEntries = nextCollisionEntries;

        if (stage === 2 && house.body) {
            this.physics.removeRigidBody(house.body);
            house.body = null;
        }

        if (stage === 1 && previousStage < 1) {
            this.fxEvents.push({
                kind: 'house_damage',
                x: house.position.x,
                y: 1.8,
                z: house.position.z,
                intensity: 1.0
            });
        } else if (stage === 2 && previousStage < 2) {
            this.fxEvents.push({
                kind: 'house_collapse',
                x: house.position.x,
                y: 1.2,
                z: house.position.z,
                intensity: 1.4
            });
        }
    }

    replaceCollisionEntries(previous: THREE.Mesh[], next: THREE.Mesh[]) {
        const previousIds = new Set(previous.map((mesh) => mesh.id));
        this.collisionMeshes = this.collisionMeshes.filter((mesh) => !previousIds.has(mesh.id));
        this.collisionMeshes.push(...next);
    }

    removeCollisionEntries(entries: THREE.Mesh[]) {
        if (entries.length === 0) return;
        const entryIds = new Set(entries.map((mesh) => mesh.id));
        this.collisionMeshes = this.collisionMeshes.filter((mesh) => !entryIds.has(mesh.id));
    }

    shouldSpawnSectionDrop(section: HouseSectionProp) {
        return section.sectionType === 'wall' || section.sectionType === 'roof' || section.sectionType === 'chimney';
    }

    spawnSectionDrop(section: HouseSectionProp, impulseOrigin?: THREE.Vector3) {
        const clone = section.root.clone(true);
        section.root.updateMatrixWorld(true);
        const worldPosition = section.root.getWorldPosition(new THREE.Vector3());
        const worldQuaternion = section.root.getWorldQuaternion(new THREE.Quaternion());
        const worldScale = section.root.getWorldScale(new THREE.Vector3());
        clone.position.copy(worldPosition);
        clone.quaternion.copy(worldQuaternion);
        clone.scale.copy(worldScale);
        clone.visible = true;
        clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(clone);

        const bounds = new THREE.Box3().setFromObject(clone);
        const size = bounds.getSize(new THREE.Vector3());
        const halfHeight = Math.max(size.y * 0.5, 0.18);
        const impulse = new THREE.Vector3(
            (Math.random() - 0.5) * 2.4,
            2.8 + Math.random() * 1.8,
            (Math.random() - 0.5) * 2.4
        );
        if (impulseOrigin) {
            const away = worldPosition.clone().sub(impulseOrigin);
            away.y = 0;
            if (away.lengthSq() > 0.001) {
                away.normalize().multiplyScalar(2.2);
                impulse.x += away.x;
                impulse.z += away.z;
            }
        }

        this.fallingSections.push({
            root: clone,
            velocity: impulse,
            spin: new THREE.Vector3(
                (Math.random() - 0.5) * 4.5,
                (Math.random() - 0.5) * 4.5,
                (Math.random() - 0.5) * 4.5
            ),
            life: 5.2,
            settleTimer: 0,
            halfHeight
        });
    }

    reset() {
        this.fxEvents = [];
        for (const piece of this.fallingSections) {
            this.scene.remove(piece.root);
        }
        this.fallingSections = [];
        for (const house of this.houses) {
            this.activateHouse(house);
            if (house.sections.length > 0) {
                for (const section of house.sections) {
                    section.hp = section.maxHp;
                    this.restoreHouseSection(section);
                }
                this.restoreCollapsedHouseExtras(house);
                this.recomputeSectionedHouseState(house);
            } else {
                house.hp = house.maxHp;
                if (!house.body) {
                    house.body = this.createHouseBody(house.position, house.root.rotation.y);
                }
                this.setHouseStage(house, 0);
            }
            if (USE_BREAKABLE_HOUSE_PROXIES) {
                this.deactivateHouse(house);
            }
        }
    }
}
