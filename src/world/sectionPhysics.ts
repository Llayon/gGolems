import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    type HouseProp,
    type HouseSectionProp,
    type FallingSection,
    type PropFxEvent,
    type HouseSnapshot,
    HOUSE_COLLAPSIBLE_SECTION_IDS,
    collectMeshes
} from './propShared';
import { createSectionBody, shouldSectionBlockMovement } from './sectionedHouse';
import { removeCollisionEntries } from './houseLifecycle';

export function shouldSpawnSectionDrop(section: HouseSectionProp): boolean {
    return section.sectionType === 'wall' || section.sectionType === 'roof' || section.sectionType === 'chimney';
}

export function spawnSectionDrop(
    section: HouseSectionProp,
    scene: THREE.Scene,
    fallingSections: FallingSection[],
    impulseOrigin?: THREE.Vector3
) {
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
    scene.add(clone);

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

    fallingSections.push({
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

export function updateFallingSections(
    fallingSections: FallingSection[],
    scene: THREE.Scene,
    heightAt: (x: number, z: number) => number,
    dt: number
) {
    for (let i = fallingSections.length - 1; i >= 0; i--) {
        const piece = fallingSections[i];
        piece.life -= dt;
        piece.velocity.y -= dt * 9.6;
        piece.velocity.multiplyScalar(0.992);
        piece.root.position.addScaledVector(piece.velocity, dt);
        piece.root.rotation.x += piece.spin.x * dt;
        piece.root.rotation.y += piece.spin.y * dt;
        piece.root.rotation.z += piece.spin.z * dt;

        const groundY = heightAt(piece.root.position.x, piece.root.position.z) + piece.halfHeight;
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
            scene.remove(piece.root);
            fallingSections.splice(i, 1);
        }
    }
}

export function destroyHouseSection(
    section: HouseSectionProp,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    sectionByObjectId: Map<number, { house: HouseProp; section: HouseSectionProp }>,
    scene: THREE.Scene,
    fallingSections: FallingSection[],
    removeHp = true,
    spawnDrop = true,
    impulseOrigin?: THREE.Vector3
): boolean {
    if (section.destroyed) return false;
    section.destroyed = true;
    if (removeHp) {
        section.hp = 0;
    }
    if (spawnDrop && shouldSpawnSectionDrop(section)) {
        spawnSectionDrop(section, scene, fallingSections, impulseOrigin);
    }
    section.root.visible = false;
    removeCollisionEntries(section.collisionEntries, collisionMeshes);
    for (const mesh of section.meshes) {
        sectionByObjectId.delete(mesh.id);
    }
    if (section.body) {
        physics.removeRigidBody(section.body);
        section.body = null;
    }
    return true;
}

export function restoreHouseSection(
    section: HouseSectionProp,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    houseByObjectId: Map<number, HouseProp>,
    sectionByObjectId: Map<number, { house: HouseProp; section: HouseSectionProp }>,
    addCollision = true
) {
    if (!section.destroyed && section.body) return;
    section.destroyed = false;
    section.root.visible = true;
    if (addCollision) {
        removeCollisionEntries(section.collisionEntries, collisionMeshes);
        collisionMeshes.push(...section.collisionEntries);
    }
    for (const mesh of section.meshes) {
        const hit = houseByObjectId.get(mesh.id);
        if (hit) {
            sectionByObjectId.set(mesh.id, { house: hit, section });
        }
    }
    if (addCollision && !section.body && shouldSectionBlockMovement(section)) {
        section.body = createSectionBody(section.root, physics);
    }
}

export function shouldCollapseSectionedHouse(house: HouseProp): boolean {
    if (house.sections.length === 0) return false;
    return HOUSE_COLLAPSIBLE_SECTION_IDS.every((sectionId) => {
        const section = house.sectionById.get(sectionId);
        return !section || section.destroyed;
    });
}

export function collapseSectionedHouse(
    house: HouseProp,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    sectionByObjectId: Map<number, { house: HouseProp; section: HouseSectionProp }>,
    scene: THREE.Scene,
    fallingSections: FallingSection[],
    fxEvents: PropFxEvent[],
    recomputeState: (house: HouseProp) => void,
    emitFx = true
) {
    for (const section of house.sections) {
        if (section.sectionType === 'roof' || section.sectionType === 'chimney' || section.sectionType === 'prop') {
            destroyHouseSection(
                section, physics, collisionMeshes, sectionByObjectId,
                scene, fallingSections, false, emitFx && house.active
            );
        }
    }
    house.stage = 2;
    recomputeState(house);
    if (emitFx) {
        fxEvents.push({
            kind: 'house_collapse',
            x: house.position.x,
            y: 1.8,
            z: house.position.z,
            intensity: 1.35
        });
    }
}

export function restoreCollapsedHouseExtras(
    house: HouseProp,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    houseByObjectId: Map<number, HouseProp>,
    sectionByObjectId: Map<number, { house: HouseProp; section: HouseSectionProp }>,
    recompute = true
) {
    for (const section of house.sections) {
        if ((section.sectionType === 'roof' || section.sectionType === 'chimney' || section.sectionType === 'prop') && section.hp > 0) {
            restoreHouseSection(section, physics, collisionMeshes, houseByObjectId, sectionByObjectId, house.active);
        }
    }
    if (recompute) {
        // Recompute state handled by caller
    }
}

export function recomputeSectionedHouseState(house: HouseProp) {
    if (house.sections.length === 0) return;
    const trackedSections = house.sections.filter((section) => section.destructible && section.sectionType !== 'foundation');
    house.maxHp = trackedSections.reduce((sum, section) => sum + section.maxHp, 0);
    house.hp = trackedSections.reduce((sum, section) => sum + section.hp, 0);
    const destroyedCount = trackedSections.filter((section) => section.destroyed).length;
    if (destroyedCount === 0) {
        house.stage = 0;
    } else if (shouldCollapseSectionedHouse(house)) {
        house.stage = 2;
    } else {
        house.stage = 1;
    }
}

export function setHouseStage(
    house: HouseProp,
    stage: 0 | 1 | 2,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    fxEvents: PropFxEvent[]
) {
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

    const previousIds = new Set(house.collisionEntries.map((mesh) => mesh.id));
    collisionMeshes.splice(0, collisionMeshes.length,
        ...collisionMeshes.filter((mesh) => !previousIds.has(mesh.id)),
        ...nextCollisionEntries
    );
    house.collisionEntries = nextCollisionEntries;

    if (stage === 2 && house.body) {
        physics.removeRigidBody(house.body);
        house.body = null;
    }

    if (stage === 1 && previousStage < 1) {
        fxEvents.push({
            kind: 'house_damage',
            x: house.position.x,
            y: 1.8,
            z: house.position.z,
            intensity: 1.0
        });
    } else if (stage === 2 && previousStage < 2) {
        fxEvents.push({
            kind: 'house_collapse',
            x: house.position.x,
            y: 1.2,
            z: house.position.z,
            intensity: 1.4
        });
    }
}

export function damageHouse(house: HouseProp, damage: number, setStage: (house: HouseProp, stage: 0 | 1 | 2) => void) {
    if (house.sections.length > 0) return;
    if (house.stage === 2) return;
    house.hp = Math.max(0, house.hp - damage);

    if (house.hp <= 0) {
        setStage(house, 2);
    } else if (house.hp <= house.maxHp * 0.55) {
        setStage(house, 1);
    }
}

export function damageHouseSection(
    house: HouseProp,
    section: HouseSectionProp,
    damage: number,
    point: THREE.Vector3,
    physics: RAPIER.World,
    collisionMeshes: THREE.Mesh[],
    sectionByObjectId: Map<number, { house: HouseProp; section: HouseSectionProp }>,
    scene: THREE.Scene,
    fallingSections: FallingSection[],
    fxEvents: PropFxEvent[],
    shouldCollapse: (house: HouseProp) => boolean,
    collapseHouse: (house: HouseProp) => void,
    recomputeState: (house: HouseProp) => void
) {
    if (section.destroyed || !section.destructible) return;
    section.hp = Math.max(0, section.hp - damage);
    if (section.hp > 0) {
        recomputeState(house);
        return;
    }

    const previousStage = house.stage;
    destroyHouseSection(
        section, physics, collisionMeshes, sectionByObjectId, scene, fallingSections, true, true, point
    );
    recomputeState(house);

    if (shouldCollapse(house)) {
        collapseHouse(house);
    }

    const eventKind = house.stage === 2 && previousStage < 2 ? 'house_collapse' : 'house_damage';
    fxEvents.push({
        kind: eventKind,
        x: point.x,
        y: point.y,
        z: point.z,
        intensity: eventKind === 'house_collapse' ? 1.35 : 0.95
    });
}

export function getHouseSnapshot(houses: HouseProp[]): HouseSnapshot[] {
    return houses.map((house) => ({
        id: house.id,
        hp: house.hp,
        stage: house.stage,
        sections: house.sections.length > 0
            ? Object.fromEntries(house.sections.map((section) => [section.id, section.hp]))
            : undefined
    }));
}
