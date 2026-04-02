import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import sectionedHouseUrl from '../assets/props/VillagePrefab_House_A_breakable_web.glb?url';

type LayoutEntry = { x: number; z: number; rot?: number; scale?: number };

type StaticBodyConfig = {
    halfWidth: number;
    halfHeight: number;
    halfDepth: number;
    yOffset?: number;
};

export type TreeSnapshot = {
    id: string;
    hp: number;
    destroyed: boolean;
    fallAngle: number;
};

export type HouseSnapshot = {
    id: string;
    hp: number;
    stage: 0 | 1 | 2;
    sections?: Record<string, number>;
};

export type PropSnapshot = {
    trees: TreeSnapshot[];
    houses: HouseSnapshot[];
};

export type PropFxEvent = {
    kind: 'tree_fall' | 'house_damage' | 'house_collapse';
    x: number;
    y: number;
    z: number;
    intensity: number;
};

type TreeProp = {
    id: string;
    root: THREE.Group;
    intact: THREE.Group;
    trunk: THREE.Mesh;
    stump: THREE.Mesh;
    fallen: THREE.Group;
    body: RAPIER.RigidBody | null;
    hp: number;
    maxHp: number;
    destroyed: boolean;
    fallAngle: number;
    position: THREE.Vector3;
    scale: number;
};

type HouseProp = {
    id: string;
    root: THREE.Group;
    intact?: THREE.Group;
    damaged?: THREE.Group;
    rubble?: THREE.Group;
    body: RAPIER.RigidBody | null;
    hp: number;
    maxHp: number;
    stage: 0 | 1 | 2;
    collisionEntries: THREE.Mesh[];
    position: THREE.Vector3;
    prefabKind: 'procedural' | 'sectioned';
    sections: HouseSectionProp[];
    sectionById: Map<string, HouseSectionProp>;
    bodyConfig?: StaticBodyConfig;
    loaded: boolean;
};

type HouseSectionProp = {
    id: string;
    root: THREE.Object3D;
    meshes: THREE.Mesh[];
    body: RAPIER.RigidBody | null;
    hp: number;
    maxHp: number;
    destroyed: boolean;
    destructible: boolean;
    sectionType: string;
    position: THREE.Vector3;
    collisionEntries: THREE.Mesh[];
};

type HouseSectionHit = {
    house: HouseProp;
    section: HouseSectionProp;
};

type FallingSection = {
    root: THREE.Object3D;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
    settleTimer: number;
    halfHeight: number;
};

const HOUSE_LAYOUT: LayoutEntry[] = [
    { x: 58, z: 20, rot: 0.08 },
    { x: 60, z: 54, rot: -0.12 },
    { x: 96, z: 20, rot: 0.16 },
    { x: 94, z: 48, rot: -0.08 },
    { x: 104, z: 34, rot: 0.12 },
    { x: 108, z: 58, rot: -0.18 }
];

const INDUSTRIAL_LAYOUT: LayoutEntry[] = [
    { x: -100, z: 34, rot: 0.06, scale: 1.06 },
    { x: -94, z: 10, rot: -0.08, scale: 0.92 },
    { x: -94, z: 60, rot: 0.12, scale: 0.98 },
    { x: -70, z: 18, rot: 0.14, scale: 0.88 },
    { x: -68, z: 50, rot: -0.12, scale: 0.94 }
];

const PEOPLE_LAYOUT: LayoutEntry[] = [
    { x: -90, z: 42 }, { x: -78, z: 30 }, { x: -70, z: 54 }, { x: -58, z: 20 },
    { x: 56, z: 18 }, { x: 66, z: 30 }, { x: 78, z: 22 }, { x: 84, z: 46 },
    { x: 92, z: 58 }, { x: 96, z: 34 }, { x: -18, z: -8 }, { x: 12, z: 8 }
];

const TREE_LAYOUT: LayoutEntry[] = [
    { x: -112, z: -54, scale: 1.1 },
    { x: -106, z: -18, scale: 0.98 },
    { x: -100, z: 24, scale: 1.04 },
    { x: -92, z: 68, scale: 1.08 },
    { x: -72, z: 84, scale: 1.06 },
    { x: -22, z: 98, scale: 0.92 },
    { x: 18, z: 96, scale: 1.02 },
    { x: 52, z: 88, scale: 1.08 },
    { x: 82, z: 74, scale: 1.14 },
    { x: 106, z: 50, scale: 1.04 },
    { x: 110, z: 12, scale: 1.02 },
    { x: 104, z: -28, scale: 1.08 },
    { x: 84, z: -68, scale: 1.1 },
    { x: 26, z: -102, scale: 0.96 },
    { x: -28, z: -100, scale: 1.06 },
    { x: -70, z: -86, scale: 0.92 }
];

function markShadows(root: THREE.Object3D) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

function collectMeshes(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            meshes.push(child);
        }
    });
    return meshes;
}

const houseLoader = new GLTFLoader();
let housePrefabTemplatePromise: Promise<THREE.Group> | null = null;

const HOUSE_COLLAPSIBLE_SECTION_IDS = [
    'SEC_FRONT_LEFT',
    'SEC_FRONT_CENTER',
    'SEC_FRONT_RIGHT',
    'SEC_BACK_LEFT',
    'SEC_BACK_CENTER',
    'SEC_BACK_RIGHT',
    'SEC_LEFT_SIDE',
    'SEC_RIGHT_SIDE'
];

const DEFAULT_HOUSE_BODY_CONFIG: StaticBodyConfig = {
    halfWidth: 1.8,
    halfHeight: 1.6,
    halfDepth: 1.55,
    yOffset: 1.6
};

const DEFAULT_INDUSTRIAL_BODY_CONFIG: StaticBodyConfig = {
    halfWidth: 2.5,
    halfHeight: 2.2,
    halfDepth: 2.2,
    yOffset: 2.2
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

export class PropManager {
    collisionMeshes: THREE.Mesh[] = [];
    trees: TreeProp[] = [];
    houses: HouseProp[] = [];
    treeByObjectId = new Map<number, TreeProp>();
    houseByObjectId = new Map<number, HouseProp>();
    houseSectionByObjectId = new Map<number, HouseSectionHit>();
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
        this.addScaleObjects();
    }

    addScaleObjects() {
        this.addHouses();
        this.addPeople();
        this.addTrees();
    }

    async addHouses() {
        try {
            const template = await loadSectionedHouseTemplate();
            this.addSectionedHouses(template);
            this.addIndustrialStructures();
            if (this.pendingHouseSnapshots) {
                this.applyHouseSnapshots(this.pendingHouseSnapshots);
                this.pendingHouseSnapshots = null;
            }
        } catch (error) {
            console.warn('Failed to load sectioned village house prefab. Falling back to procedural houses.', error);
            this.addProceduralHouses();
            this.addIndustrialStructures();
            if (this.pendingHouseSnapshots) {
                this.applyHouseSnapshots(this.pendingHouseSnapshots);
                this.pendingHouseSnapshots = null;
            }
        }
    }

    addProceduralHouses() {
        HOUSE_LAYOUT.forEach((layout, index) => {
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
                bodyConfig: DEFAULT_HOUSE_BODY_CONFIG,
                loaded: true
            };

            for (const mesh of [...collectMeshes(intact), ...collectMeshes(damaged)]) {
                this.houseByObjectId.set(mesh.id, house);
            }

            this.setHouseStage(house, 0);
            this.houses.push(house);
        });
    }

    addIndustrialStructures() {
        INDUSTRIAL_LAYOUT.forEach((layout, index) => {
            const scale = layout.scale ?? 1;
            const root = new THREE.Group();
            root.position.set(layout.x, this.heightAt(layout.x, layout.z), layout.z);
            root.rotation.y = layout.rot ?? 0;
            this.scene.add(root);

            const plateMat = new THREE.MeshStandardMaterial({ color: 0x645548, roughness: 0.98 });
            const tankMat = new THREE.MeshStandardMaterial({ color: 0x6b5e4f, roughness: 0.9, metalness: 0.08 });
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x3d322b, roughness: 0.98, metalness: 0.06 });
            const brassMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.82, metalness: 0.14 });
            const runeMat = new THREE.MeshStandardMaterial({ color: 0x688b90, emissive: 0x22464b, emissiveIntensity: 0.85, roughness: 0.42 });
            const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x5e534a, roughness: 1 });

            const intact = new THREE.Group();
            const base = new THREE.Mesh(new THREE.BoxGeometry(4.9 * scale, 0.9 * scale, 4.2 * scale), plateMat);
            base.position.y = 0.45 * scale;
            intact.add(base);

            const rearTank = new THREE.Mesh(new THREE.CylinderGeometry(1.05 * scale, 1.18 * scale, 4.1 * scale, 10), tankMat);
            rearTank.rotation.z = Math.PI / 2;
            rearTank.position.set(-0.9 * scale, 2.7 * scale, -0.5 * scale);
            intact.add(rearTank);

            const frontTank = new THREE.Mesh(new THREE.CylinderGeometry(0.82 * scale, 0.92 * scale, 3.0 * scale, 10), tankMat.clone());
            frontTank.rotation.z = Math.PI / 2;
            frontTank.position.set(1.1 * scale, 2.05 * scale, 0.95 * scale);
            intact.add(frontTank);

            const leftBrace = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 3.8 * scale, 0.34 * scale), trimMat);
            leftBrace.position.set(-1.9 * scale, 1.9 * scale, 1.5 * scale);
            intact.add(leftBrace);

            const rightBrace = leftBrace.clone();
            rightBrace.position.x = 1.8 * scale;
            intact.add(rightBrace);

            const catwalk = new THREE.Mesh(new THREE.BoxGeometry(4.2 * scale, 0.24 * scale, 1.15 * scale), brassMat);
            catwalk.position.set(-0.15 * scale, 3.65 * scale, 1.1 * scale);
            intact.add(catwalk);

            const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * scale, 0.42 * scale, 5.9 * scale, 8), trimMat.clone());
            stack.position.set(1.95 * scale, 3.2 * scale, -1.3 * scale);
            intact.add(stack);

            const valve = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.9 * scale, 0.22 * scale), runeMat);
            valve.position.set(-1.15 * scale, 2.2 * scale, 2.15 * scale);
            valve.rotation.y = -0.18;
            intact.add(valve);

            const damaged = new THREE.Group();
            const brokenBase = new THREE.Mesh(new THREE.BoxGeometry(4.4 * scale, 0.85 * scale, 3.9 * scale), plateMat.clone());
            brokenBase.position.set(0, 0.42 * scale, 0);
            damaged.add(brokenBase);

            const toppledTank = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * scale, 1.1 * scale, 3.9 * scale, 10), tankMat.clone());
            toppledTank.rotation.set(0.22, 0.3, Math.PI / 2 - 0.28);
            toppledTank.position.set(-0.35 * scale, 1.45 * scale, -0.2 * scale);
            damaged.add(toppledTank);

            const rupturedTank = new THREE.Mesh(new THREE.CylinderGeometry(0.78 * scale, 0.88 * scale, 2.4 * scale, 10), tankMat.clone());
            rupturedTank.rotation.set(-0.18, -0.24, Math.PI / 2 + 0.12);
            rupturedTank.position.set(1.15 * scale, 1.35 * scale, 1.15 * scale);
            damaged.add(rupturedTank);

            const brokenStack = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.38 * scale, 3.4 * scale, 8), trimMat.clone());
            brokenStack.position.set(1.45 * scale, 1.8 * scale, -1.0 * scale);
            brokenStack.rotation.z = 0.38;
            damaged.add(brokenStack);

            const spar = new THREE.Mesh(new THREE.BoxGeometry(3.6 * scale, 0.2 * scale, 0.24 * scale), trimMat.clone());
            spar.position.set(-0.9 * scale, 2.2 * scale, 1.05 * scale);
            spar.rotation.set(0.28, -0.22, -0.44);
            damaged.add(spar);

            const crackedPanel = new THREE.Mesh(new THREE.BoxGeometry(0.82 * scale, 0.82 * scale, 0.22 * scale), runeMat.clone());
            crackedPanel.position.set(-1.05 * scale, 1.35 * scale, 1.95 * scale);
            crackedPanel.rotation.set(0.18, -0.1, -0.2);
            damaged.add(crackedPanel);

            damaged.visible = false;
            root.add(intact, damaged);

            const rubble = new THREE.Group();
            const rubbleBase = new THREE.Mesh(new THREE.BoxGeometry(4.5 * scale, 0.75 * scale, 3.8 * scale), rubbleMat);
            rubbleBase.position.set(0, 0.38 * scale, 0);
            rubble.add(rubbleBase);

            const tankChunk = new THREE.Mesh(new THREE.CylinderGeometry(0.82 * scale, 0.92 * scale, 2.1 * scale, 10), tankMat.clone());
            tankChunk.rotation.set(0.3, 0.52, Math.PI / 2 - 0.18);
            tankChunk.position.set(-0.55 * scale, 1.0 * scale, -0.4 * scale);
            rubble.add(tankChunk);

            const beamChunk = new THREE.Mesh(new THREE.BoxGeometry(2.2 * scale, 0.2 * scale, 0.22 * scale), trimMat.clone());
            beamChunk.position.set(0.75 * scale, 0.9 * scale, 0.8 * scale);
            beamChunk.rotation.set(0.22, -0.48, -0.32);
            rubble.add(beamChunk);

            const valveChunk = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 0.55 * scale, 0.55 * scale), brassMat.clone());
            valveChunk.position.set(1.3 * scale, 0.72 * scale, -0.95 * scale);
            valveChunk.rotation.set(0.1, 0.35, 0.22);
            rubble.add(valveChunk);

            rubble.visible = false;
            root.add(rubble);

            markShadows(root);

            const house: HouseProp = {
                id: `industrial-${index}`,
                root,
                intact,
                damaged,
                rubble,
                body: this.createHouseBody(root.position, layout.rot ?? 0, DEFAULT_INDUSTRIAL_BODY_CONFIG),
                hp: 84,
                maxHp: 84,
                stage: 0,
                collisionEntries: [],
                position: root.position.clone(),
                prefabKind: 'procedural',
                sections: [],
                sectionById: new Map(),
                bodyConfig: DEFAULT_INDUSTRIAL_BODY_CONFIG,
                loaded: true
            };

            for (const mesh of [...collectMeshes(intact), ...collectMeshes(damaged)]) {
                this.houseByObjectId.set(mesh.id, house);
            }

            this.setHouseStage(house, 0);
            this.houses.push(house);
        });
    }

    addSectionedHouses(template: THREE.Group) {
        HOUSE_LAYOUT.forEach((layout, index) => {
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

    addPeople() {
        for (const layout of PEOPLE_LAYOUT) {
            const person = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.15, 0.5, 2, 4),
                new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 })
            );
            person.position.set(layout.x, this.heightAt(layout.x, layout.z) + 0.4, layout.z);
            person.castShadow = true;
            this.scene.add(person);
        }
    }

    addTrees() {
        TREE_LAYOUT.forEach((layout, index) => {
            const scale = layout.scale ?? 1;
            const root = new THREE.Group();
            root.position.set(layout.x, this.heightAt(layout.x, layout.z), layout.z);
            this.scene.add(root);

            const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 1 });
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.95 });
            const stumpMat = new THREE.MeshStandardMaterial({ color: 0x5f4731, roughness: 1 });

            const intact = new THREE.Group();
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25 * scale, 0.34 * scale, 3.4 * scale, 6),
                barkMat
            );
            trunk.position.y = 1.7 * scale;
            intact.add(trunk);

            const leaves = new THREE.Mesh(
                new THREE.SphereGeometry(1.35 * scale, 6, 5),
                leafMat
            );
            leaves.position.y = 4.0 * scale;
            intact.add(leaves);
            root.add(intact);

            const stump = new THREE.Mesh(
                new THREE.CylinderGeometry(0.34 * scale, 0.42 * scale, 0.9 * scale, 6),
                stumpMat
            );
            stump.position.y = 0.45 * scale;
            stump.visible = false;
            root.add(stump);

            const fallen = new THREE.Group();
            const fallenTrunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.24 * scale, 0.32 * scale, 3.1 * scale, 6),
                barkMat.clone()
            );
            fallenTrunk.rotation.z = Math.PI / 2;
            fallenTrunk.position.set(1.45 * scale, 0.4 * scale, 0);
            fallen.add(fallenTrunk);

            const fallenCrown = new THREE.Mesh(
                new THREE.SphereGeometry(1.15 * scale, 6, 5),
                leafMat.clone()
            );
            fallenCrown.position.set(2.8 * scale, 0.95 * scale, 0);
            fallen.add(fallenCrown);
            fallen.visible = false;
            root.add(fallen);

            markShadows(root);

            const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(layout.x, root.position.y + 1.7 * scale, layout.z);
            const body = this.physics.createRigidBody(bodyDesc);
            const colliderDesc = RAPIER.ColliderDesc.cylinder(1.7 * scale, 0.42 * scale);
            this.physics.createCollider(colliderDesc, body);

            const tree: TreeProp = {
                id: `tree-${index}`,
                root,
                intact,
                trunk,
                stump,
                fallen,
                body,
                hp: 30,
                maxHp: 30,
                destroyed: false,
                fallAngle: 0,
                position: root.position.clone(),
                scale
            };

            this.treeByObjectId.set(trunk.id, tree);
            this.collisionMeshes.push(trunk);
            this.trees.push(tree);
        });
    }

    createHouseBody(position: THREE.Vector3, rotationY: number, bodyConfig: StaticBodyConfig = DEFAULT_HOUSE_BODY_CONFIG) {
        const houseRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
        const halfWidth = bodyConfig.halfWidth;
        const halfHeight = bodyConfig.halfHeight;
        const halfDepth = bodyConfig.halfDepth;
        const yOffset = bodyConfig.yOffset ?? halfHeight;
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y + yOffset, position.z)
            .setRotation({
                x: houseRotation.x,
                y: houseRotation.y,
                z: houseRotation.z,
                w: houseRotation.w
            });
        const body = this.physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth);
        this.physics.createCollider(colliderDesc, body);
        return body;
    }

    getCollisionMeshes() {
        return this.collisionMeshes;
    }

    consumeFxEvents() {
        const events = this.fxEvents;
        this.fxEvents = [];
        return events;
    }

    update(dt: number) {
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

    getSnapshot(): PropSnapshot {
        return {
            trees: this.trees.map((tree) => ({
                id: tree.id,
                hp: tree.hp,
                destroyed: tree.destroyed,
                fallAngle: tree.fallAngle
            })),
            houses: this.houses.map((house) => ({
                id: house.id,
                hp: house.hp,
                stage: house.stage,
                sections: house.sections.length > 0
                    ? Object.fromEntries(house.sections.map((section) => [section.id, section.hp]))
                    : undefined
            }))
        };
    }

    applySnapshot(snapshot: PropSnapshot | TreeSnapshot[]) {
        if (Array.isArray(snapshot)) {
            for (const state of snapshot) {
                const tree = this.trees.find((entry) => entry.id === state.id);
                if (!tree) continue;
                tree.hp = state.hp;
                if (state.destroyed) {
                    this.setTreeDestroyed(tree, state.fallAngle);
                }
            }
            return;
        }

        if (snapshot.houses.length > 0 && this.houses.length === 0) {
            this.pendingHouseSnapshots = snapshot.houses;
        }

        for (const state of snapshot.trees) {
            const tree = this.trees.find((entry) => entry.id === state.id);
            if (!tree) continue;
            tree.hp = state.hp;
            if (state.destroyed) {
                this.setTreeDestroyed(tree, state.fallAngle);
            }
        }

        for (const state of snapshot.houses) {
            const house = this.houses.find((entry) => entry.id === state.id);
            if (!house) continue;
            if (house.sections.length > 0 && state.sections) {
                this.applyHouseSectionSnapshot(house, state.sections);
                continue;
            }
            house.hp = state.hp;
            this.setHouseStage(house, state.stage);
        }
    }

    applyHouseSnapshots(houseStates: HouseSnapshot[]) {
        if (this.houses.length === 0) {
            this.pendingHouseSnapshots = houseStates;
            return;
        }

        for (const state of houseStates) {
            const house = this.houses.find((entry) => entry.id === state.id);
            if (!house) continue;
            if (house.sections.length > 0 && state.sections) {
                this.applyHouseSectionSnapshot(house, state.sections);
            } else {
                house.hp = state.hp;
                this.setHouseStage(house, state.stage);
            }
        }
    }

    handleProjectileHit(object: THREE.Object3D, point: THREE.Vector3, damage: number, authoritative: boolean) {
        const tree = this.findTree(object);
        if (tree) {
            if (authoritative) {
                this.damageTree(tree, damage, point);
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

    findTree(object: THREE.Object3D | null) {
        let current: THREE.Object3D | null = object;
        while (current) {
            const tree = this.treeByObjectId.get(current.id);
            if (tree) return tree;
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

    damageTree(tree: TreeProp, damage: number, point: THREE.Vector3) {
        if (tree.destroyed) return;
        tree.hp = Math.max(0, tree.hp - damage);
        if (tree.hp <= 0) {
            const dx = tree.position.x - point.x;
            const dz = tree.position.z - point.z;
            const fallAngle = Math.atan2(dx, dz);
            this.setTreeDestroyed(tree, fallAngle);
        }
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

    setTreeDestroyed(tree: TreeProp, fallAngle: number) {
        if (tree.destroyed) return;
        tree.destroyed = true;
        tree.fallAngle = fallAngle;
        tree.intact.visible = false;
        tree.stump.visible = true;
        tree.fallen.visible = true;
        tree.fallen.rotation.y = fallAngle;

        this.collisionMeshes = this.collisionMeshes.filter((mesh) => mesh !== tree.trunk);
        this.treeByObjectId.delete(tree.trunk.id);

        if (tree.body) {
            this.physics.removeRigidBody(tree.body);
            tree.body = null;
        }

        this.fxEvents.push({
            kind: 'tree_fall',
            x: tree.position.x,
            y: 1.1,
            z: tree.position.z,
            intensity: 0.8
        });
    }

    applyHouseSectionSnapshot(house: HouseProp, sectionState: Record<string, number>) {
        for (const section of house.sections) {
            const nextHp = sectionState[section.id] ?? section.maxHp;
            const wasDestroyed = section.destroyed;
            section.hp = THREE.MathUtils.clamp(nextHp, 0, section.maxHp);
            if (section.hp <= 0) {
                this.destroyHouseSection(section, false, !wasDestroyed);
            } else {
                this.restoreHouseSection(section);
            }
        }
        if (this.shouldCollapseSectionedHouse(house)) {
            this.collapseSectionedHouse(house, false);
        } else {
            this.restoreCollapsedHouseExtras(house, false);
        }
        this.recomputeSectionedHouseState(house);
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
                this.destroyHouseSection(section, false);
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
                this.restoreHouseSection(section);
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
        if (!section.body && this.shouldSectionBlockMovement(section)) {
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
        for (const tree of this.trees) {
            tree.hp = tree.maxHp;
            tree.destroyed = false;
            tree.fallAngle = 0;
            tree.intact.visible = true;
            tree.stump.visible = false;
            tree.fallen.visible = false;
            tree.fallen.rotation.set(0, 0, 0);
            if (!tree.body) {
                const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(tree.position.x, tree.position.y + 1.7 * tree.scale, tree.position.z);
                tree.body = this.physics.createRigidBody(bodyDesc);
                const colliderDesc = RAPIER.ColliderDesc.cylinder(1.7 * tree.scale, 0.42 * tree.scale);
                this.physics.createCollider(colliderDesc, tree.body);
            }
            if (!this.collisionMeshes.includes(tree.trunk)) {
                this.collisionMeshes.push(tree.trunk);
            }
            this.treeByObjectId.set(tree.trunk.id, tree);
        }

        for (const house of this.houses) {
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
                    house.body = this.createHouseBody(house.position, house.root.rotation.y, house.bodyConfig);
                }
                this.setHouseStage(house, 0);
            }
        }
    }
}
