import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBox, type BoxConfig } from './arenaColliders';

export type BaseContext = {
    surfaceY: (x: number, z: number) => number;
    meshes: THREE.Mesh[];
    halfSize: number;
};

export function createTeamBase(ctx: BaseContext, scene: THREE.Scene, team: 'blue' | 'red', spawns: THREE.Vector3[]) {
    const root = new THREE.Group();
    scene.add(root);

    const teamColor = team === 'blue' ? 0x5acfff : 0xff7f59;
    const glowColor = team === 'blue' ? 0x2b7c9c : 0x8e3f28;
    const trimColor = team === 'blue' ? 0x415364 : 0x61453b;
    const padMaterial = new THREE.MeshStandardMaterial({
        color: 0x33271f,
        roughness: 0.92,
        metalness: 0.08
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: teamColor,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const beaconMaterial = new THREE.MeshStandardMaterial({
        color: trimColor,
        emissive: glowColor,
        emissiveIntensity: 1.1,
        roughness: 0.55,
        metalness: 0.22
    });

    const anchor = new THREE.Vector3();
    for (const spawn of spawns) {
        anchor.add(spawn);
    }
    anchor.multiplyScalar(1 / Math.max(spawns.length, 1));

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 0.9, 24), padMaterial);
    deck.position.set(anchor.x, ctx.surfaceY(anchor.x, anchor.z) + 0.3, anchor.z);
    deck.receiveShadow = true;
    root.add(deck);

    const deckRing = new THREE.Mesh(new THREE.RingGeometry(19.5, 22.6, 48), ringMaterial);
    deckRing.rotation.x = -Math.PI / 2;
    deckRing.position.set(anchor.x, deck.position.y + 0.08, anchor.z);
    root.add(deckRing);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, 10.5, 10), beaconMaterial);
    mast.position.set(anchor.x, ctx.surfaceY(anchor.x, anchor.z) + 5.4, anchor.z);
    mast.castShadow = true;
    mast.receiveShadow = true;
    root.add(mast);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), beaconMaterial.clone());
    cap.position.set(anchor.x, mast.position.y + 5.8, anchor.z);
    cap.castShadow = true;
    root.add(cap);

    const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.28, spawns.length > 1 ? Math.abs(spawns[0].z - spawns[spawns.length - 1].z) + 8 : 12),
        new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.88 })
    );
    bridge.position.set(anchor.x, deck.position.y + 0.5, anchor.z);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    root.add(bridge);

    for (const spawn of spawns) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.9, 0.36, 18), padMaterial.clone());
        pad.position.set(spawn.x, ctx.surfaceY(spawn.x, spawn.z) + 0.18, spawn.z);
        pad.receiveShadow = true;
        root.add(pad);

        const ring = new THREE.Mesh(new THREE.RingGeometry(4.1, 5.2, 36), ringMaterial.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(spawn.x, pad.position.y + 0.06, spawn.z);
        root.add(ring);

        const node = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.4, 8), beaconMaterial.clone());
        node.position.set(spawn.x, ctx.surfaceY(spawn.x, spawn.z) + 2.2, spawn.z);
        node.castShadow = true;
        root.add(node);

        const nodeTop = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), beaconMaterial.clone());
        nodeTop.position.set(spawn.x, node.position.y + 2.4, spawn.z);
        nodeTop.castShadow = true;
        root.add(nodeTop);
    }
}

export function createArenaWalls(ctx: BaseContext, scene: THREE.Scene, physics: RAPIER.World) {
    const wallThickness = 2;
    const wallHeight = 12;
    const wallSpan = ctx.halfSize * 2 - wallThickness * 2;
    const wallColor = 0x2e2f39;

    const wallConfigs: BoxConfig[] = [
        { x: 0, z: -ctx.halfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: wallColor, yOffset: wallHeight / 2 },
        { x: 0, z: ctx.halfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: wallColor, yOffset: wallHeight / 2 },
        { x: -ctx.halfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: wallColor, yOffset: wallHeight / 2 },
        { x: ctx.halfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: wallColor, yOffset: wallHeight / 2 }
    ];

    for (const config of wallConfigs) {
        createBox(ctx, scene, physics, config);
    }
}

export function createCombatCover(ctx: BaseContext, scene: THREE.Scene, physics: RAPIER.World) {
    const configs: BoxConfig[] = [
        { x: -108, z: -62, w: 10, h: 4.0, d: 12, color: 0x54535d, yOffset: 2.0, rotationY: 0.06 },
        { x: -108, z: 20, w: 10, h: 4.0, d: 12, color: 0x54535d, yOffset: 2.0, rotationY: -0.06 },
        { x: -108, z: 72, w: 10, h: 4.0, d: 12, color: 0x54535d, yOffset: 2.0, rotationY: 0.08 },
        { x: 108, z: -62, w: 10, h: 4.0, d: 12, color: 0x646167, yOffset: 2.0, rotationY: -0.06 },
        { x: 108, z: 20, w: 10, h: 4.0, d: 12, color: 0x646167, yOffset: 2.0, rotationY: 0.06 },
        { x: 108, z: 72, w: 10, h: 4.0, d: 12, color: 0x646167, yOffset: 2.0, rotationY: -0.08 },

        { x: -102, z: -18, w: 10, h: 3.8, d: 18, color: 0x5c595f, yOffset: 1.9, rotationY: -0.08 },
        { x: -98, z: 46, w: 10, h: 3.8, d: 18, color: 0x5c595f, yOffset: 1.9, rotationY: 0.08 },
        { x: -92, z: 24, w: 12, h: 4.6, d: 16, color: 0x54535d, yOffset: 2.3, rotationY: 0.14 },
        { x: -92, z: 50, w: 10, h: 4.2, d: 14, color: 0x5a5860, yOffset: 2.1, rotationY: -0.18 },
        { x: -74, z: 12, w: 8, h: 3.8, d: 12, color: 0x5c595f, yOffset: 1.9, rotationY: -0.12 },
        { x: -50, z: 36, w: 8, h: 3.8, d: 12, color: 0x66636a, yOffset: 1.9, rotationY: 0.08 },
        { x: -56, z: 54, w: 12, h: 4.4, d: 10, color: 0x595760, yOffset: 2.2, rotationY: 0.08 },
        { x: -58, z: 20, w: 10, h: 3.8, d: 8, color: 0x5b585f, yOffset: 1.9, rotationY: -0.14 },

        { x: -32, z: -34, w: 14, h: 4.2, d: 8, color: 0x5d5a61, yOffset: 2.1, rotationY: 0.18 },
        { x: -18, z: 0, w: 10, h: 3.4, d: 12, color: 0x66626a, yOffset: 1.7, rotationY: -0.08 },
        { x: 0, z: -40, w: 12, h: 3.0, d: 6, color: 0x706b71, yOffset: 1.5, rotationY: 0.04 },
        { x: 18, z: 0, w: 10, h: 3.8, d: 12, color: 0x5f5c64, yOffset: 1.9, rotationY: -0.12 },
        { x: 34, z: -32, w: 12, h: 4.0, d: 8, color: 0x65626a, yOffset: 2.0, rotationY: 0.16 },
        { x: -6, z: 14, w: 8, h: 3.2, d: 8, color: 0x6a666d, yOffset: 1.6, rotationY: 0.1 },
        { x: 24, z: 20, w: 8, h: 3.4, d: 8, color: 0x625f67, yOffset: 1.7, rotationY: -0.08 },

        { x: 68, z: 10, w: 12, h: 3.2, d: 8, color: 0x635d61, yOffset: 1.6, rotationY: -0.12 },
        { x: 78, z: 34, w: 8, h: 2.8, d: 6, color: 0x6b6468, yOffset: 1.4, rotationY: 0.08 },
        { x: 110, z: 34, w: 8, h: 3.4, d: 12, color: 0x665f64, yOffset: 1.7, rotationY: -0.08 },
        { x: 84, z: 70, w: 12, h: 3.2, d: 8, color: 0x736b70, yOffset: 1.6, rotationY: -0.14 }
    ];

    configs.forEach((config) => createBox(ctx, scene, physics, config));
}
