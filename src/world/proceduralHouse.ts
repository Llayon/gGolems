import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    type HouseProp,
    BREAKABLE_HOUSE_LAYOUT,
    collectMeshes,
    markShadows
} from './propShared';

export function buildProceduralHouse(
    index: number,
    layout: { x: number; z: number; rot?: number },
    heightAt: (x: number, z: number) => number,
    scene: THREE.Scene,
    physics: RAPIER.World
): { root: THREE.Group; house: HouseProp } {
    const root = new THREE.Group();
    root.position.set(layout.x, heightAt(layout.x, layout.z), layout.z);
    root.rotation.y = layout.rot ?? 0;
    scene.add(root);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7d1c18, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 1 });
    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x655648, roughness: 1 });

    const intact = buildIntactStage(wallMat, roofMat, trimMat);
    const damaged = buildDamagedStage(wallMat, roofMat, trimMat);
    const rubble = buildRubbleStage(wallMat, roofMat, trimMat, rubbleMat);

    damaged.visible = false;
    rubble.visible = false;
    root.add(intact, damaged, rubble);

    markShadows(root);

    const house: HouseProp = {
        id: `house-${index}`,
        root,
        active: true,
        intact,
        damaged,
        rubble,
        body: createHouseBody(physics, root.position, layout.rot ?? 0),
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
        // Caller wires mesh.id -> house in the manager
    }

    return { root, house };
}

function buildIntactStage(
    wallMat: THREE.MeshStandardMaterial,
    roofMat: THREE.MeshStandardMaterial,
    trimMat: THREE.MeshStandardMaterial
): THREE.Group {
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

    return intact;
}

function buildDamagedStage(
    wallMat: THREE.MeshStandardMaterial,
    roofMat: THREE.MeshStandardMaterial,
    trimMat: THREE.MeshStandardMaterial
): THREE.Group {
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

    return damaged;
}

function buildRubbleStage(
    wallMat: THREE.MeshStandardMaterial,
    roofMat: THREE.MeshStandardMaterial,
    trimMat: THREE.MeshStandardMaterial,
    rubbleMat: THREE.MeshStandardMaterial
): THREE.Group {
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

    return rubble;
}

export function createHouseBody(physics: RAPIER.World, position: THREE.Vector3, rotationY: number) {
    const houseRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y + 1.6, position.z)
        .setRotation({ x: houseRotation.x, y: houseRotation.y, z: houseRotation.z, w: houseRotation.w });
    const body = physics.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(1.8, 1.6, 1.55);
    physics.createCollider(colliderDesc, body);
    return body;
}
