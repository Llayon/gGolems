import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { NetworkManager } from '../network/NetworkManager';
import { Arena } from '../world/Arena';
import {
    GolemController,
    type GolemControllerOptions
} from '../entities/GolemController';
import { DummyBot } from '../entities/DummyBot';
import { ParticleManager } from '../fx/ParticleManager';
import { DebrisManager } from '../fx/DebrisManager';
import { DecalManager } from '../fx/DecalManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { MechCamera } from '../camera/MechCamera';
import { ControlPointManager } from '../gameplay/ControlPointManager';
import { CAMERA, ROTATION } from '../utils/constants';
import { QualityProfile, detectQualityProfile } from '../utils/quality';
import type { BotStateView, GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import { buildGameHudState } from './buildGameHudState';
import type { GameHudState } from './gameHudState';
import {
    buildRadarContacts as buildRadarContactsRuntime
} from './gameHudTelemetry';
import {
    fireWeaponRequests as fireWeaponRequestsRuntime,
    spawnShot as spawnShotRuntime,
    updateProjectileCombat
} from './combat/ProjectileCombatRuntime';
import {
    playProjectileImpactFx as playProjectileImpactFxRuntime,
    playWeaponVolleyFx as playWeaponVolleyFxRuntime
} from './combat/ProjectileCombatFxRuntime';
import { playWorldPropFx as playWorldPropFxRuntime } from './world/WorldFxRuntime';
import {
    createNetworkDataDispatchContext,
    createProjectileCollisionRuntimeContext,
    createProjectileImpactFxContext,
    createWeaponFireRuntimeContext
} from './EngineRuntimeContexts';
import { buildClientInputPacket, readClientInputPacket } from './network/clientInputPacket';
import {
    type RemotePlayerLifecycleContext
} from './network/RemotePlayerLifecycleRuntime';
import {
    buildAuthoritativeStateMessage,
    handlePeerConnect,
    handlePeerDisconnect,
    syncNetworkTick,
    type NetworkPeerLifecycleContext,
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
    applyBotSnapshots as applyBotSnapshotsRuntime,
    buildBotSnapshots as buildBotSnapshotsRuntime,
    syncTeamBotRoster as syncTeamBotRosterRuntime,
    updateBots as updateBotsRuntime,
    type BotRuntimeContext,
    type BotShotView
} from './bots/BotRuntime';
import {
    applyTeamWaveTimer as applyTeamWaveTimerRuntime,
    queueLocalRespawn as queueLocalRespawnRuntime,
    queueRemoteRespawn as queueRemoteRespawnRuntime,
    resolveRespawnWave as resolveRespawnWaveRuntime,
    scheduleRespawnWave as scheduleRespawnWaveRuntime,
    teamHasPendingRespawns as teamHasPendingRespawnsRuntime,
    updateRespawns as updateRespawnsRuntime,
    type RespawnRuntimeContext
} from './respawn/RespawnRuntime';
import {
    applyGameModeSettings,
    buildTeamOverview as buildTeamOverviewRuntime,
    createTeamScores,
    restartMatchSession,
    updateControlMatch
} from './match/MatchRuntime';
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
    projectiles: ProjectileManager;
    bots: Map<string, DummyBot> = new Map();
    controlPoints: ControlPointManager;
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
    hitConfirmTimer = 0;
    hitTargetHp = 0;
    hitTargetMaxHp = 100;
    
    lastTime = 0;
    isRunning = false;
    animationFrameId = 0;
    networkTickTimer = 0;
    boilerParticleTimer = 0;
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
        localMechOptions: GolemControllerOptions = {}
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

        this.world = new Arena(this.renderer.scene, this.physics);
        this.mechCamera = new MechCamera(this.renderer.camera);
        this.golem = new GolemController(this.renderer.scene, this.physics, true, localMechOptions);
        this.golem.gameCamera = this.mechCamera;
        this.particles = new ParticleManager(this.renderer.scene, this.quality);
        this.debris = new DebrisManager(this.renderer.scene, this.quality);
        this.projectiles = new ProjectileManager(this.renderer.scene);
        this.controlPoints = new ControlPointManager(this.renderer.scene, this.world.controlPointPositions);
        this.controlPoints.setVisible(gameMode === 'control');

        if (sessionMode === 'client') {
            this.setClientMode();
        }

        this.placeGolemAtSpawn(this.golem, this.getInitialLocalSpawn());
        this.syncLocalCameraMode();
        if (sessionMode !== 'client') {
            this.syncTeamBotRoster();
        }

        this.canvas.addEventListener('click', this.onCanvasClick);

        this.setupNetwork();
    }

    createRemoteGolem(options: GolemControllerOptions = {}) {
        return new GolemController(this.renderer.scene, this.physics, false, options);
    }

    getRemotePlayerLifecycleContext(): RemotePlayerLifecycleContext {
        return {
            remotePlayers: this.remotePlayers,
            createRemoteGolem: (options = {}) => this.createRemoteGolem(options),
            disposeRemoteGolem: (golem) => {
                this.renderer.scene.remove(golem.model);
                this.physics.removeRigidBody(golem.body);
            },
            placeGolemAtSpawn: (golem, spawn, yaw) => this.placeGolemAtSpawn(golem, spawn, yaw),
            setGolemPresence: (golem, alive) => this.setGolemPresence(golem, alive)
        };
    }

    getNetworkPeerLifecycleContext(): NetworkPeerLifecycleContext {
        return {
            sessionMode: this.sessionMode,
            lifecycle: this.getRemotePlayerLifecycleContext(),
            remotePlayerStates: this.remotePlayerStates,
            remoteSpawnSlots: this.remoteSpawnSlots,
            allocateRemoteSpawnSlot: () => this.allocateRemoteSpawnSlot(),
            setRemotePlayerState: (id, patch) => this.setRemotePlayerState(id, patch),
            getTeamSpawn: (team, slot) => this.getTeamSpawn(team, slot),
            getSpawnYaw: (spawn) => this.getSpawnYaw(spawn),
            placeGolemAtSpawn: (golem, spawn, yaw) => this.placeGolemAtSpawn(golem, spawn, yaw),
            sendRespawn: (id, payload) => this.network.sendTo(id, { type: 'respawn', ...payload }),
            syncTeamBotRoster: () => this.syncTeamBotRoster()
        };
    }

    getAuthoritativeStateRuntimeContext() {
        return {
            propManager: this.world.propManager,
            controlPoints: this.controlPoints,
            setTeamScores: (scores: TeamScoreState) => {
                this.teamScores = scores;
            },
            setGameMode: (mode: GameMode) => this.setGameMode(mode),
            applyBotSnapshots: (botStates: BotStateView[]) => this.applyBotSnapshots(botStates),
            lifecycle: this.getRemotePlayerLifecycleContext(),
            remotePlayerStates: this.remotePlayerStates,
            setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => this.setRemotePlayerState(id, patch),
            getLocalUnitId: () => this.getLocalUnitId(),
            localPlayer: this.golem,
            mechCamera: this.mechCamera,
            localRespawnState: this.localRespawnState,
            setGolemPresence: (golem: GolemController, alive: boolean) => this.setGolemPresence(golem, alive)
        };
    }

    getHostClientInputRuntimeContext() {
        return {
            remotePlayerStates: this.remotePlayerStates,
            lifecycle: this.getRemotePlayerLifecycleContext()
        };
    }

    getRespawnMessageRuntimeContext() {
        return {
            localRespawnState: this.localRespawnState,
            localPlayer: this.golem,
            mechCamera: this.mechCamera,
            setGolemPresence: (golem: GolemController, alive: boolean) => this.setGolemPresence(golem, alive)
        };
    }

    getMatchRestartContext() {
        return {
            sessionMode: this.sessionMode,
            gameMode: this.gameMode,
            scoreToWinByMode: SCORE_TO_WIN,
            projectiles: this.projectiles,
            controlPoints: this.controlPoints,
            propManager: this.world.propManager,
            resetHitConfirm: () => {
                this.hitConfirmTimer = 0;
                this.hitTargetHp = 0;
                this.hitTargetMaxHp = 100;
            },
            setTeamScores: (scores: TeamScoreState) => {
                this.teamScores = scores;
            },
            setRespawnWaves: (waves: Record<TeamId, number>) => {
                this.respawnWaves = waves;
            },
            localRespawnState: this.localRespawnState,
            localPlayer: this.golem,
            remotePlayers: this.remotePlayers,
            remotePlayerStates: this.remotePlayerStates,
            remoteSpawnSlots: this.remoteSpawnSlots,
            bots: this.bots,
            getTeamSpawn: (team: TeamId, slot: number) => this.getTeamSpawn(team, slot),
            placeGolemAtSpawn: (golem: GolemController, spawn: NetworkPosition) => this.placeGolemAtSpawn(golem, spawn),
            setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => this.setRemotePlayerState(id, patch),
            setGolemPresence: (golem: GolemController, alive: boolean) => this.setGolemPresence(golem, alive),
            sendRespawn: (id: string, payload: { x: number; y: number; z: number; yaw: number; slot: number }) => {
                this.network.sendTo(id, { type: 'respawn', ...payload });
            },
            getSpawnYaw: (spawn: NetworkPosition) => this.getSpawnYaw(spawn),
            broadcastRestart: () => {
                this.network.broadcast({ type: 'restartMatch', mode: this.gameMode });
            },
            addCameraTrauma: (amount: number) => this.mechCamera.addTrauma(amount)
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

    setGameMode(mode: GameMode) {
        this.gameMode = mode;
        applyGameModeSettings(this.controlPoints, this.teamScores, mode, SCORE_TO_WIN);
    }

    restartMatch(fromNetwork = false) {
        if (this.sessionMode === 'client' && !fromNetwork) {
            this.network.sendToHost({ type: 'restartRequest' });
            return false;
        }

        restartMatchSession(this.getMatchRestartContext());

        return true;
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
        const spawns = this.getTeamSpawns(team);
        return spawns[slot % spawns.length].clone();
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

    getBotRuntimeContext(): BotRuntimeContext {
        return {
            bots: this.bots,
            sessionMode: this.sessionMode,
            teamSize: TEAM_SIZE,
            localRespawnSlot: this.localRespawnState.slot,
            remoteSpawnSlots: this.remoteSpawnSlots,
            createBot: (id, team, slot) => this.createBot(id, team, slot),
            destroyBot: (id) => this.destroyBot(id),
            getMovementTarget: (team, from, gameMode) => gameMode === 'control'
                ? this.getBotMovementTarget(team, from)
                : this.getNearestEnemyTarget(team, from),
            getEngageTarget: (team, from, maxDistance) => this.getNearestEnemyTarget(team, from, maxDistance),
            fireShot: (shot: BotShotView, ownerId: string) => spawnShotRuntime(this.projectiles, {
                weaponId: shot.weaponId,
                mountId: undefined,
                profile: shot.profile,
                ox: shot.origin.x,
                oy: shot.origin.y,
                oz: shot.origin.z,
                dx: shot.dir.x,
                dy: shot.dir.y,
                dz: shot.dir.z,
                damage: shot.damage,
                speed: shot.speed,
                range: shot.range
            }, ownerId),
            playWeaponVolleyFx: (shots) => playWeaponVolleyFxRuntime({
                particles: this.particles,
                sounds: this.sounds
            }, shots),
            haltHorizontalMotion: (body) => this.haltHorizontalMotion(body)
        };
    }

    syncTeamBotRoster() {
        syncTeamBotRosterRuntime(this.getBotRuntimeContext());
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

    getRespawnRuntimeContext(): RespawnRuntimeContext {
        return {
            sessionMode: this.sessionMode,
            localRespawnState: this.localRespawnState,
            remotePlayerStates: this.remotePlayerStates,
            respawnWaves: this.respawnWaves,
            remoteSpawnSlots: this.remoteSpawnSlots,
            bots: this.bots,
            remotePlayers: this.remotePlayers,
            golem: this.golem,
            mechCamera: this.mechCamera,
            getTeamSpawn: (team, slot) => this.getTeamSpawn(team, slot),
            getSpawnYaw: (spawn) => this.getSpawnYaw(spawn),
            placeGolemAtSpawn: (golem, spawn, yaw) => this.placeGolemAtSpawn(golem, spawn, yaw),
            setGolemPresence: (golem, alive) => this.setGolemPresence(golem, alive),
            setRemotePlayerState: (id, patch) => this.setRemotePlayerState(id, patch),
            sendRemoteRespawn: (id, payload) => this.network.sendTo(id, { type: 'respawn', ...payload })
        };
    }

    applyTeamWaveTimer(team: TeamId, timer: number) {
        applyTeamWaveTimerRuntime(this.getRespawnRuntimeContext(), team, timer);
    }

    teamHasPendingRespawns(team: TeamId) {
        return teamHasPendingRespawnsRuntime(this.getRespawnRuntimeContext(), team);
    }

    scheduleRespawnWave(team: TeamId, delay = RESPAWN_WAVE_DELAY) {
        scheduleRespawnWaveRuntime(this.getRespawnRuntimeContext(), team, delay);
    }

    queueLocalRespawn() {
        queueLocalRespawnRuntime(this.getRespawnRuntimeContext(), RESPAWN_WAVE_DELAY);
    }

    queueRemoteRespawn(id: string) {
        queueRemoteRespawnRuntime(this.getRespawnRuntimeContext(), id, RESPAWN_WAVE_DELAY);
    }

    resolveRespawnWave(team: TeamId) {
        resolveRespawnWaveRuntime(this.getRespawnRuntimeContext(), team);
    }

    updateRespawns(dt: number) {
        updateRespawnsRuntime(this.getRespawnRuntimeContext(), dt, RESPAWN_WAVE_DELAY);
    }

    getUnitTeam(id: string): TeamId | null {
        if (!id) return 'blue';
        if (id === this.getLocalUnitId()) return 'blue';
        if (id.startsWith('bot-blue')) return 'blue';
        if (id.startsWith('bot-red')) return 'red';
        if (this.remotePlayers.has(id) || this.remotePlayerStates.has(id)) return 'blue';
        return null;
    }

    getNearestEnemyTarget(team: TeamId, from: THREE.Vector3, maxDistance = Number.POSITIVE_INFINITY) {
        let bestDistanceSq = Number.POSITIVE_INFINITY;
        let bestTarget: THREE.Vector3 | null = null;
        const maxDistanceSq = maxDistance * maxDistance;

        const consider = (target: THREE.Vector3, enemyTeam: TeamId, alive: boolean) => {
            if (!alive || enemyTeam === team) return;
            const distanceSq = from.distanceToSquared(target);
            if (distanceSq > maxDistanceSq) return;
            if (distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestTarget = target.clone();
            }
        };

        const localPos = this.golem.body.translation();
        consider(_botTarget.set(localPos.x, localPos.y + 1.4, localPos.z), 'blue', this.localRespawnState.alive);

        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            const alive = state ? state.alive : true;
            const pos = player.body.translation();
            consider(_weaponOrigin.set(pos.x, pos.y + 1.4, pos.z), 'blue', alive);
        });

        for (const bot of this.bots.values()) {
            const pos = bot.body.translation();
            consider(_weaponOrigin.set(pos.x, pos.y + 1.3, pos.z), bot.team, bot.alive);
        }

        return bestTarget;
    }

    getPriorityControlPoint(team: TeamId, from: THREE.Vector3) {
        const enemyTeam: TeamId = team === 'blue' ? 'red' : 'blue';
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestPoint: (typeof this.controlPoints.points)[number] | null = null;

        for (const point of this.controlPoints.points) {
            const friendlyInside = team === 'blue' ? point.blueInside : point.redInside;
            const enemyInside = team === 'blue' ? point.redInside : point.blueInside;
            const distance = from.distanceTo(point.position);
            let score = -distance * 1.6;

            if (point.contested) {
                score += 260;
            } else if (point.owner === enemyTeam) {
                score += 220;
            } else if (point.owner === 'neutral') {
                score += 180;
            } else if (enemyInside > 0) {
                score += 210;
            } else {
                score += 60;
            }

            if (point.owner === team && point.capture * (team === 'blue' ? 1 : -1) >= 0.98) {
                score -= 30;
            }

            score -= friendlyInside * 24;
            score += enemyInside * 16;

            if (distance <= point.radius * 0.78) {
                score += 32;
            }

            if (score > bestScore) {
                bestScore = score;
                bestPoint = point;
            }
        }

        return bestPoint;
    }

    getBotMovementTarget(team: TeamId, from: THREE.Vector3) {
        const point = this.getPriorityControlPoint(team, from);
        if (point) {
            return point.position.clone();
        }
        return this.getNearestEnemyTarget(team, from);
    }

    haltHorizontalMotion(body: RAPIER.RigidBody) {
        const velocity = body.linvel();
        body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
    }

    buildBotSnapshots(): BotStateView[] {
        return buildBotSnapshotsRuntime(this.bots);
    }

    applyBotSnapshots(botStates: BotStateView[]) {
        applyBotSnapshotsRuntime(this.getBotRuntimeContext(), botStates);
    }

    setupNetwork() {
        this.network.onConnect = (id) => {
            console.log("Player connected:", id);
            handlePeerConnect(this.getNetworkPeerLifecycleContext(), id);
        };

        this.network.onDisconnect = (id) => {
            console.log("Player disconnected:", id);
            handlePeerDisconnect(this.getNetworkPeerLifecycleContext(), id);
        };

        this.network.onData = (id, data) => {
            const inputPacket = this.network.isHost ? readClientInputPacket(data) : null;
            dispatchNetworkDataMessage(createNetworkDataDispatchContext(this), id, data, inputPacket);
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
        this.renderer.dispose();
    }

    loop = (time: number) => {
        if (!this.isRunning) return;
        this.animationFrameId = requestAnimationFrame(this.loop);

        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        this.hitConfirmTimer = Math.max(0, this.hitConfirmTimer - dt);

        this.physics.step();

        const { mx, my } = this.input.consumeMovement();
        this.mechCamera.onMouseMove(mx, my);

        if (this.input.consumeKey('KeyV')) {
            this.toggleCameraMode();
        }

        const matchEnded = this.teamScores.winner !== null;

        let throttleInput = this.input.virtualThrottle;
        let turnInput = this.input.virtualTurn;
        if (this.input.keys['KeyW']) throttleInput += 1;
        if (this.input.keys['KeyS']) throttleInput -= 1;
        if (this.input.keys['KeyA']) turnInput -= 1;
        if (this.input.keys['KeyD']) turnInput += 1;
        throttleInput = clamp(throttleInput, -1, 1);
        turnInput = clamp(turnInput, -1, 1);

        const centerTorso = this.input.consumeKey('KeyC') || this.input.consumeVirtualAction('centerTorso');
        const stopThrottle = this.input.consumeKey('KeyX') || this.input.consumeVirtualAction('stopThrottle');
        const canControlLocal = this.localRespawnState.alive && !matchEnded;

        this.golem.update(
            dt,
            this.mechCamera.aimYaw,
            canControlLocal ? throttleInput : 0,
            canControlLocal ? turnInput : 0,
            canControlLocal ? centerTorso : false,
            canControlLocal ? stopThrottle : false,
            this.sounds,
            this.decals
        );
        
        const golemState = this.golem.getState();

        // Calculate torso turn speed for sounds
        const torsoTurnSpeed = (this.golem.targetTorsoYaw - this.golem.torsoYaw) / dt;
        this.sounds.update(torsoTurnSpeed);
        
        this.remotePlayers.forEach((player, id) => {
            const state = this.remotePlayerStates.get(id);
            if (state?.alive === false) return;
            player.update(dt, player.targetTorsoYaw, 0, 0, false, false, this.sounds, this.decals);
        });

        const authorityMode = this.sessionMode !== 'client';
        updateBotsRuntime(this.getBotRuntimeContext(), dt, this.gameMode, matchEnded);

        if (matchEnded) {
            this.haltHorizontalMotion(this.golem.body);
            this.remotePlayers.forEach((player) => this.haltHorizontalMotion(player.body));
        } else {
            this.projectiles.update(dt);
        }
        this.decals.update(dt);
        
        this.getAimTargetPoint(_aimPoint);

        const fireGroup1 = this.input.consumeFireGroup(1);
        const fireGroup2 = this.input.consumeFireGroup(2);
        const fireGroup3 = this.input.consumeKey('KeyQ') || this.input.consumeFireGroup(3);
        const alphaStrike = this.input.consumeKey('KeyE') || this.input.consumeVirtualAction('alphaStrike');

        if (canControlLocal) {
            const localOwnerId = this.getLocalUnitId();
            const weaponFireContext = createWeaponFireRuntimeContext(this);
            if (fireGroup1) {
                fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireGroup(1), _aimPoint);
            }
            if (fireGroup2) {
                fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireGroup(2), _aimPoint);
            }
            if (fireGroup3) {
                fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireGroup(3), _aimPoint);
            }
            if (alphaStrike) {
                fireWeaponRequestsRuntime(weaponFireContext, localOwnerId, this.golem.tryFireAlpha(), _aimPoint);
            }
        }
        
        if (canControlLocal && (this.input.consumeKey('ShiftLeft') || this.input.consumeVirtualAction('dash'))) {
            if (this.golem.tryAction(30)) {
                this.golem.dash();
                this.mechCamera.onDash();
            }
        }
        
        if (canControlLocal && (this.input.consumeKey('Space') || this.input.consumeVirtualAction('vent'))) {
            if (this.golem.tryAction(0)) {
                this.golem.vent(this.particles);
                this.mechCamera.addTrauma(0.5);
            }
        }

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

        if (!matchEnded) {
            const localPlayerId = this.getLocalUnitId();
            updateProjectileCombat(createProjectileCollisionRuntimeContext(this, authorityMode, localPlayerId));
            playProjectileImpactFxRuntime(createProjectileImpactFxContext(this));

            playWorldPropFxRuntime({
                propManager: this.world.propManager,
                particles: this.particles,
                debris: this.debris,
                decals: this.decals,
                sounds: this.sounds,
                mechCamera: this.mechCamera,
                listenerPosition: this.golem.body.translation()
            });
            this.updateRespawns(dt);
        }
        
        this.boilerParticleTimer += dt;
        if (this.boilerParticleTimer >= this.quality.boilerParticleInterval) {
            this.boilerParticleTimer = 0;
            const boilerPos = new THREE.Vector3();
            this.golem.boiler.getWorldPosition(boilerPos);
            this.particles.emit(boilerPos.x, boilerPos.y + 0.5, boilerPos.z);
        }
        this.particles.update(dt);
        this.debris.update(dt);
        this.world.propManager.update(dt);

        // Network synchronization (20 Hz)
        this.networkTickTimer += dt;
        if (this.networkTickTimer >= 0.05) {
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
                    bots: this.buildBotSnapshots(),
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
    localMechOptions: GolemControllerOptions = {}
) {
    await RAPIER.init();
    const game = new Game(canvas, onStateUpdate, sessionMode, gameMode, localMechOptions);
    game.start();
    return game;
}
