import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBoxCollider, createCylinderCollider, registerGroupMeshes } from './arenaColliders';

export type StructureContext = {
    surfaceY: (x: number, z: number) => number;
    meshes: THREE.Mesh[];
};

export function createSteamYard(ctx: StructureContext, scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
    const root = new THREE.Group();
    root.position.set(x, ctx.surfaceY(x, z), z);
    root.rotation.y = rotationY;
    scene.add(root);

    const tankMaterial = new THREE.MeshStandardMaterial({ color: 0x6e5a43, roughness: 0.92 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x3e3128, roughness: 0.95 });
    const glowMaterial = new THREE.MeshStandardMaterial({ color: 0x6f8c93, emissive: 0x24444d, emissiveIntensity: 0.8, roughness: 0.45 });

    const tankA = new THREE.Mesh(new THREE.CylinderGeometry(4.8 * scale, 5.4 * scale, 8 * scale, 12), tankMaterial);
    tankA.position.set(-4.5 * scale, 4 * scale, -1.5 * scale);
    tankA.castShadow = true;
    tankA.receiveShadow = true;
    root.add(tankA);

    const tankB = new THREE.Mesh(new THREE.CylinderGeometry(3.9 * scale, 4.4 * scale, 6.4 * scale, 12), tankMaterial.clone());
    tankB.position.set(5 * scale, 3.2 * scale, 2.4 * scale);
    tankB.castShadow = true;
    tankB.receiveShadow = true;
    root.add(tankB);

    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * scale, 1.6 * scale, 18 * scale, 10), trimMaterial);
    stack.position.set(-10.5 * scale, 9 * scale, 5 * scale);
    stack.castShadow = true;
    stack.receiveShadow = true;
    root.add(stack);

    const stackCap = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * scale, 1.8 * scale, 1.3 * scale, 10), trimMaterial.clone());
    stackCap.position.set(-10.5 * scale, 18.3 * scale, 5 * scale);
    stackCap.castShadow = true;
    root.add(stackCap);

    const pipe = new THREE.Mesh(new THREE.BoxGeometry(11 * scale, 0.9 * scale, 0.9 * scale), trimMaterial.clone());
    pipe.position.set(-0.2 * scale, 7.2 * scale, 2.3 * scale);
    pipe.rotation.z = 0.08;
    pipe.castShadow = true;
    root.add(pipe);

    const manifold = new THREE.Mesh(new THREE.BoxGeometry(6.5 * scale, 2 * scale, 4.5 * scale), trimMaterial.clone());
    manifold.position.set(0.5 * scale, 1 * scale, 0.6 * scale);
    manifold.castShadow = true;
    manifold.receiveShadow = true;
    root.add(manifold);

    const runePanel = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 1.2 * scale, 0.24 * scale), glowMaterial);
    runePanel.position.set(6.8 * scale, 4.6 * scale, 5.1 * scale);
    runePanel.rotation.y = -0.3;
    root.add(runePanel);

    createCylinderCollider(physics, root, tankA.position, 5.2 * scale, 8 * scale);
    createCylinderCollider(physics, root, tankB.position, 4.3 * scale, 6.4 * scale);
    createCylinderCollider(physics, root, stack.position, 1.5 * scale, 18 * scale);
    createBoxCollider(physics, root, manifold.position, 6.5 * scale, 2 * scale, 4.5 * scale, 0, 0, 0);

    for (const child of root.children) {
        if (child instanceof THREE.Mesh) {
            ctx.meshes.push(child);
        }
    }
}

export function createRuinQuarter(ctx: StructureContext, scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
    const root = new THREE.Group();
    root.position.set(x, ctx.surfaceY(x, z) + 0.2, z);
    root.rotation.y = rotationY;
    scene.add(root);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x796657, roughness: 0.96 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x43342c, roughness: 0.98 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x6a241d, roughness: 0.92 });

    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4 * scale, 9.6 * scale, 4.2 * scale), wallMaterial);
    tower.position.set(0, 4.8 * scale, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    root.add(tower);

    const brokenTop = new THREE.Mesh(new THREE.BoxGeometry(4.8 * scale, 1.4 * scale, 3.8 * scale), wallMaterial.clone());
    brokenTop.position.set(0.3 * scale, 9.8 * scale, 0.1 * scale);
    brokenTop.rotation.z = -0.16;
    brokenTop.castShadow = true;
    root.add(brokenTop);

    const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(7.8 * scale, 4.2 * scale, 1.2 * scale), wallMaterial.clone());
    gateLeft.position.set(-8.1 * scale, 2.1 * scale, 3.6 * scale);
    gateLeft.rotation.y = 0.1;
    gateLeft.castShadow = true;
    gateLeft.receiveShadow = true;
    root.add(gateLeft);

    const gateRight = new THREE.Mesh(new THREE.BoxGeometry(6.4 * scale, 3.6 * scale, 1.2 * scale), wallMaterial.clone());
    gateRight.position.set(7.6 * scale, 1.8 * scale, -3.1 * scale);
    gateRight.rotation.y = -0.14;
    gateRight.castShadow = true;
    gateRight.receiveShadow = true;
    root.add(gateRight);

    const collapsedRoof = new THREE.Mesh(new THREE.BoxGeometry(7.6 * scale, 0.9 * scale, 5.6 * scale), roofMaterial);
    collapsedRoof.position.set(-4.6 * scale, 1.4 * scale, -4.8 * scale);
    collapsedRoof.rotation.set(0.08, 0.4, -0.24);
    collapsedRoof.castShadow = true;
    collapsedRoof.receiveShadow = true;
    root.add(collapsedRoof);

    const spar = new THREE.Mesh(new THREE.BoxGeometry(10.4 * scale, 0.28 * scale, 0.28 * scale), trimMaterial);
    spar.position.set(4.8 * scale, 3.2 * scale, 5 * scale);
    spar.rotation.set(0.08, -0.52, 0.22);
    spar.castShadow = true;
    root.add(spar);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 8.4 * scale, 1.2 * scale), trimMaterial.clone());
    chimney.position.set(5.8 * scale, 4.2 * scale, -7.2 * scale);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    root.add(chimney);

    createBoxCollider(physics, root, tower.position, 4.4 * scale, 9.6 * scale, 4.2 * scale, 0, 0, 0);
    createBoxCollider(physics, root, gateLeft.position, 7.8 * scale, 4.2 * scale, 1.2 * scale, 0, gateLeft.rotation.y, 0);
    createBoxCollider(physics, root, gateRight.position, 6.4 * scale, 3.6 * scale, 1.2 * scale, 0, gateRight.rotation.y, 0);
    createBoxCollider(physics, root, collapsedRoof.position, 7.6 * scale, 0.9 * scale, 5.6 * scale, collapsedRoof.rotation.x, collapsedRoof.rotation.y, collapsedRoof.rotation.z);
    createBoxCollider(physics, root, chimney.position, 1.2 * scale, 8.4 * scale, 1.2 * scale, 0, 0, 0);

    registerGroupMeshes(ctx.meshes, root);
}

export function createRockArch(ctx: StructureContext, scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
    const root = new THREE.Group();
    root.position.set(x, ctx.surfaceY(x, z) + 0.6, z);
    root.rotation.y = rotationY;
    scene.add(root);

    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x5c4f44, roughness: 0.98 });

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(5.2 * scale, 14 * scale, 6.4 * scale), rockMaterial);
    leftPillar.position.set(-6.2 * scale, 7 * scale, 0);
    leftPillar.rotation.z = -0.08;
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    root.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(4.8 * scale, 12.8 * scale, 5.8 * scale), rockMaterial.clone());
    rightPillar.position.set(6 * scale, 6.4 * scale, -0.4 * scale);
    rightPillar.rotation.z = 0.06;
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    root.add(rightPillar);

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(16.5 * scale, 3.2 * scale, 6.2 * scale), rockMaterial.clone());
    archTop.position.set(0.2 * scale, 12.2 * scale, -0.2 * scale);
    archTop.rotation.z = 0.08;
    archTop.castShadow = true;
    archTop.receiveShadow = true;
    root.add(archTop);

    const boulderA = new THREE.Mesh(new THREE.CylinderGeometry(3.2 * scale, 4.2 * scale, 5.8 * scale, 8), rockMaterial.clone());
    boulderA.position.set(-13.2 * scale, 2.9 * scale, 4.2 * scale);
    boulderA.rotation.z = -0.18;
    boulderA.castShadow = true;
    boulderA.receiveShadow = true;
    root.add(boulderA);

    const boulderB = new THREE.Mesh(new THREE.CylinderGeometry(2.9 * scale, 3.8 * scale, 5.2 * scale, 8), rockMaterial.clone());
    boulderB.position.set(12.4 * scale, 2.6 * scale, -4.6 * scale);
    boulderB.rotation.z = 0.22;
    boulderB.castShadow = true;
    boulderB.receiveShadow = true;
    root.add(boulderB);

    createBoxCollider(physics, root, leftPillar.position, 5.2 * scale, 14 * scale, 6.4 * scale, 0, 0, leftPillar.rotation.z);
    createBoxCollider(physics, root, rightPillar.position, 4.8 * scale, 12.8 * scale, 5.8 * scale, 0, 0, rightPillar.rotation.z);
    createBoxCollider(physics, root, archTop.position, 16.5 * scale, 3.2 * scale, 6.2 * scale, 0, 0, archTop.rotation.z);
    createCylinderCollider(physics, root, boulderA.position, 3.8 * scale, 5.8 * scale);
    createCylinderCollider(physics, root, boulderB.position, 3.4 * scale, 5.2 * scale);

    registerGroupMeshes(ctx.meshes, root);
}

export function createPressureTower(ctx: StructureContext, scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, scale = 1) {
    const root = new THREE.Group();
    root.position.set(x, ctx.surfaceY(x, z) + 0.4, z);
    scene.add(root);

    const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x4e4035, roughness: 0.95 });
    const brassMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.82 });
    const runeMaterial = new THREE.MeshStandardMaterial({ color: 0x5f8489, emissive: 0x2a5155, emissiveIntensity: 0.9, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(10 * scale, 3.4 * scale, 10 * scale), ironMaterial);
    base.position.set(0, 1.7 * scale, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * scale, 2.1 * scale, 24 * scale, 12), brassMaterial);
    tower.position.set(0, 14 * scale, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    root.add(tower);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4 * scale, 0.26 * scale, 8, 24), ironMaterial.clone());
    ring.position.set(0, 10.2 * scale, 0);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    root.add(ring);

    const sideTankA = new THREE.Mesh(new THREE.CylinderGeometry(1.6 * scale, 1.6 * scale, 7.2 * scale, 10), brassMaterial.clone());
    sideTankA.position.set(-4.6 * scale, 5.2 * scale, 0);
    sideTankA.rotation.z = Math.PI / 2;
    sideTankA.castShadow = true;
    sideTankA.receiveShadow = true;
    root.add(sideTankA);

    const sideTankB = sideTankA.clone();
    sideTankB.position.x = 4.6 * scale;
    root.add(sideTankB);

    const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.8 * scale, 1.8 * scale, 1.8 * scale), runeMaterial);
    beacon.position.set(0, 26.4 * scale, 0);
    beacon.castShadow = true;
    root.add(beacon);

    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(3.1 * scale, 0.18 * scale, 8, 24), brassMaterial.clone());
    crownRing.position.set(0, 23.1 * scale, 0);
    crownRing.rotation.x = Math.PI / 2;
    root.add(crownRing);

    const finGeometry = new THREE.BoxGeometry(0.5 * scale, 4.2 * scale, 1.2 * scale);
    for (let index = 0; index < 4; index++) {
        const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
        const fin = new THREE.Mesh(finGeometry, ironMaterial.clone());
        fin.position.set(Math.cos(angle) * 2.6 * scale, 24.2 * scale, Math.sin(angle) * 2.6 * scale);
        fin.rotation.y = angle;
        fin.rotation.z = 0.12 * (index % 2 === 0 ? 1 : -1);
        root.add(fin);
    }

    const beaconBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78 * scale, 1.6 * scale, 22 * scale, 14, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0xd7b56c,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    beaconBeam.userData.nonCollision = true;
    beaconBeam.position.set(0, 17.2 * scale, 0);
    root.add(beaconBeam);

    createBoxCollider(physics, root, base.position, 10 * scale, 3.4 * scale, 10 * scale, 0, 0, 0);
    createCylinderCollider(physics, root, tower.position, 2.1 * scale, 24 * scale);
    createCylinderCollider(physics, root, sideTankA.position, 1.7 * scale, 7.2 * scale);
    createCylinderCollider(physics, root, sideTankB.position, 1.7 * scale, 7.2 * scale);

    registerGroupMeshes(ctx.meshes, root);
}
