import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { type HouseProp, type HouseSectionProp, collectMeshes, markShadows } from './propShared';
import { createHouseBody } from './proceduralHouse';
import { shouldSectionBlockMovement } from './sectionedHouse';

export const USE_BREAKABLE_HOUSE_PROXIES = true;
export const BREAKABLE_PROXY_ACTIVATION_RADIUS = 0;

type HouseProxy = {
    root: THREE.Group;
    meshes: THREE.Mesh[];
    body: RAPIER.RigidBody | null;
    collisionEntries: THREE.Mesh[];
};

export type HouseProxyRegistry = Map<string, HouseProxy>;

export function registerHouseProxy(
    house: HouseProp,
    proxyTemplate: THREE.Group | undefined,
    scene: THREE.Scene,
    proxyState: HouseProxyRegistry,
    proxyByObjectId: Map<number, HouseProp>
) {
    if (!USE_BREAKABLE_HOUSE_PROXIES) return;
    const proxyRoot = proxyTemplate ? proxyTemplate.clone(true) : new THREE.Group();
    proxyRoot.name = `${house.id}-proxy`;
    proxyRoot.position.copy(house.position);
    proxyRoot.rotation.y = house.root.rotation.y;
    proxyRoot.visible = false;
    markShadows(proxyRoot);
    scene.add(proxyRoot);

    const meshes = collectMeshes(proxyRoot);
    const proxy: HouseProxy = {
        root: proxyRoot,
        meshes,
        body: null,
        collisionEntries: meshes
    };
    proxyState.set(house.id, proxy);
    for (const mesh of meshes) {
        proxyByObjectId.set(mesh.id, house);
    }
}

export function activateHouse(
    house: HouseProp,
    scene: THREE.Scene,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    proxyState: HouseProxyRegistry,
    restoreSection: (section: HouseSectionProp) => void,
    shouldCollapse: (house: HouseProp) => boolean,
    collapseHouse: (house: HouseProp) => void,
    restoreCollapsedExtras: (house: HouseProp) => void,
    recomputeState: (house: HouseProp) => void,
    setStage: (house: HouseProp, stage: 0 | 1 | 2) => void
) {
    if (house.active) return;
    house.active = true;
    house.root.visible = true;

    const proxy = proxyState.get(house.id);
    if (proxy) {
        proxy.root.visible = false;
        removeCollisionEntries(proxy.collisionEntries, collisionMeshes);
        if (proxy.body) {
            physics.removeRigidBody(proxy.body);
            proxy.body = null;
        }
    }

    if (house.sections.length > 0) {
        for (const section of house.sections) {
            if (section.hp > 0) {
                restoreSection(section);
            } else {
                section.root.visible = false;
            }
        }
        if (shouldCollapse(house)) {
            collapseHouse(house);
        } else {
            restoreCollapsedExtras(house);
        }
        recomputeState(house);
        return;
    }

    if (!house.body && house.stage < 2) {
        house.body = createHouseBody(physics, house.position, house.root.rotation.y);
    }
    setStage(house, house.stage);
}

export function deactivateHouse(
    house: HouseProp,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    proxyState: HouseProxyRegistry
) {
    if (!USE_BREAKABLE_HOUSE_PROXIES) return;
    if (!house.active) return;
    house.active = false;
    house.root.visible = false;

    if (house.sections.length > 0) {
        removeCollisionEntries(house.collisionEntries, collisionMeshes);
        for (const section of house.sections) {
            if (section.body) {
                physics.removeRigidBody(section.body);
                section.body = null;
            }
        }
    } else {
        removeCollisionEntries(house.collisionEntries, collisionMeshes);
        if (house.body) {
            physics.removeRigidBody(house.body);
            house.body = null;
        }
        house.collisionEntries = [];
    }

    const proxy = proxyState.get(house.id);
    if (!proxy) return;

    proxy.root.visible = true;
    removeCollisionEntries(proxy.collisionEntries, collisionMeshes);
    collisionMeshes.push(...proxy.collisionEntries);
    if (!proxy.body) {
        proxy.body = createHouseBody(physics, house.position, house.root.rotation.y);
    }
}

export function promoteNearbyHouses(
    houses: HouseProp[],
    observerPositions: THREE.Vector3[],
    activate: (house: HouseProp) => void
) {
    if (!USE_BREAKABLE_HOUSE_PROXIES) return;
    if (observerPositions.length === 0) return;
    const activationRadiusSq = BREAKABLE_PROXY_ACTIVATION_RADIUS * BREAKABLE_PROXY_ACTIVATION_RADIUS;
    for (const house of houses) {
        if (house.active) continue;
        const shouldActivate = observerPositions.some((position) => house.position.distanceToSquared(position) <= activationRadiusSq);
        if (shouldActivate) {
            activate(house);
        }
    }
}

export function removeCollisionEntries(entries: THREE.Mesh[], collisionMeshes: THREE.Mesh[]) {
    if (entries.length === 0) return;
    const entryIds = new Set(entries.map((mesh) => mesh.id));
    collisionMeshes.splice(0, collisionMeshes.length, ...collisionMeshes.filter((mesh) => !entryIds.has(mesh.id)));
}

export function replaceCollisionEntries(
    previous: THREE.Mesh[],
    next: THREE.Mesh[],
    collisionMeshes: THREE.Mesh[]
) {
    const previousIds = new Set(previous.map((mesh) => mesh.id));
    collisionMeshes.splice(0, collisionMeshes.length,
        ...collisionMeshes.filter((mesh) => !previousIds.has(mesh.id)),
        ...next
    );
}
