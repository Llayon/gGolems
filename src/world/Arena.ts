import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PropManager } from './PropManager';
import { TerrainBuilder } from './TerrainBuilder';

type BoxConfig = {
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: number;
    yOffset?: number;
    rotationY?: number;
};

export class Arena {
    meshes: THREE.Mesh[] = [];
    propManager: PropManager;
    terrain: TerrainBuilder;
    readonly halfSize = 132;
    readonly spawnRadius = 104;
    readonly soloSpawn = new THREE.Vector3(-12, 5, 88);
    readonly botSpawn = new THREE.Vector3(18, 5, -88);
    readonly playerSpawns = [
        new THREE.Vector3(-76, 5, 68),
        new THREE.Vector3(68, 5, -76),
        new THREE.Vector3(-84, 5, -60),
        new THREE.Vector3(60, 5, 76)
    ];

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        const arenaHalfSize = this.halfSize;
        const wallThickness = 2;
        const wallHeight = 12;
        const wallSpan = arenaHalfSize * 2 - wallThickness * 2;

        this.terrain = new TerrainBuilder(scene, physics, arenaHalfSize);

        this.createBox(scene, physics, { x: 0, z: -arenaHalfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: 0, z: arenaHalfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: -arenaHalfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: arenaHalfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: 0x2e2f39, yOffset: wallHeight / 2 });

        this.createCombatCover(scene, physics);
        this.createSteamYard(scene, physics, -90, 62);
        this.createSteamYard(scene, physics, -76, 48, 0.18, 0.85);

        this.propManager = new PropManager(scene, physics);
    }

    getCollisionMeshes() {
        return [...this.terrain.getCollisionMeshes(), ...this.meshes, ...this.propManager.getCollisionMeshes()];
    }

    createCombatCover(scene: THREE.Scene, physics: RAPIER.World) {
        const coverColor = 0x4d4a50;
        const configs: BoxConfig[] = [
            { x: -18, z: 0, w: 12, h: 4.8, d: 12, color: coverColor, yOffset: 2.4 },
            { x: 18, z: 0, w: 12, h: 4.8, d: 12, color: coverColor, yOffset: 2.4 },
            { x: 0, z: -28, w: 16, h: 5.6, d: 10, color: coverColor, yOffset: 2.8 },
            { x: 0, z: 28, w: 16, h: 5.6, d: 10, color: coverColor, yOffset: 2.8 },
            { x: -58, z: -26, w: 12, h: 4.4, d: 18, color: 0x51505b, yOffset: 2.2, rotationY: -0.18 },
            { x: -62, z: 24, w: 14, h: 4.6, d: 16, color: 0x51505b, yOffset: 2.3, rotationY: 0.16 },
            { x: -20, z: 58, w: 10, h: 4.2, d: 18, color: 0x565662, yOffset: 2.1 },
            { x: 18, z: -60, w: 10, h: 4.2, d: 18, color: 0x565662, yOffset: 2.1 },
            { x: 52, z: -48, w: 10, h: 4.4, d: 16, color: 0x5b5a63, yOffset: 2.2 },
            { x: 64, z: 34, w: 12, h: 4.8, d: 14, color: 0x5b5a63, yOffset: 2.4 },
            { x: 88, z: -10, w: 8, h: 3.6, d: 16, color: 0x69666e, yOffset: 1.8 },
            { x: 92, z: 18, w: 8, h: 3.6, d: 16, color: 0x69666e, yOffset: 1.8 }
        ];

        configs.forEach((config) => this.createBox(scene, physics, config));
    }

    createSteamYard(scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
        const root = new THREE.Group();
        root.position.set(x, 0, z);
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

        this.createCylinderCollider(physics, root, tankA.position, 5.2 * scale, 8 * scale);
        this.createCylinderCollider(physics, root, tankB.position, 4.3 * scale, 6.4 * scale);
        this.createCylinderCollider(physics, root, stack.position, 1.5 * scale, 18 * scale);
        this.createBoxCollider(physics, root, manifold.position, 6.5 * scale, 2 * scale, 4.5 * scale, 0, 0, 0);

        for (const child of root.children) {
            if (child instanceof THREE.Mesh) {
                this.meshes.push(child);
            }
        }
    }

    createBox(scene: THREE.Scene, physics: RAPIER.World, config: BoxConfig) {
        const geo = new THREE.BoxGeometry(config.w, config.h, config.d);
        const mat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.94 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(config.x, config.yOffset ?? config.h / 2, config.z);
        mesh.rotation.y = config.rotationY ?? 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        this.meshes.push(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
        if (mesh.rotation.y !== 0) {
            const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, mesh.rotation.y, 0));
            bodyDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
        }
        const body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(config.w / 2, config.h / 2, config.d / 2);
        physics.createCollider(colliderDesc, body);
    }

    createCylinderCollider(physics: RAPIER.World, root: THREE.Group, localPosition: THREE.Vector3, radius: number, height: number) {
        const worldPosition = localPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y).add(root.position);
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(worldPosition.x, worldPosition.y, worldPosition.z);
        const body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radius);
        physics.createCollider(colliderDesc, body);
    }

    createBoxCollider(
        physics: RAPIER.World,
        root: THREE.Group,
        localPosition: THREE.Vector3,
        w: number,
        h: number,
        d: number,
        rotationX: number,
        rotationY: number,
        rotationZ: number
    ) {
        const worldPosition = localPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y).add(root.position);
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, root.rotation.y + rotationY, rotationZ));
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
            .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
        const body = physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
        physics.createCollider(colliderDesc, body);
    }
}
