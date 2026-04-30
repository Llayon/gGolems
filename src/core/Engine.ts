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
import { CAMERA, ROTATION } from '../utils/constants';
import { QualityProfile, detectQualityProfile } from '../utils/quality';
import type { GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import { buildGameHudState } from './buildGameHudState';
import type { GameHudState } from './gameHudState';
import {
    buildRadarContacts as buildRadarContactsRuntime
} from './gameHudTelemetry';
import {
    fireWeaponRequests as fireWeaponRequestsRuntime,
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
import { buildClientInputPacket, readClientInputPacket } from './network/clientInputPacket';
import {
    buildAuthoritativeStateMessage,
    handlePeerConnect,
    handlePeerDisconnect,
    syncNetworkTick,
    type NetworkSyncTickContext
} from './network/NetworkSyncAdapter';
import {
    dispatchNetworkDataMessage
} from './network/NetworkMessageRuntime';
import {
    buildAuthoritativePlayerSnapshots,
    type NetworkPosition
} from './network/playerSnapshots';
import {
    buildBotSnapshots as buildBotSnapshotsRuntime,
    syncTeamBotRoster as syncTeamBotRosterRuntime,
    updateBots as updateBotsRuntime
} from './bots/BotRuntime';
import {
    queueLocalRespawn as queueLocalRespawnRuntime,
    queueRemoteRespawn as queueRemoteRespawnRuntime,
    scheduleRespawnWave as scheduleRespawnWaveRuntime,
    updateRespawns as updateRespawnsRuntime
} from './respawn/RespawnRuntime';
import {
    buildTeamOverview as buildTeamOverviewRuntime,
    createTeamScores,
    updateControlMatch
} from './match/MatchRuntime';
import {
    getUnitTeam,
    forEachEnemyPosition,
    getNearestEnemyTarget as findNearestEnemyTarget,
    type UnitLocatorContext
} from './combat/UnitLocator';
import {
    registerRecentDeath as registerSpawnDeath,
    ageRecentDeaths,
    getTeamSpawn as resolveTeamSpawnPoint,
    resolveTeamSpawn,
    getSpawnYaw as calcSpawnYaw,
    type RecentDeath
} from './respawn/SpawnSystem';
import {
    getBotObjectiveRole,
    getBotMovementTarget as calcBotMovementTarget,
    getPriorityControlPoint,
    getControlPointStagingTarget,
    getBotRetreatTarget,
    type BotObjectiveContext,
    type BotIntent
} from './bots/BotObjectiveSystem';
import { applyGameModeSettings } from './match/MatchController';
import type { PlayerRespawnState, RemotePlayerState, RespawnSessionMode } from './respawn/types';

const _weaponOrigin = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();
const _botTarget = new THREE.Vector3();
const _spawnDir = new THREE.Vector3();
const _cameraAimDir = new THREE.Vector3();

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

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
        this.teamScores = createTeamScores(gameMode, SCORE_TO_WIN);
        this.quality = detectQualityProfile();
        this.renderer = new Renderer(canvas, this.quality);
        this.input = new InputManager();
        this.network = new NetworkManager();
        this.sounds = new AudioManager();
        this.decals = new DecalManager(this.renderer.scene, this.quality);
        
        this.physicsWrapper = new Physics();
        this.physicsWrapper.initSync();
        this.physics = this.physicsWrapper.world;

        this.world = new Arena(this.renderer.scene, this.physics, this.renderer.camera);
        this.mechCamera = new MechCamera(this.renderer.camera);
        this.golem = new GolemController(this.renderer.scene, this.physics, true, localMechOptions);
        this.golem.gameCamera = this.mechCamera;
        this.particles = new ParticleManager(this.renderer.scene, this.quality);
        this.debris = new DebrisManager(this.renderer.scene, this.quality);
        this.atmosphere = new AtmosphereManager(
            this.renderer.scene,
            this.quality,
            runtimeOptions.atmosphereEnabled ?? !this.quality.isMobile
        );
        this.projectiles = new ProjectileManager(this.renderer.scene);
        this.controlPoints = new ControlPointManager(this.renderer.scene, this.world.controlPointPositions);
        this.controlPoints.setVisible(gameMode === 'control');

        if (sessionMode === 'client') {
            this.setClientMode();
        }

        this.placeGolemAtSpawn(this.golem, this.getInitialLocalSpawn());
        this.syncLocalCameraMode();
        this.sessionRuntimeAdapters = createEngineSessionRuntimeAdapters({
            getSessionMode: () => this.sessionMode,
            remotePlayers: this.remotePlayers,
            remotePlayerStates: this.remotePlayerStates,
            remoteSpawnSlots: this.remoteSpawnSlots,
            localRespawnState: this.localRespawnState,
            respawnWaves: this.respawnWaves,
            bots: this.bots,
            localPlayer: this.golem,
            mechCamera: this.mechCamera,
            projectiles: this.projectiles,
            particles: this.particles,
            sounds: this.sounds,
            teamSize: TEAM_SIZE,
            getLocalUnitId: () => this.getLocalUnitId(),
            createRemoteGolem: (options = {}) => this.createRemoteGolem(options),
            disposeRemoteGolem: (golem) => {
                this.renderer.scene.remove(golem.model);
                this.physics.removeRigidBody(golem.body);
            },
            placeGolemAtSpawn: (golem, spawn, yaw) => this.placeGolemAtSpawn(golem, spawn, yaw),
            setGolemPresence: (golem, alive) => this.setGolemPresence(golem, alive),
            allocateRemoteSpawnSlot: () => this.allocateRemoteSpawnSlot(),
            setRemotePlayerState: (id, patch) => this.setRemotePlayerState(id, patch),
            getTeamSpawn: (team, slot) => this.getTeamSpawn(team, slot),
            resolveTeamSpawn: (team, preferredSlot) => this.resolveTeamSpawn(team, preferredSlot),
            getSpawnYaw: (spawn) => this.getSpawnYaw(spawn),
            sendRemoteRespawn: (id, payload) => this.network.sendTo(id, { type: 'respawn', ...payload }),
            setTeamScores: (scores) => {
                this.teamScores = scores;
            },
            setGameMode: (mode) => this.setGameMode(mode),
            propManager: this.world.propManager,
            controlPoints: this.controlPoints,
            getMovementTarget: (botId, team, from, gameMode) => gameMode === 'control'
                ? calcBotMovementTarget(this.getBotObjectiveContext(), team, from, botId, this.bots.get(botId)?.hp ?? 100, (intent) => this.bots.get(botId)?.setIntent(intent))
                : this.getNearestEnemyTarget(team, from),
            getEngageTarget: (team, from, maxDistance) => this.getNearestEnemyTarget(team, from, maxDistance),
            createBot: (id, team, slot) => this.createBot(id, team, slot),
            destroyBot: (id) => this.destroyBot(id),
            haltHorizontalMotion: (body) => this.haltHorizontalMotion(body)
        });

        if (sessionMode !== 'client') {
            syncTeamBotRosterRuntime(this.sessionRuntimeAdapters.bot());
        }

        this.runtimeAdapters = createEngineRuntimeAdapters({
            getSessionMode: () => this.sessionMode,
            getMyId: () => this.network.myId,
            isHost: () => this.network.isHost,
            getLocalUnitId: () => this.getLocalUnitId(),
            setHitConfirmState: (next) => {
                this.hitConfirmTimer = next.hitConfirmTimer;
                this.hitTargetHp = next.hitTargetHp;
                this.hitTargetMaxHp = next.hitTargetMaxHp;
            },
            sendHitConfirm: (ownerId, payload) => {
                this.network.sendTo(ownerId, payload);
            },
            authoritativeStateContext: () => this.sessionRuntimeAdapters.authoritativeState(),
            hostClientInputContext: () => this.sessionRuntimeAdapters.hostClientInput(),
            respawnMessageContext: () => this.sessionRuntimeAdapters.respawnMessage(),
            restartMatchRequest: () => this.restartMatch(),
            restartMatchContext: () => ({
                setGameMode: (mode: GameMode) => this.setGameMode(mode),
                restartMatch: (fromNetwork = false) => this.restartMatch(fromNetwork)
            }),
            forwardFireMessage: (senderId, message) => {
                this.network.connections.forEach((conn, peerId) => {
                    if (peerId !== senderId) conn.send(message);
                });
            },
            projectiles: this.projectiles,
            remotePlayers: this.remotePlayers,
            particles: this.particles,
            sounds: this.sounds,
            golem: this.golem,
            mechCamera: this.mechCamera,
            camera: this.renderer.camera,
            broadcastFire: this.sessionMode === 'solo'
                ? undefined
                : (ownerId, shots) => {
                    this.network.broadcast({
                        type: 'fire',
                        ownerId,
                        shots
                    });
                },
            bots: this.bots,
            localPlayer: this.golem,
            getGameMode: () => this.gameMode,
            getTeamScores: () => this.teamScores,
            getUnitTeam: (id) => this.getUnitTeam(id),
            queueLocalRespawn: () => queueLocalRespawnRuntime(this.sessionRuntimeAdapters.respawn(), RESPAWN_WAVE_DELAY),
            queueRemoteRespawn: (id) => queueRemoteRespawnRuntime(this.sessionRuntimeAdapters.respawn(), id, RESPAWN_WAVE_DELAY),
            scheduleRespawnWave: (team) => scheduleRespawnWaveRuntime(this.sessionRuntimeAdapters.respawn(), team, RESPAWN_WAVE_DELAY),
            registerDeath: (team, position) => this.registerRecentDeath(team, position),
            collisionMeshes: () => this.world.getCollisionMeshes(),
            propManager: this.world.propManager,
            decals: this.decals,
            getLocalRespawnAlive: () => this.localRespawnState.alive,
            getRemotePlayerStates: () => this.remotePlayerStates,
            getListenerPosition: () => this.golem.body.translation()
        });

        this.canvas.addEventListener('click', this.onCanvasClick);

        this.setupNetwork();
    }

    createRemoteGolem(options: GolemControllerOptions = {}) {
        return new GolemController(this.renderer.scene, this.physics, false, options);
    }

    getAimTargetPoint(out: THREE.Vector3) {
        this.renderer.camera.getWorldDirection(_cameraAimDir).normalize();
        this.aimRaycaster.set(this.renderer.camera.position, _cameraAimDir);
        this.aimRaycaster.far = CAMERA.aimRayDistance;
        const hits = this.aimRaycaster.intersectObjects(this.world.getCollisionMeshes(), false);
        if (hits.length > 0) {
            return out.copy(hits[0].point);
        }
        return out.copy(this.renderer.camera.position).addScaledVector(_cameraAimDir, CAMERA.aimRayDistance);
    }

    getLocalUnitId() {
        return this.network.myId || LOCAL_PLAYER_ID;
    }

    getTeamSpawns(team: TeamId) {
        return team === 'blue' ? this.world.blueSpawns : this.world.redSpawns;
    }

    getTeamSpawn(team: TeamId, slot: number) {
        return resolveTeamSpawnPoint(this.getSpawnSystemContext(), team, slot);
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

    createBot(id: string, team: TeamId, slot: number) {
        const spawn = this.getTeamSpawn(team, slot);
        const bot = new DummyBot(
            this.renderer.scene,
            this.physics,
            id,
            team,
            spawn.x,
            spawn.y,
            spawn.z,
            this.sessionMode !== 'client',
            this.world.surfaceY.bind(this.world)
        );
        bot.respawnRadius = this.world.spawnRadius;
        this.bots.set(id, bot);
        return bot;
    }

    destroyBot(id: string) {
        const bot = this.bots.get(id);
        if (!bot) return;
        this.renderer.scene.remove(bot.mesh);
        this.physics.removeRigidBody(bot.body);
        this.bots.delete(id);
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

    restartMatch(fromNetwork = false) {
        if (this.sessionMode === 'client' && !fromNetwork) {
            this.network.sendToHost({ type: 'restartRequest' });
            return false;
        }

        this.projectiles.clear();
        this.controlPoints.reset();
        this.world.propManager.reset();
        this.hitConfirmTimer = 0;
        this.hitTargetHp = 0;
        this.hitTargetMaxHp = 100;
        this.recentDeaths = [];
        this.teamScores = createTeamScores(this.gameMode, SCORE_TO_WIN);
        this.respawnWaves = { blue: 0, red: 0 };

        this.localRespawnState.alive = true;
        this.localRespawnState.timer = 0;
        this.localRespawnState.slot = 0;

        const localSpawn = this.getTeamSpawn('blue', 0);
        this.placeGolemAtSpawn(this.golem, localSpawn);

        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            if (state) {
                const spawn = this.getTeamSpawn('blue', state.slot);
                this.placeGolemAtSpawn(player, spawn);
                this.setGolemPresence(player, true);
                this.setRemotePlayerState(id, { alive: true, timer: 0 });
            }
        });

        this.bots.forEach((bot) => { bot.mesh.visible = true; });

        this.network.broadcast({ type: 'restartMatch', mode: this.gameMode });
        this.mechCamera.addTrauma(1.5);

        return true;
    }

    getNearestEnemyTarget(team: TeamId, from: THREE.Vector3, maxDistance = Number.POSITIVE_INFINITY) {
        return findNearestEnemyTarget(this.getUnitLocatorContext(), team, from, maxDistance);
    }

    setBotIntent(botId: string, intent: BotIntent) {
        this.bots.get(botId)?.setIntent(intent);
    }

    haltHorizontalMotion(body: RAPIER.RigidBody) {
        const velocity = body.linvel();
        body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
    }

    setupNetwork() {
        this.network.onConnect = (id) => {
            console.log("Player connected:", id);
            handlePeerConnect(this.sessionRuntimeAdapters.networkPeerLifecycle(), id);
        };

        this.network.onDisconnect = (id) => {
            console.log("Player disconnected:", id);
            handlePeerDisconnect(this.sessionRuntimeAdapters.networkPeerLifecycle(), id);
        };

        this.network.onData = (id, data) => {
            const inputPacket = this.network.isHost ? readClientInputPacket(data) : null;
            dispatchNetworkDataMessage(this.runtimeAdapters.networkDataDispatch(), id, data, inputPacket);
        };
    }

    getUnitLocatorContext(): UnitLocatorContext {
        return {
            localPlayer: {
                id: this.getLocalUnitId(),
                body: this.golem.body,
                team: 'blue',
                alive: this.localRespawnState.alive
            },
            remotePlayers: new Map([...this.remotePlayers.entries()].map(([id, p]) => [id, {
                id,
                body: p.body,
                team: 'blue' as TeamId,
                alive: this.remotePlayerStates.get(id)?.alive ?? true
            }])),
            remotePlayerStates: this.remotePlayerStates,
            bots: new Map([...this.bots.entries()].map(([id, b]) => [id, {
                id,
                body: b.body,
                team: b.team,
                alive: b.alive
            }])),
            localUnitId: this.getLocalUnitId()
        };
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

    getBotObjectiveContext(): BotObjectiveContext {
        return {
            gameMode: this.gameMode,
            teamScores: this.teamScores,
            controlPoints: this.controlPoints.points,
            getLaneNode: (pointId: string, kind: ArenaLaneNodeKind, team: TeamId, side: ArenaLaneNodeSide | 'center') => this.world.getLaneNode(pointId as 'A' | 'B' | 'C', kind, team, side as ArenaLaneNodeSide),
            getNearestLaneId: (pos) => this.getNearestLaneId(pos),
            getNearestEnemyTarget: (team, from, maxDist) => this.getNearestEnemyTarget(team, from, maxDist)
        };
    }

    getNetworkSyncTickContext(matchEnded: boolean, authoritativeStateMessage?: ReturnType<typeof buildAuthoritativeStateMessage>, clientInputPacket?: ReturnType<typeof buildClientInputPacket>): NetworkSyncTickContext {
        return {
            sessionMode: this.sessionMode,
            network: this.network,
            localAlive: this.localRespawnState.alive,
            matchEnded,
            authoritativeStateMessage,
            clientInputPacket
        };
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

    getSpawnYaw(spawn: NetworkPosition) {
        _spawnDir.set(-spawn.x, 0, -spawn.z);
        if (_spawnDir.lengthSq() < 0.0001) return 0;

        if (Math.abs(_spawnDir.x) >= Math.abs(_spawnDir.z)) {
            return _spawnDir.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
        }

        return _spawnDir.z >= 0 ? Math.PI : 0;
    }

    placeGolemAtSpawn(golem: GolemController, spawn: NetworkPosition, yaw = this.getSpawnYaw(spawn)) {
        golem.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
        golem.targetPos.set(spawn.x, spawn.y, spawn.z);
        golem.legYaw = yaw;
        golem.torsoYaw = yaw;
        golem.targetLegYaw = yaw;
        golem.targetTorsoYaw = yaw;
        golem.model.position.set(spawn.x, spawn.y - 1.5, spawn.z);
        golem.legs.rotation.y = -yaw;
        golem.torso.rotation.y = -yaw;
        golem.resetSections();

        if (golem.isLocal && golem.gameCamera) {
            golem.gameCamera.aimYaw = yaw;
        }
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
        this._updateBots();
        this._updateProjectilesAndFx();
        this._handleInputActions();
        this._updateControlPoints(dt);
        this._updateCombatAndRespawn(dt);
        this._updateParticlesAndProps(dt);
        this._updateNetworkTick(dt);
        this._renderHud();
    }

    _updateCameraAndInput() {
        const { mx, my } = this.input.consumeMovement();
        this.mechCamera.onMouseMove(mx, my);
        if (this.input.consumeKey('KeyV')) {
            this.toggleCameraMode();
        }
    }

    _updateMechs(dt: number) {
        const matchEnded = this.teamScores.winner !== null;
        const canControlLocal = this.localRespawnState.alive && !matchEnded;
        let throttleInput = this.input.virtualThrottle;
        let turnInput = this.input.virtualTurn;
        if (this.input.keys['KeyW']) throttleInput += 1;
        if (this.input.keys['KeyS']) throttleInput -= 1;
        if (this.input.keys['KeyA']) turnInput -= 1;
        if (this.input.keys['KeyD']) turnInput += 1;
        throttleInput = clamp(throttleInput, -1, 1);
        turnInput = clamp(turnInput, -1, 1);

        this.golem.update(
            dt,
            this.mechCamera.aimYaw,
            canControlLocal ? throttleInput : 0,
            canControlLocal ? turnInput : 0,
            canControlLocal ? this.input.consumeKey('KeyC') || this.input.consumeVirtualAction('centerTorso') : false,
            canControlLocal ? this.input.consumeKey('KeyX') || this.input.consumeVirtualAction('stopThrottle') : false,
            this.sounds,
            this.decals
        );

        const torsoTurnSpeed = (this.golem.targetTorsoYaw - this.golem.torsoYaw) / dt;
        this.sounds.update(torsoTurnSpeed);

        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            if (state?.alive === false) return;
            player.update(dt, player.targetTorsoYaw, 0, 0, false, false, this.sounds, this.decals);
        });

        if (matchEnded) {
            this.haltHorizontalMotion(this.golem.body);
            this.remotePlayers.forEach((player) => this.haltHorizontalMotion(player.body));
        } else {
            this.projectiles.update(dt);
        }
        this.decals.update(dt);
    }

    _updateBots() {
        updateBotsRuntime(this.sessionRuntimeAdapters.bot(), 0, this.gameMode, this.teamScores.winner !== null);
    }

    _updateProjectilesAndFx() {
        this.getAimTargetPoint(_aimPoint);
    }

    _handleInputActions() {
        const matchEnded = this.teamScores.winner !== null;
        const canControlLocal = this.localRespawnState.alive && !matchEnded;
        if (!canControlLocal) return;

        const localOwnerId = this.getLocalUnitId();
        const weaponFireContext = this.runtimeAdapters.weaponFire();
        if (this.input.consumeFireGroup(1)) {
            fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireGroup(1), _aimPoint);
        }
        if (this.input.consumeFireGroup(2)) {
            fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireGroup(2), _aimPoint);
        }
        if (this.input.consumeKey('KeyQ') || this.input.consumeFireGroup(3)) {
            fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireGroup(3), _aimPoint);
        }
        if (this.input.consumeKey('KeyE') || this.input.consumeVirtualAction('alphaStrike')) {
            fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireAlpha(), _aimPoint);
        }
        if (this.input.consumeKey('ShiftLeft') || this.input.consumeVirtualAction('dash')) {
            if (this.golem.tryAction(30)) {
                this.golem.dash();
                this.mechCamera.onDash();
            }
        }
        if (this.input.consumeKey('Space') || this.input.consumeVirtualAction('vent')) {
            if (this.golem.tryAction(0)) {
                this.golem.vent(this.particles);
                this.mechCamera.addTrauma(0.5);
            }
        }
    }

    _updateControlPoints(dt: number) {
        const matchEnded = this.teamScores.winner !== null;
        const authorityMode = this.sessionMode !== 'client';
        if (authorityMode && !matchEnded && this.gameMode === 'control') {
            updateControlMatch({
                controlPoints: this.controlPoints,
                teamScores: this.teamScores,
                localPlayer: this.golem,
                localRespawnState: this.localRespawnState,
                remotePlayers: this.remotePlayers,
                remotePlayerStates: this.remotePlayerStates,
                bots: this.bots
            }, dt);
        }
    }

    _updateCombatAndRespawn(dt: number) {
        const matchEnded = this.teamScores.winner !== null;
        if (matchEnded) return;

        const authorityMode = this.sessionMode !== 'client';
        const localPlayerId = this.getLocalUnitId();
        updateProjectileCombat(this.runtimeAdapters.projectileCollision(authorityMode, localPlayerId));
        playProjectileImpactFxRuntime(this.runtimeAdapters.projectileImpactFx());

        playWorldPropFxRuntime({
            propManager: this.world.propManager,
            particles: this.particles,
            debris: this.debris,
            decals: this.decals,
            sounds: this.sounds,
            mechCamera: this.mechCamera,
            listenerPosition: this.golem.body.translation()
        });
        updateRespawnsRuntime(this.sessionRuntimeAdapters.respawn(), dt, RESPAWN_WAVE_DELAY);
    }

    _updateParticlesAndProps(dt: number) {
        this.boilerParticleTimer += dt;
        if (this.boilerParticleTimer >= this.quality.boilerParticleInterval) {
            this.boilerParticleTimer = 0;
            const boilerPos = new THREE.Vector3();
            this.golem.boiler.getWorldPosition(boilerPos);
            this.particles.emit(boilerPos.x, boilerPos.y + 0.5, boilerPos.z);
        }
        this.particles.update(dt);
        this.debris.update(dt);
        this.atmosphere.update(dt);

        const propObservers: THREE.Vector3[] = [];
        if (this.localRespawnState.alive) {
            const localPos = this.golem.body.translation();
            propObservers.push(new THREE.Vector3(localPos.x, localPos.y, localPos.z));
        }
        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            if (state && !state.alive) return;
            const pos = player.body.translation();
            propObservers.push(new THREE.Vector3(pos.x, pos.y, pos.z));
        });
        for (const bot of this.bots.values()) {
            if (!bot.alive) continue;
            const pos = bot.body.translation();
            propObservers.push(new THREE.Vector3(pos.x, pos.y, pos.z));
        }
        this.world.propManager.update(dt, propObservers);
    }

    _updateNetworkTick(dt: number) {
        const matchEnded = this.teamScores.winner !== null;
        this.networkTickTimer += dt;
        if (this.networkTickTimer < 0.05) return;
        this.networkTickTimer = 0;

        const pos = this.golem.body.translation();
        let authoritativeStateMessage: ReturnType<typeof buildAuthoritativeStateMessage> | undefined;
        let clientInputPacket: ReturnType<typeof buildClientInputPacket> | undefined;

        if (this.sessionMode === 'host') {
            const snapshotSources = [{
                id: this.getLocalUnitId(),
                position: { x: pos.x, y: pos.y, z: pos.z },
                legYaw: this.golem.legYaw,
                torsoYaw: this.golem.torsoYaw,
                chassisId: this.golem.chassis.id,
                loadoutId: this.golem.loadout.id,
                hp: this.golem.hp,
                sections: this.golem.sections,
                alive: this.localRespawnState.alive,
                respawnTimer: this.localRespawnState.timer,
                slot: this.localRespawnState.slot
            }];

            this.remotePlayers.forEach((player, id) => {
                const state = this.remotePlayerStates.get(id) ?? { alive: true, timer: 0, slot: this.remoteSpawnSlots.get(id) ?? 1, team: 'blue' as TeamId };
                const pPos = player.body.translation();
                snapshotSources.push({
                    id,
                    position: { x: pPos.x, y: pPos.y, z: pPos.z },
                    legYaw: player.legYaw,
                    torsoYaw: player.torsoYaw,
                    chassisId: player.chassis.id,
                    loadoutId: player.loadout.id,
                    hp: player.hp,
                    sections: player.sections,
                    alive: state.alive,
                    respawnTimer: state.timer,
                    slot: state.slot
                });
            });

            const playersState = buildAuthoritativePlayerSnapshots(snapshotSources);
            authoritativeStateMessage = buildAuthoritativeStateMessage({
                players: playersState,
                bots: buildBotSnapshotsRuntime(this.bots),
                mode: this.gameMode,
                points: this.controlPoints.getSnapshot(),
                scores: this.teamScores,
                props: this.world.propManager.getSnapshot()
            });
        } else if (this.sessionMode === 'client') {
            if (this.localRespawnState.alive && !matchEnded) {
                clientInputPacket = buildClientInputPacket({
                    position: { x: pos.x, y: pos.y, z: pos.z },
                    legYaw: this.golem.legYaw,
                    torsoYaw: this.golem.torsoYaw,
                    chassisId: this.golem.chassis.id,
                    loadoutId: this.golem.loadout.id
                });
            }
        }

        syncNetworkTick(this.getNetworkSyncTickContext(matchEnded, authoritativeStateMessage, clientInputPacket));
    }

    _renderHud() {
        const golemState = this.golem.getState();
        this.getAimTargetPoint(_aimPoint);
        _aimPoint.project(this.renderer.camera);

        const aimScreenX = THREE.MathUtils.clamp(_aimPoint.x, -1.2, 1.2);
        const aimScreenY = THREE.MathUtils.clamp(_aimPoint.y, -1.2, 1.2);
        const cockpitRecoil = this.mechCamera.getCockpitRecoilState();

        this.onStateUpdate(buildGameHudState({
            alive: this.localRespawnState.alive,
            golemState,
            maxSpeed: this.golem.getMaxSpeed(),
            maxTwist: ROTATION.maxTorsoTwist,
            cameraMode: this.mechCamera.mode,
            aimOffsetX: aimScreenX,
            aimOffsetY: aimScreenY,
            cockpitRecoil,
            hitConfirm: this.hitConfirmTimer,
            hitTargetHp: this.hitTargetHp,
            hitTargetMaxHp: this.hitTargetMaxHp,
            radarContacts: buildRadarContactsRuntime({
                localPlayer: this.golem,
                remotePlayers: this.remotePlayers,
                remotePlayerStates: this.remotePlayerStates,
                bots: this.bots
            }),
            gameMode: this.gameMode,
            controlPoints: this.controlPoints.getSnapshot(),
            teamScores: this.teamScores,
            teamOverview: buildTeamOverviewRuntime({
                localRespawnState: this.localRespawnState,
                remotePlayerStates: this.remotePlayerStates,
                bots: this.bots
            }),
            respawnTimer: this.localRespawnState.timer,
            terrainColliderMode: this.world.terrain.groundColliderMode,
            terrainColliderError: this.world.terrain.groundColliderError
        }));

        this.renderer.render();
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
