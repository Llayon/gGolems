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
    readonly soloSpawn: THREE.Vector3;
    readonly botSpawn: THREE.Vector3;
    readonly playerSpawns: THREE.Vector3[];

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        const arenaHalfSize = this.halfSize;
        const wallThickness = 2;
        const wallHeight = 12;
        const wallSpan = arenaHalfSize * 2 - wallThickness * 2;

        this.terrain = new TerrainBuilder(scene, physics, arenaHalfSize);
        this.soloSpawn = this.createSpawnPoint(-46, 92);
        this.botSpawn = this.createSpawnPoint(46, -92);
        this.playerSpawns = [
            this.createSpawnPoint(-92, 30),
            this.createSpawnPoint(92, -30),
            this.createSpawnPoint(-30, -92),
            this.createSpawnPoint(30, 92)
        ];

        this.createBox(scene, physics, { x: 0, z: -arenaHalfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: 0, z: arenaHalfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: -arenaHalfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: arenaHalfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: 0x2e2f39, yOffset: wallHeight / 2 });

        this.createCombatCover(scene, physics);
        this.createSteamYard(scene, physics, -90, 62);
        this.createSteamYard(scene, physics, -76, 48, 0.18, 0.85);
        this.createRuinQuarter(scene, physics, 78, 28, -0.12, 1.08);
        this.createRockArch(scene, physics, 92, -88, -0.16, 1.14);
        this.createPressureTower(scene, physics, 6, 108, 1.0);

        this.propManager = new PropManager(scene, physics, this.surfaceY.bind(this));
    }

    getCollisionMeshes() {
        return [...this.terrain.getCollisionMeshes(), ...this.meshes, ...this.propManager.getCollisionMeshes()];
    }

    surfaceY(x: number, z: number) {
        return this.terrain.sampleHeight(x, z);
    }

    createSpawnPoint(x: number, z: number) {
        return new THREE.Vector3(x, this.surfaceY(x, z) + 3.6, z);
    }

    createCombatCover(scene: THREE.Scene, physics: RAPIER.World) {
        const coverColor = 0x4d4a50;
        const configs: BoxConfig[] = [
            { x: -58, z: -26, w: 12, h: 4.4, d: 18, color: 0x51505b, yOffset: 2.2, rotationY: -0.18 },
            { x: -62, z: 24, w: 14, h: 4.6, d: 16, color: 0x51505b, yOffset: 2.3, rotationY: 0.16 },
            { x: -20, z: 58, w: 10, h: 4.2, d: 18, color: 0x565662, yOffset: 2.1 },
            { x: 18, z: -60, w: 10, h: 4.2, d: 18, color: 0x565662, yOffset: 2.1 },
            { x: 52, z: -48, w: 10, h: 4.4, d: 16, color: 0x5b5a63, yOffset: 2.2 },
            { x: 64, z: 34, w: 12, h: 4.8, d: 14, color: 0x5b5a63, yOffset: 2.4 },
            { x: 88, z: -10, w: 8, h: 3.6, d: 16, color: 0x69666e, yOffset: 1.8 },
            { x: 92, z: 18, w: 8, h: 3.6, d: 16, color: 0x69666e, yOffset: 1.8 },
            { x: -94, z: -46, w: 8, h: 3.8, d: 18, color: 0x5d5b61, yOffset: 1.9, rotationY: 0.14 },
            { x: -96, z: 14, w: 8, h: 3.8, d: 18, color: 0x5d5b61, yOffset: 1.9, rotationY: -0.14 },
            { x: -72, z: 52, w: 10, h: 4.0, d: 16, color: 0x66646b, yOffset: 2.0, rotationY: 0.08 },
            { x: 102, z: -34, w: 8, h: 3.6, d: 16, color: 0x6b696e, yOffset: 1.8, rotationY: 0.08 },
            { x: 104, z: 50, w: 8, h: 3.6, d: 16, color: 0x6b696e, yOffset: 1.8, rotationY: -0.08 },
            { x: 92, z: 72, w: 12, h: 4.2, d: 14, color: 0x706d73, yOffset: 2.1, rotationY: -0.12 },
            { x: -34, z: -72, w: 18, h: 3.2, d: 8, color: 0x5f5d64, yOffset: 1.6, rotationY: 0.1 },
            { x: 32, z: 74, w: 16, h: 3.2, d: 8, color: 0x5f5d64, yOffset: 1.6, rotationY: -0.08 }
        ];

        configs.forEach((config) => this.createBox(scene, physics, config));
    }

    createSteamYard(scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
        const root = new THREE.Group();
        root.position.set(x, this.surfaceY(x, z), z);
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

    createRuinQuarter(scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
        const root = new THREE.Group();
        root.position.set(x, this.surfaceY(x, z) + 0.2, z);
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

        this.createBoxCollider(physics, root, tower.position, 4.4 * scale, 9.6 * scale, 4.2 * scale, 0, 0, 0);
        this.createBoxCollider(physics, root, gateLeft.position, 7.8 * scale, 4.2 * scale, 1.2 * scale, 0, gateLeft.rotation.y, 0);
        this.createBoxCollider(physics, root, gateRight.position, 6.4 * scale, 3.6 * scale, 1.2 * scale, 0, gateRight.rotation.y, 0);
        this.createBoxCollider(physics, root, collapsedRoof.position, 7.6 * scale, 0.9 * scale, 5.6 * scale, collapsedRoof.rotation.x, collapsedRoof.rotation.y, collapsedRoof.rotation.z);
        this.createBoxCollider(physics, root, chimney.position, 1.2 * scale, 8.4 * scale, 1.2 * scale, 0, 0, 0);

        this.registerGroupMeshes(root);
    }

    createRockArch(scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, rotationY = 0, scale = 1) {
        const root = new THREE.Group();
        root.position.set(x, this.surfaceY(x, z) + 0.6, z);
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

        this.createBoxCollider(physics, root, leftPillar.position, 5.2 * scale, 14 * scale, 6.4 * scale, 0, 0, leftPillar.rotation.z);
        this.createBoxCollider(physics, root, rightPillar.position, 4.8 * scale, 12.8 * scale, 5.8 * scale, 0, 0, rightPillar.rotation.z);
        this.createBoxCollider(physics, root, archTop.position, 16.5 * scale, 3.2 * scale, 6.2 * scale, 0, 0, archTop.rotation.z);
        this.createCylinderCollider(physics, root, boulderA.position, 3.8 * scale, 5.8 * scale);
        this.createCylinderCollider(physics, root, boulderB.position, 3.4 * scale, 5.2 * scale);

        this.registerGroupMeshes(root);
    }

    createPressureTower(scene: THREE.Scene, physics: RAPIER.World, x: number, z: number, scale = 1) {
        const root = new THREE.Group();
        root.position.set(x, this.surfaceY(x, z) + 0.4, z);
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

        this.createBoxCollider(physics, root, base.position, 10 * scale, 3.4 * scale, 10 * scale, 0, 0, 0);
        this.createCylinderCollider(physics, root, tower.position, 2.1 * scale, 24 * scale);
        this.createCylinderCollider(physics, root, sideTankA.position, 1.7 * scale, 7.2 * scale);
        this.createCylinderCollider(physics, root, sideTankB.position, 1.7 * scale, 7.2 * scale);

        this.registerGroupMeshes(root);
    }

    registerGroupMeshes(root: THREE.Group) {
        root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                this.meshes.push(child);
            }
        });
    }

    createBox(scene: THREE.Scene, physics: RAPIER.World, config: BoxConfig) {
        const geo = new THREE.BoxGeometry(config.w, config.h, config.d);
        const mat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.94 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(config.x, this.surfaceY(config.x, config.z) + (config.yOffset ?? config.h / 2), config.z);
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
