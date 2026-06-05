import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WorldPropSystem } from './WorldPropSystem';
import { TerrainBuilder } from './TerrainBuilder';
import { TreeSpawner } from './TreeSpawner';
import { GroundCoverSpawner } from './GroundCoverSpawner';
import { GrassShaderSystem } from './GrassShaderSystem';
import { createTeamBase, createArenaWalls, createCombatCover } from './arenaBase';
import { createSteamYard, createRuinQuarter, createRockArch, createPressureTower } from './arenaStructures';
import { createRouteLandmarks } from './arenaLandmarks';
import { createLaneNodes, getLaneNode, type ArenaLaneNode, type ArenaLaneNodeKind, type ArenaLaneNodeSide } from './arenaLaneNodes';

export type { ArenaLaneNode, ArenaLaneNodeKind, ArenaLaneNodeSide } from './arenaLaneNodes';

export class Arena {
    meshes: THREE.Mesh[] = [];
    propManager: WorldPropSystem;
    terrain: TerrainBuilder;
    treeSpawner: TreeSpawner;
    groundCoverSpawner: GroundCoverSpawner;
    grassSystem: GrassShaderSystem;
    readonly halfSize = 132;
    readonly spawnRadius = 104;
    readonly soloSpawn: THREE.Vector3;
    readonly botSpawn: THREE.Vector3;
    readonly playerSpawns: THREE.Vector3[];
    readonly blueSpawns: THREE.Vector3[];
    readonly redSpawns: THREE.Vector3[];
    readonly controlPointPositions: Record<'A' | 'B' | 'C', THREE.Vector3>;
    readonly laneNodes: ArenaLaneNode[];

    constructor(scene: THREE.Scene, physics: RAPIER.World, camera: THREE.Camera) {
        this.terrain = new TerrainBuilder(scene, physics, this.halfSize);
        this.treeSpawner = new TreeSpawner(scene);
        this.groundCoverSpawner = new GroundCoverSpawner(scene);
        this.grassSystem = new GrassShaderSystem(scene);

        const structureCtx = { surfaceY: (x: number, z: number) => this.surfaceY(x, z), meshes: this.meshes };
        const baseCtx = { surfaceY: (x: number, z: number) => this.surfaceY(x, z), meshes: this.meshes, halfSize: this.halfSize };

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
            A: this.createGroundPoint(80, 38),
            B: this.createGroundPoint(0, -6),
            C: this.createGroundPoint(-84, 38)
        };
        this.laneNodes = createLaneNodes({ createGroundPoint: (x, z) => this.createGroundPoint(x, z) });

        createTeamBase(baseCtx, scene, 'blue', this.blueSpawns);
        createTeamBase(baseCtx, scene, 'red', this.redSpawns);
        createArenaWalls(baseCtx, scene, physics);
        createCombatCover(baseCtx, scene, physics);

        createSteamYard(structureCtx, scene, physics, -100, 58, 0.12, 1.04);
        createSteamYard(structureCtx, scene, physics, -100, 16, -0.08, 0.84);
        createPressureTower(structureCtx, scene, physics, 8, 8, 0.92);
        createRuinQuarter(structureCtx, scene, physics, 104, 46, -0.08, 1.12);
        createRuinQuarter(structureCtx, scene, physics, 104, 18, 0.2, 0.78);
        createRockArch(structureCtx, scene, physics, 94, -86, -0.18, 1.12);
        createRouteLandmarks(structureCtx, scene, physics);

        this.propManager = new WorldPropSystem(scene, physics, this.surfaceY.bind(this));
    }

    async initAsync(camera: THREE.Camera) {
        this.terrain.setupLod(camera);
        this.treeSpawner.loadAllTrees()
            .then(() => this.treeSpawner.scatter(this.surfaceY.bind(this), this.halfSize))
            .catch((e) => console.error('[Arena] Failed to load trees:', e));
        this.grassSystem.init(this.surfaceY.bind(this), this.halfSize);
        this.groundCoverSpawner.loadAll()
            .then(() => this.groundCoverSpawner.scatter(this.surfaceY.bind(this), this.halfSize))
            .catch((e) => console.error('[Arena] Failed to load ground cover:', e));
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

    getLaneNode(lane: any, kind: ArenaLaneNodeKind, team: any, side: ArenaLaneNodeSide = 'center') {
        return getLaneNode(this.laneNodes, lane, kind, team, side);
    }
}
