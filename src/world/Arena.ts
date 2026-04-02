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
    readonly blueSpawns: THREE.Vector3[];
    readonly redSpawns: THREE.Vector3[];
    readonly controlPointPositions: Record<'A' | 'B' | 'C', THREE.Vector3>;

    constructor(scene: THREE.Scene, physics: RAPIER.World) {
        const arenaHalfSize = this.halfSize;
        const wallThickness = 2;
        const wallHeight = 12;
        const wallSpan = arenaHalfSize * 2 - wallThickness * 2;

        this.terrain = new TerrainBuilder(scene, physics, arenaHalfSize);
        this.soloSpawn = this.createSpawnPoint(-46, 92);
        this.botSpawn = this.createSpawnPoint(46, -92);
        this.blueSpawns = [
            this.createSpawnPoint(-118, -82),
            this.createSpawnPoint(-118, -42),
            this.createSpawnPoint(-118, 0),
            this.createSpawnPoint(-118, 42),
            this.createSpawnPoint(-118, 82)
        ];
        this.redSpawns = [
            this.createSpawnPoint(118, -82),
            this.createSpawnPoint(118, -42),
            this.createSpawnPoint(118, 0),
            this.createSpawnPoint(118, 42),
            this.createSpawnPoint(118, 82)
        ];
        this.playerSpawns = [
            this.createSpawnPoint(-92, 30),
            this.createSpawnPoint(92, -30),
            this.createSpawnPoint(-30, -92),
            this.createSpawnPoint(30, 92)
        ];
        this.controlPointPositions = {
            A: this.createGroundPoint(-74, 34),
            B: this.createGroundPoint(0, -18),
            C: this.createGroundPoint(76, 38)
        };

        this.createTeamBase(scene, 'blue', this.blueSpawns);
        this.createTeamBase(scene, 'red', this.redSpawns);

        this.createBox(scene, physics, { x: 0, z: -arenaHalfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: 0, z: arenaHalfSize, w: wallSpan, h: wallHeight, d: wallThickness, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: -arenaHalfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: 0x2e2f39, yOffset: wallHeight / 2 });
        this.createBox(scene, physics, { x: arenaHalfSize, z: 0, w: wallThickness, h: wallHeight, d: wallSpan, color: 0x2e2f39, yOffset: wallHeight / 2 });

        this.createCombatCover(scene, physics);
        this.createSteamYard(scene, physics, -100, 58, 0.12, 1.04);
        this.createSteamYard(scene, physics, -100, 16, -0.08, 0.84);
        this.createPressureTower(scene, physics, 8, 8, 0.92);
        this.createRuinQuarter(scene, physics, 104, 46, -0.08, 1.12);
        this.createRuinQuarter(scene, physics, 104, 18, 0.2, 0.78);
        this.createRockArch(scene, physics, 94, -86, -0.18, 1.12);
        this.createRouteLandmarks(scene, physics);

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

    createGroundPoint(x: number, z: number) {
        return new THREE.Vector3(x, this.surfaceY(x, z), z);
    }

    createTeamBase(scene: THREE.Scene, team: 'blue' | 'red', spawns: THREE.Vector3[]) {
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
        deck.position.set(anchor.x, this.surfaceY(anchor.x, anchor.z) + 0.3, anchor.z);
        deck.receiveShadow = true;
        root.add(deck);

        const deckRing = new THREE.Mesh(new THREE.RingGeometry(19.5, 22.6, 48), ringMaterial);
        deckRing.rotation.x = -Math.PI / 2;
        deckRing.position.set(anchor.x, deck.position.y + 0.08, anchor.z);
        root.add(deckRing);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, 10.5, 10), beaconMaterial);
        mast.position.set(anchor.x, this.surfaceY(anchor.x, anchor.z) + 5.4, anchor.z);
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
            pad.position.set(spawn.x, this.surfaceY(spawn.x, spawn.z) + 0.18, spawn.z);
            pad.receiveShadow = true;
            root.add(pad);

            const ring = new THREE.Mesh(new THREE.RingGeometry(4.1, 5.2, 36), ringMaterial.clone());
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(spawn.x, pad.position.y + 0.06, spawn.z);
            root.add(ring);

            const node = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.4, 8), beaconMaterial.clone());
            node.position.set(spawn.x, this.surfaceY(spawn.x, spawn.z) + 2.2, spawn.z);
            node.castShadow = true;
            root.add(node);

            const nodeTop = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), beaconMaterial.clone());
            nodeTop.position.set(spawn.x, node.position.y + 2.4, spawn.z);
            nodeTop.castShadow = true;
            root.add(nodeTop);
        }
    }

    createCombatCover(scene: THREE.Scene, physics: RAPIER.World) {
        const configs: BoxConfig[] = [
            // Spawn staging screens.
            { x: -108, z: -62, w: 10, h: 4.0, d: 12, color: 0x54535d, yOffset: 2.0, rotationY: 0.06 },
            { x: -108, z: 20, w: 10, h: 4.0, d: 12, color: 0x54535d, yOffset: 2.0, rotationY: -0.06 },
            { x: -108, z: 72, w: 10, h: 4.0, d: 12, color: 0x54535d, yOffset: 2.0, rotationY: 0.08 },
            { x: 108, z: -62, w: 10, h: 4.0, d: 12, color: 0x646167, yOffset: 2.0, rotationY: -0.06 },
            { x: 108, z: 20, w: 10, h: 4.0, d: 12, color: 0x646167, yOffset: 2.0, rotationY: 0.06 },
            { x: 108, z: 72, w: 10, h: 4.0, d: 12, color: 0x646167, yOffset: 2.0, rotationY: -0.08 },

            // Outer flank anchors.
            { x: -102, z: -18, w: 10, h: 3.8, d: 18, color: 0x5c595f, yOffset: 1.9, rotationY: -0.08 },
            { x: -98, z: 46, w: 10, h: 3.8, d: 18, color: 0x5c595f, yOffset: 1.9, rotationY: 0.08 },
            { x: 102, z: -8, w: 10, h: 3.8, d: 18, color: 0x646167, yOffset: 1.9, rotationY: 0.08 },
            { x: 98, z: 54, w: 10, h: 3.8, d: 18, color: 0x646167, yOffset: 1.9, rotationY: -0.08 },

            // A lane: boost the industrial side to better match the ruin quarter.
            { x: -74, z: 12, w: 8, h: 3.8, d: 12, color: 0x5c595f, yOffset: 1.9, rotationY: -0.12 },
            { x: -50, z: 36, w: 8, h: 3.8, d: 12, color: 0x66636a, yOffset: 1.9, rotationY: 0.08 },
            { x: -56, z: 54, w: 12, h: 4.4, d: 10, color: 0x595760, yOffset: 2.2, rotationY: 0.08 },
            { x: -58, z: 20, w: 10, h: 3.8, d: 8, color: 0x5b585f, yOffset: 1.9, rotationY: -0.14 },

            // B lane: shift from a kill bowl into a contestable mid.
            { x: -24, z: -4, w: 8, h: 3.6, d: 12, color: 0x66626a, yOffset: 1.8, rotationY: -0.08 },
            { x: -14, z: -14, w: 8, h: 4.0, d: 10, color: 0x605d63, yOffset: 2.0, rotationY: 0.16 },
            { x: -10, z: -30, w: 10, h: 3.6, d: 8, color: 0x6b666c, yOffset: 1.8, rotationY: 0.10 },
            { x: 0, z: -20, w: 8, h: 4.2, d: 8, color: 0x6a666d, yOffset: 2.1, rotationY: 0.06 },
            { x: 10, z: -30, w: 10, h: 3.6, d: 8, color: 0x6b666c, yOffset: 1.8, rotationY: -0.10 },
            { x: 14, z: -14, w: 8, h: 4.0, d: 10, color: 0x605d63, yOffset: 2.0, rotationY: -0.16 },
            { x: 24, z: -4, w: 8, h: 3.6, d: 12, color: 0x66626a, yOffset: 1.8, rotationY: 0.08 },

            // C lane: keep its identity but reduce redundant static cover.
            { x: 56, z: 24, w: 8, h: 3.8, d: 12, color: 0x635d61, yOffset: 1.9, rotationY: -0.12 },
            { x: 58, z: 54, w: 10, h: 4.4, d: 14, color: 0x6b6468, yOffset: 2.2, rotationY: 0.14 },
            { x: 74, z: 66, w: 12, h: 3.4, d: 8, color: 0x786f73, yOffset: 1.7, rotationY: 0.06 }
        ];

        configs.forEach((config) => this.createBox(scene, physics, config));
    }

    createRouteLandmarks(scene: THREE.Scene, physics: RAPIER.World) {
        this.createLaneMarker(scene, physics, -90, 78, 'steam', 1.12, 0.08);
        this.createLaneMarker(scene, physics, -78, -44, 'pressure', 0.96, 0);
        this.createLaneMarker(scene, physics, 78, -44, 'pressure', 0.96, 0);
        this.createLaneMarker(scene, physics, 92, 78, 'ruin', 1.12, -0.08);

        // Secondary gateposts frame the high route split without adding traversal complexity.
        this.createLaneMarker(scene, physics, -82, 28, 'steam', 0.72, 0.06);
        this.createLaneMarker(scene, physics, 82, 30, 'ruin', 0.72, -0.06);
    }

    createLaneMarker(
        scene: THREE.Scene,
        physics: RAPIER.World,
        x: number,
        z: number,
        theme: 'steam' | 'pressure' | 'ruin',
        scale = 1,
        rotationY = 0
    ) {
        const root = new THREE.Group();
        root.position.set(x, this.surfaceY(x, z) + 0.18, z);
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

            this.createBoxCollider(physics, root, base.position, 5.4 * scale, 1.2 * scale, 4.2 * scale, 0, 0, 0);
            this.createCylinderCollider(physics, root, stack.position, 0.9 * scale, 12.6 * scale);
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

            this.createCylinderCollider(physics, root, base.position, 2.8 * scale, 1.2 * scale);
            this.createCylinderCollider(physics, root, mast.position, 0.6 * scale, 10.6 * scale);
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

            this.createBoxCollider(physics, root, plinth.position, 5.2 * scale, 1.4 * scale, 4.2 * scale, 0, 0, 0);
            this.createBoxCollider(physics, root, mast.position, 1.0 * scale, 10.8 * scale, 1.0 * scale, 0, 0, 0);
            this.createBoxCollider(physics, root, ruinWing.position, 3.2 * scale, 3.8 * scale, 1.2 * scale, 0, ruinWing.rotation.y, 0);
        }

        this.registerGroupMeshes(root);
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

        this.createBoxCollider(physics, root, base.position, 10 * scale, 3.4 * scale, 10 * scale, 0, 0, 0);
        this.createCylinderCollider(physics, root, tower.position, 2.1 * scale, 24 * scale);
        this.createCylinderCollider(physics, root, sideTankA.position, 1.7 * scale, 7.2 * scale);
        this.createCylinderCollider(physics, root, sideTankB.position, 1.7 * scale, 7.2 * scale);

        this.registerGroupMeshes(root);
    }

    registerGroupMeshes(root: THREE.Group) {
        root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.userData.nonCollision) {
                    return;
                }
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
