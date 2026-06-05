import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { Arena, type ArenaLaneNodeKind, type ArenaLaneNodeSide } from '../world/Arena';
import {
    GolemController,
    type GolemControllerOptions
} from '../entities/GolemController';
import { DummyBot } from '../entities/DummyBot';
import { ParticleManager } from '../fx/ParticleManager';
import { DebrisManager } from '../fx/DebrisManager';
import { DecalManager } from '../fx/DecalManager';
import { AtmosphereManager } from '../fx/AtmosphereManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { MechCamera } from '../camera/MechCamera';
import { ControlPointManager } from '../gameplay/ControlPointManager';
import { CAMERA } from '../utils/constants';
import { QualityProfile, detectQualityProfile } from '../utils/quality';
import type { GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import { buildGameHudState } from './buildGameHudState';
import type { GameHudState } from './gameHudState';
import {
    updateProjectileCombat
} from './combat/ProjectileCombatRuntime';
import {
    playProjectileImpactFx as playProjectileImpactFxRuntime
} from './combat/ProjectileCombatFxRuntime';
import { playWorldPropFx as playWorldPropFxRuntime } from './world/WorldFxRuntime';
import {
    createEngineRuntimeAdapters,
    type EngineRuntimeAdapters
} from './EngineRuntimeContexts';
import {
    createEngineSessionRuntimeAdapters,
    type EngineSessionRuntimeAdapters
} from './EngineSessionRuntimeAdapters';
import { readClientInputPacket } from './network/clientInputPacket';
import {
    handlePeerConnect,
    handlePeerDisconnect
} from './network/NetworkSyncAdapter';
import { dispatchNetworkDataMessage } from './network/NetworkMessageRuntime';
import { getUnitLocatorContext, getBotObjectiveContext } from './engineContexts';
import { setupNetworkHandlers } from './engineNetworkSetup';
import { applyGameModeSettings } from './match/MatchController';
import type { PlayerRespawnState, RemotePlayerState, RespawnSessionMode } from './respawn/types';
import {
    getTeamSpawns,
    getTeamSpawn,
    getSpawnYaw,
    placeGolemAtSpawn
} from './engineSpawn';
import { createBot, destroyBot } from './engineBotManagement';
import {
    updateMechs,
    updateCameraAndInput,
    getAimTargetPoint
} from './engineMechUpdate';
import { updateNetworkTick } from './engineNetworkTick';
import { renderHud } from './engineHudRender';
import { buildSessionAdapters, buildRuntimeAdapters } from './engineAdapterFactory';
import { handleInputActions } from './engineInputActions';
import {
    updateCombatAndRespawn,
    updateControlPoints as updateControlPointsRuntime,
    updateParticlesAndProps
} from './engineFxUpdate';
import { buildLoopContext, type EngineLoopContext } from './engineLoopContext';
import { restartMatch as restartMatchRuntime } from './engineRestartMatch';
import { initEngineSubsystems, type EngineSubsystems } from './engineInit';
import {
    queueLocalRespawn as queueLocalRespawnRuntime,
    queueRemoteRespawn as queueRemoteRespawnRuntime,
    scheduleRespawnWave as scheduleRespawnWaveRuntime,
    updateRespawns as updateRespawnsRuntime
} from './respawn/RespawnRuntime';
import { updateControlMatch, createTeamScores } from './match/MatchRuntime';
import {
    getUnitTeam,
    forEachEnemyPosition,
    getNearestEnemyTarget as findNearestEnemyTarget,
    type UnitLocatorContext
} from './combat/UnitLocator';
import {
    registerRecentDeath as registerSpawnDeath,
    ageRecentDeaths,
    resolveTeamSpawn,
    type RecentDeath
} from './respawn/SpawnSystem';
import { syncTeamBotRoster as syncTeamBotRosterRuntime } from './bots/BotRuntime';
import { updateBots as updateBotsRuntime } from './bots/BotRuntime';

type SessionMode = RespawnSessionMode;

type GameRuntimeOptions = {
    atmosphereEnabled?: boolean;
};

const TEAM_SIZE = 5;
const SCORE_TO_WIN: Record<GameMode, number> = {
    control: 200,
    tdm: 30
};
const RESPAWN_WAVE_DELAY = 8;
const LOCAL_PLAYER_ID = 'local-player';
const NETWORK_TICK_INTERVAL = 0.05;

const _aimPoint = new THREE.Vector3();

export class Game {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    input: InputManager;
    world: Arena;
    golem: GolemController;
    mechCamera: MechCamera;
    remotePlayers: Map<string, GolemController> = new Map();
    remotePlayerStates: Map<string, RemotePlayerState> = new Map();
    particles: ParticleManager;
    debris: DebrisManager;
    atmosphere: AtmosphereManager;
    projectiles: ProjectileManager;
    bots: Map<string, DummyBot> = new Map();
    controlPoints: ControlPointManager;
    spawnSafetyRaycaster = new THREE.Raycaster();
    physicsWrapper: Physics;
    physics: RAPIER.World;
    network: NetworkManager;
    sounds: AudioManager;
    decals: DecalManager;
    quality: QualityProfile;
    aimRaycaster = new THREE.Raycaster();
    onStateUpdate: (state: GameHudState) => void;
    sessionMode: SessionMode;
    gameMode: GameMode;
    remoteSpawnSlots: Map<string, number> = new Map();
    teamScores: TeamScoreState = { blue: 0, red: 0, scoreToWin: SCORE_TO_WIN.control, winner: null };
    localRespawnState: PlayerRespawnState = { alive: true, timer: 0, slot: 0 };
    respawnWaves: Record<TeamId, number> = { blue: 0, red: 0 };
    recentDeaths: RecentDeath[] = [];
    hitConfirmTimer = 0;
    hitTargetHp = 0;
    hitTargetMaxHp = 100;
    lastTime = 0;
    isRunning = false;
    animationFrameId = 0;
    networkTickTimer = 0;
    boilerParticleTimer = 0;
    runtimeAdapters!: EngineRuntimeAdapters;
    sessionRuntimeAdapters!: EngineSessionRuntimeAdapters;
    loopContext!: EngineLoopContext;
    teamSize = TEAM_SIZE;
    onCanvasClick = () => {
        this.canvas.requestPointerLock();
        this.sounds.init();
    };
    localMechOptions: GolemControllerOptions;

    constructor(
        canvas: HTMLCanvasElement,
        onStateUpdate: (state: GameHudState) => void,
        sessionMode: SessionMode = 'solo',
        gameMode: GameMode = 'control',
        localMechOptions: GolemControllerOptions = {},
        runtimeOptions: GameRuntimeOptions = {}
    ) {
        this.canvas = canvas;
        this.onStateUpdate = onStateUpdate;
        this.sessionMode = sessionMode;
        this.gameMode = gameMode;
        this.localMechOptions = localMechOptions;

        const { subsystems, teamScores } = initEngineSubsystems(
            canvas, gameMode, SCORE_TO_WIN, localMechOptions, runtimeOptions
        );
        Object.assign(this, subsystems);
        this.teamScores = teamScores;

        if (sessionMode === 'client') {
            this.setClientMode();
        }

        this.placeGolemAtSpawn(this.golem, this.getInitialLocalSpawn());
        this.syncLocalCameraMode();
        this.sessionRuntimeAdapters = buildSessionAdapters(this);

        if (sessionMode !== 'client') {
            syncTeamBotRosterRuntime(this.sessionRuntimeAdapters.bot());
        }

        this.runtimeAdapters = buildRuntimeAdapters(this);
        this.loopContext = buildLoopContext(this);

        this.canvas.addEventListener('click', this.onCanvasClick);
        this.setupNetwork();
    }

    setHitConfirmState: (state: { hitConfirmTimer: number; hitTargetHp: number; hitTargetMaxHp: number }) => void = (next) => {
        this.hitConfirmTimer = next.hitConfirmTimer;
        this.hitTargetHp = next.hitTargetHp;
        this.hitTargetMaxHp = next.hitTargetMaxHp;
    };

    createRemoteGolem(options: GolemControllerOptions = {}) {
        return new GolemController(this.renderer.scene, this.physics, false, options);
    }

    getAimTargetPoint(out: THREE.Vector3) {
        return getAimTargetPoint(
            out, this.renderer.camera, this.aimRaycaster,
            this.world.getCollisionMeshes(), CAMERA.aimRayDistance
        );
    }

    getLocalUnitId() {
        return this.network.myId || LOCAL_PLAYER_ID;
    }

    getTeamSpawns(team: TeamId) {
        return getTeamSpawns(this.world, team);
    }

    getTeamSpawn(team: TeamId, slot: number) {
        return getTeamSpawn(this.world.blueSpawns, this.world.redSpawns, team, slot);
    }

    registerRecentDeath(team: TeamId, position: { x: number; y: number; z: number }) {
        registerSpawnDeath(this.recentDeaths, team, position);
    }

    getNearestLaneId(position: THREE.Vector3) {
        let bestLane: 'A' | 'B' | 'C' = 'B';
        let bestDistanceSq = Number.POSITIVE_INFINITY;
        (['A', 'B', 'C'] as const).forEach((laneId) => {
            const distanceSq = position.distanceToSquared(this.world.controlPointPositions[laneId]);
            if (distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestLane = laneId;
            }
        });
        return bestLane;
    }

    forEachEnemyPosition(team: TeamId, callback: (position: THREE.Vector3) => void) {
        forEachEnemyPosition(this.getUnitLocatorContext(), team, callback);
    }

    resolveTeamSpawn(team: TeamId, preferredSlot: number) {
        return resolveTeamSpawn(this.getSpawnSystemContext(), team, preferredSlot);
    }

    private getBotSpawnContext() {
        return {
            scene: this.renderer.scene,
            physics: this.physics,
            bots: this.bots,
            sessionMode: this.sessionMode,
            surfaceY: this.world.surfaceY.bind(this.world),
            spawnRadius: this.world.spawnRadius
        };
    }

    createBot(id: string, team: TeamId, slot: number) {
        return createBot(this.getBotSpawnContext(), id, team, this.getTeamSpawn(team, slot));
    }

    destroyBot(id: string) {
        destroyBot(this.getBotSpawnContext(), id);
    }

    setGolemPresence(golem: GolemController, alive: boolean) {
        if (golem.isLocal) {
            golem.model.visible = alive && this.mechCamera.mode === 'thirdPerson';
        } else {
            golem.model.visible = alive;
        }
        if (!alive) {
            golem.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
    }

    setRemotePlayerState(id: string, patch: Partial<RemotePlayerState>) {
        const current = this.remotePlayerStates.get(id) ?? { alive: true, timer: 0, slot: 1, team: 'blue' as TeamId };
        this.remotePlayerStates.set(id, { ...current, ...patch });
    }

    getUnitTeam(id: string): TeamId {
        return getUnitTeam(id, this.getLocalUnitId(), this.remotePlayers, this.remotePlayerStates);
    }

    setGameMode(mode: GameMode) {
        this.gameMode = mode;
        applyGameModeSettings(this.controlPoints, this.teamScores, mode, SCORE_TO_WIN);
    }

    setTeamScores(scores: TeamScoreState) {
        this.teamScores = scores;
    }

    restartMatch(fromNetwork = false) {
        return restartMatchRuntime({
            sessionMode: this.sessionMode,
            gameMode: this.gameMode,
            projectiles: this.projectiles,
            controlPoints: this.controlPoints,
            propManager: this.world.propManager,
            mechCamera: this.mechCamera,
            golem: this.golem,
            remotePlayers: this.remotePlayers,
            remotePlayerStates: this.remotePlayerStates,
            bots: this.bots,
            localRespawnState: this.localRespawnState,
            setHitConfirmTimer: (v) => { this.hitConfirmTimer = v; },
            setHitTargetHp: (v) => { this.hitTargetHp = v; },
            setHitTargetMaxHp: (v) => { this.hitTargetMaxHp = v; },
            setRecentDeaths: (v) => { this.recentDeaths = v; },
            setTeamScores: (v) => { this.teamScores = v; },
            setRespawnWaves: (v) => { this.respawnWaves = v; },
            getTeamSpawn: (team, slot) => this.getTeamSpawn(team, slot),
            placeGolemAtSpawn: (golem, spawn, yaw) => this.placeGolemAtSpawn(golem, spawn, yaw),
            setGolemPresence: (golem, alive) => this.setGolemPresence(golem, alive),
            setRemotePlayerState: (id, patch) => this.setRemotePlayerState(id, patch),
            network: this.network,
            scoreToWin: SCORE_TO_WIN
        }, fromNetwork);
    }

    getNearestEnemyTarget(team: TeamId, from: THREE.Vector3, maxDistance = Number.POSITIVE_INFINITY) {
        return findNearestEnemyTarget(this.getUnitLocatorContext(), team, from, maxDistance);
    }

    haltHorizontalMotion(body: RAPIER.RigidBody) {
        const velocity = body.linvel();
        body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
    }

    setupNetwork() {
        setupNetworkHandlers(this.network, this.runtimeAdapters, this.sessionRuntimeAdapters);
    }

    getUnitLocatorContext(): UnitLocatorContext {
        return getUnitLocatorContext(this);
    }

    getSpawnSystemContext() {
        return {
            getTeamSpawns: (team: TeamId) => this.getTeamSpawns(team),
            controlPointPositions: this.world.controlPointPositions,
            controlPoints: this.controlPoints.points,
            getControlPoints: () => this.controlPoints.points,
            forEachEnemyPosition: (team: TeamId, cb: (pos: THREE.Vector3) => void) => this.forEachEnemyPosition(team, cb),
            recentDeaths: this.recentDeaths,
            collisionMeshes: () => this.world.getCollisionMeshes()
        };
    }

    getBotObjectiveContext() {
        return getBotObjectiveContext(this);
    }

    setClientMode() {
        this.sessionMode = 'client';
        this.localRespawnState.slot = 1;
    }

    getInitialLocalSpawn() {
        return this.getTeamSpawn('blue', this.sessionMode === 'client' ? this.localRespawnState.slot : 0);
    }

    getPlayerSpawn(slot: number) {
        return this.getTeamSpawn('blue', slot);
    }

    getSpawnYaw(spawn: { x: number; y: number; z: number }) {
        return getSpawnYaw(spawn);
    }

    placeGolemAtSpawn(golem: GolemController, spawn: { x: number; y: number; z: number }, yaw?: number) {
        placeGolemAtSpawn(golem, spawn, yaw);
    }

    syncLocalCameraMode() {
        this.golem.model.visible = this.localRespawnState.alive && this.mechCamera.mode === 'thirdPerson';
    }

    setCameraMode(mode: 'cockpit' | 'thirdPerson') {
        this.mechCamera.setMode(mode);
        this.syncLocalCameraMode();
        return this.mechCamera.mode;
    }

    toggleCameraMode() {
        const mode = this.mechCamera.toggleMode();
        this.syncLocalCameraMode();
        return mode;
    }

    setAtmosphereEnabled(enabled: boolean) {
        this.atmosphere.setEnabled(enabled);
        return this.atmosphere.enabled;
    }

    allocateRemoteSpawnSlot() {
        for (let slot = 1; slot < TEAM_SIZE; slot++) {
            if (![...this.remoteSpawnSlots.values()].includes(slot)) {
                return slot;
            }
        }
        return ((this.remotePlayers.size - 1) % Math.max(1, TEAM_SIZE - 1)) + 1;
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('click', this.onCanvasClick);
        this.input.dispose();
        this.network.destroy();
        this.sounds.dispose();
        this.atmosphere.dispose();
        this.renderer.dispose();
    }

    loop = (time: number) => {
        if (!this.isRunning) return;
        this.animationFrameId = requestAnimationFrame(this.loop);

        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        this.hitConfirmTimer = Math.max(0, this.hitConfirmTimer - dt);
        this.recentDeaths = ageRecentDeaths(this.recentDeaths, dt);

        this.physics.step();
        this.world.terrain.update();
        this._updateCameraAndInput();
        this._updateMechs(dt);
        this._updateBots(dt);
        this._updateProjectilesAndFx();
        this._handleInputActions();
        this._updateControlPoints(dt);
        this._updateCombatAndRespawn(dt);
        this._updateParticlesAndProps(dt);
        this._updateNetworkTick(dt);
        this._renderHud();
    }

    _updateCameraAndInput() {
        updateCameraAndInput(this.input, this.mechCamera, () => this.toggleCameraMode());
    }

    _updateMechs(dt: number) {
        updateMechs(this.loopContext.mechContext(), dt);
    }

    _updateBots(dt: number) {
        updateBotsRuntime(this.sessionRuntimeAdapters.bot(), dt, this.gameMode, this.teamScores.winner !== null);
    }

    _updateProjectilesAndFx() {
        this.getAimTargetPoint(_aimPoint);
    }

    _handleInputActions() {
        handleInputActions(this.loopContext.inputContext());
    }

    _updateControlPoints(dt: number) {
        updateControlPointsRuntime(this.loopContext.controlPointContext(), dt);
    }

    _updateCombatAndRespawn(dt: number) {
        updateCombatAndRespawn(this.loopContext.combatContext(), dt);
    }

    _updateParticlesAndProps(dt: number) {
        updateParticlesAndProps(this.loopContext.particlesContext(), dt);
    }

    _updateNetworkTick(dt: number) {
        updateNetworkTick(this.loopContext.networkContext(), dt);
    }

    _renderHud() {
        renderHud(this.loopContext.hudContext());
    }
}

export async function initGame(
    canvas: HTMLCanvasElement,
    onStateUpdate: (state: GameHudState) => void,
    sessionMode: SessionMode = 'solo',
    gameMode: GameMode = 'control',
    localMechOptions: GolemControllerOptions = {},
    runtimeOptions: GameRuntimeOptions = {}
) {
    await RAPIER.init();
    const game = new Game(canvas, onStateUpdate, sessionMode, gameMode, localMechOptions, runtimeOptions);
    await game.world.initAsync(game.renderer.camera);
    game.start();
    return game;
}
