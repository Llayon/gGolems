import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export type LayoutEntry = { x: number; z: number; rot?: number; scale?: number };

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

export type TreeProp = {
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

export type HouseProp = {
    id: string;
    root: THREE.Group;
    active: boolean;
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
    loaded: boolean;
};

export type HouseSectionProp = {
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

export type HouseSectionHit = {
    house: HouseProp;
    section: HouseSectionProp;
};

export type FallingSection = {
    root: THREE.Object3D;
    velocity: THREE.Vector3;
    spin: THREE.Vector3;
    life: number;
    settleTimer: number;
    halfHeight: number;
};

export const BREAKABLE_HOUSE_LAYOUT: LayoutEntry[] = [
    { x: 60, z: 54, rot: -0.12 },
    { x: 94, z: 48, rot: -0.08 }
];

export const PEOPLE_LAYOUT: LayoutEntry[] = [
    { x: -90, z: 42 }, { x: -78, z: 30 }, { x: -70, z: 54 }, { x: -58, z: 20 },
    { x: 56, z: 18 }, { x: 66, z: 30 }, { x: 78, z: 22 }, { x: 84, z: 46 },
    { x: 92, z: 58 }, { x: 96, z: 34 }, { x: -18, z: -8 }, { x: 12, z: 8 }
];

export const TREE_LAYOUT: LayoutEntry[] = [
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

export const HOUSE_COLLAPSIBLE_SECTION_IDS = [
    'SEC_FRONT_LEFT',
    'SEC_FRONT_CENTER',
    'SEC_FRONT_RIGHT',
    'SEC_BACK_LEFT',
    'SEC_BACK_CENTER',
    'SEC_BACK_RIGHT',
    'SEC_LEFT_SIDE',
    'SEC_RIGHT_SIDE'
];

export function markShadows(root: THREE.Object3D) {
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

export function collectMeshes(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            meshes.push(child);
        }
    });
    return meshes;
}
