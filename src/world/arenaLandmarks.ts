import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBoxCollider, createCylinderCollider, registerGroupMeshes } from './arenaColliders';

export type LandmarkContext = {
    surfaceY: (x: number, z: number) => number;
    meshes: THREE.Mesh[];
};

export function createRouteLandmarks(ctx: LandmarkContext, scene: THREE.Scene, physics: RAPIER.World) {
    createLaneMarker(ctx, scene, physics, -90, 78, 'steam', 1.12, 0.08);
    createLaneMarker(ctx, scene, physics, -78, -44, 'pressure', 0.96, 0);
    createLaneMarker(ctx, scene, physics, 78, -44, 'pressure', 0.96, 0);
    createLaneMarker(ctx, scene, physics, 92, 78, 'ruin', 1.12, -0.08);

    createLaneMarker(ctx, scene, physics, -82, 28, 'steam', 0.72, 0.06);
    createLaneMarker(ctx, scene, physics, 82, 30, 'ruin', 0.72, -0.06);
}

export function createLaneMarker(
    ctx: LandmarkContext,
    scene: THREE.Scene,
    physics: RAPIER.World,
    x: number,
    z: number,
    theme: 'steam' | 'pressure' | 'ruin',
    scale = 1,
    rotationY = 0
) {
    const root = new THREE.Group();
    root.position.set(x, ctx.surfaceY(x, z) + 0.18, z);
    root.rotation.y = rotationY;
    scene.add(root);

    if (theme === 'steam') {
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x55463d, roughness: 0.98 });
        const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x3d322b, roughness: 0.95 });
        const glowMaterial = new THREE.MeshStandardMaterial({ color: 0x678a91, emissive: 0x254850, emissiveIntensity: 0.9, roughness: 0.42 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(5.4 * scale, 1.2 * scale, 4.2 * scale), baseMaterial);
        base.position.set(0, 0.6 * scale, 0);
        root.add(base);

        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.72 * scale, 0.92 * scale, 12.6 * scale, 10), trimMaterial);
        stack.position.set(-0.9 * scale, 6.3 * scale, -0.4 * scale);
        root.add(stack);

        const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.05 * scale, 1.05 * scale, 1.0 * scale, 10), trimMaterial.clone());
        topCap.position.set(-0.9 * scale, 12.9 * scale, -0.4 * scale);
        root.add(topCap);

        const sideTank = new THREE.Mesh(new THREE.CylinderGeometry(0.96 * scale, 1.04 * scale, 4.4 * scale, 10), baseMaterial.clone());
        sideTank.rotation.z = Math.PI / 2;
        sideTank.position.set(0.7 * scale, 2.8 * scale, 0.2 * scale);
        root.add(sideTank);

        const pipe = new THREE.Mesh(new THREE.BoxGeometry(4.4 * scale, 0.32 * scale, 0.32 * scale), trimMaterial.clone());
        pipe.position.set(0.6 * scale, 7.8 * scale, 0.1 * scale);
        pipe.rotation.z = 0.1;
        root.add(pipe);

        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15 * scale, 1.15 * scale, 0.22 * scale), glowMaterial);
        panel.position.set(1.7 * scale, 3.1 * scale, 1.95 * scale);
        panel.rotation.y = -0.22;
        root.add(panel);

        const glowCap = new THREE.Mesh(new THREE.SphereGeometry(0.6 * scale, 10, 10), glowMaterial.clone());
        glowCap.position.set(-0.9 * scale, 13.8 * scale, -0.4 * scale);
        root.add(glowCap);

        createBoxCollider(physics, root, base.position, 5.4 * scale, 1.2 * scale, 4.2 * scale, 0, 0, 0);
        createCylinderCollider(physics, root, stack.position, 0.9 * scale, 12.6 * scale);
    } else if (theme === 'pressure') {
        const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3d34, roughness: 0.96 });
        const brassMaterial = new THREE.MeshStandardMaterial({ color: 0x8c6b3f, roughness: 0.82, metalness: 0.14 });
        const glowMaterial = new THREE.MeshStandardMaterial({ color: 0x76a197, emissive: 0x31595a, emissiveIntensity: 0.82, roughness: 0.38 });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * scale, 3.1 * scale, 1.2 * scale, 14), ironMaterial);
        base.position.set(0, 0.6 * scale, 0);
        root.add(base);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.58 * scale, 10.6 * scale, 10), brassMaterial);
        mast.position.set(0, 5.9 * scale, 0);
        root.add(mast);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 * scale, 0.18 * scale, 8, 20), ironMaterial.clone());
        ring.position.set(0, 5.3 * scale, 0);
        ring.rotation.x = Math.PI / 2;
        root.add(ring);

        const sideTankA = new THREE.Mesh(new THREE.CylinderGeometry(0.52 * scale, 0.52 * scale, 3.6 * scale, 8), brassMaterial.clone());
        sideTankA.rotation.z = Math.PI / 2;
        sideTankA.position.set(-2.0 * scale, 2.2 * scale, 0);
        root.add(sideTankA);

        const sideTankB = sideTankA.clone();
        sideTankB.position.x = 2.0 * scale;
        root.add(sideTankB);

        const cube = new THREE.Mesh(new THREE.BoxGeometry(1.15 * scale, 1.15 * scale, 1.15 * scale), glowMaterial);
        cube.position.set(0, 11.6 * scale, 0);
        root.add(cube);

        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.62 * scale, 1.18 * scale, 9.6 * scale, 10, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0xd7b26d,
                transparent: true,
                opacity: 0.12,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        beam.userData.nonCollision = true;
        beam.position.set(0, 8.6 * scale, 0);
        root.add(beam);

        createCylinderCollider(physics, root, base.position, 2.8 * scale, 1.2 * scale);
        createCylinderCollider(physics, root, mast.position, 0.6 * scale, 10.6 * scale);
    } else {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x77685a, roughness: 0.97 });
        const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x43342c, roughness: 0.98 });
        const bannerMaterial = new THREE.MeshStandardMaterial({ color: 0x8d4132, emissive: 0x4a1f1a, emissiveIntensity: 0.35, roughness: 0.84, side: THREE.DoubleSide });
        const emberMaterial = new THREE.MeshStandardMaterial({ color: 0xd7a05d, emissive: 0x7b4720, emissiveIntensity: 0.95, roughness: 0.36 });

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(5.2 * scale, 1.4 * scale, 4.2 * scale), wallMaterial);
        plinth.position.set(0, 0.7 * scale, 0);
        root.add(plinth);

        const mast = new THREE.Mesh(new THREE.BoxGeometry(1.0 * scale, 10.8 * scale, 1.0 * scale), trimMaterial);
        mast.position.set(0, 6.0 * scale, -0.2 * scale);
        root.add(mast);

        const crossbar = new THREE.Mesh(new THREE.BoxGeometry(4.6 * scale, 0.28 * scale, 0.28 * scale), trimMaterial.clone());
        crossbar.position.set(0.3 * scale, 9.4 * scale, -0.2 * scale);
        crossbar.rotation.z = -0.08;
        root.add(crossbar);

        const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.1 * scale, 4.8 * scale), bannerMaterial);
        banner.userData.nonCollision = true;
        banner.position.set(1.7 * scale, 7.4 * scale, 0.36 * scale);
        banner.rotation.set(0.04, -Math.PI / 2, 0.08);
        root.add(banner);

        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.58 * scale, 10, 10), emberMaterial);
        ember.position.set(0, 11.8 * scale, -0.2 * scale);
        root.add(ember);

        const ruinWing = new THREE.Mesh(new THREE.BoxGeometry(3.2 * scale, 3.8 * scale, 1.2 * scale), wallMaterial.clone());
        ruinWing.position.set(-2.0 * scale, 1.9 * scale, 1.0 * scale);
        ruinWing.rotation.y = 0.16;
        root.add(ruinWing);

        createBoxCollider(physics, root, plinth.position, 5.2 * scale, 1.4 * scale, 4.2 * scale, 0, 0, 0);
        createBoxCollider(physics, root, mast.position, 1.0 * scale, 10.8 * scale, 1.0 * scale, 0, 0, 0);
        createBoxCollider(physics, root, ruinWing.position, 3.2 * scale, 3.8 * scale, 1.2 * scale, 0, ruinWing.rotation.y, 0);
    }

    registerGroupMeshes(ctx.meshes, root);
}
