import * as THREE from 'three';
import type { GameMode } from '../gameplay/types';
import type { GolemController, GolemControllerOptions } from '../entities/GolemController';
import type { Renderer } from './Renderer';
import type { NetworkManager } from '../network/NetworkManager';
import type { MechCamera } from '../camera/MechCamera';
import type { AudioManager } from './AudioManager';
import type { DecalManager } from '../fx/DecalManager';
import type { ParticleManager } from '../fx/ParticleManager';
import type { ProjectileManager } from '../combat/ProjectileManager';
import type { ControlPointManager } from '../gameplay/ControlPointManager';
import type { Arena } from '../world/Arena';
import type { DummyBot } from '../entities/DummyBot';
import type { PlayerRespawnState, RemotePlayerState } from './respawn/types';
import {
    createEngineSessionRuntimeAdapters,
    type EngineSessionRuntimeAdapters
} from './EngineSessionRuntimeAdapters';
import {
    createEngineRuntimeAdapters,
    type EngineRuntimeAdapters
} from './EngineRuntimeContexts';
import {
    queueLocalRespawn as queueLocalRespawnRuntime,
    queueRemoteRespawn as queueRemoteRespawnRuntime,
    scheduleRespawnWave as scheduleRespawnWaveRuntime
} from './respawn/RespawnRuntime';
import { getBotMovementTarget as calcBotMovementTarget } from './bots/BotObjectiveSystem';

const RESPAWN_WAVE_DELAY = 8;

export type GameAdapterSources = {
    sessionMode: 'solo' | 'host' | 'client';
    teamSize: number;
    network: NetworkManager;
    renderer: Renderer;
    physics: any;
    world: Arena;
    mechCamera: MechCamera;
    golem: GolemController;
    projectiles: ProjectileManager;
    particles: ParticleManager;
    sounds: AudioManager;
    decals: DecalManager;
    controlPoints: ControlPointManager;
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    remoteSpawnSlots: Map<string, number>;
    localRespawnState: PlayerRespawnState;
    respawnWaves: Record<string, number>;
    recentDeaths: any[];
    gameMode: GameMode;
    teamScores: any;
    hitConfirmTimer: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    createRemoteGolem: (options?: GolemControllerOptions) => GolemController;
    placeGolemAtSpawn: (golem: GolemController, spawn: any, yaw?: number) => void;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
    allocateRemoteSpawnSlot: () => number;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    getTeamSpawn: (team: any, slot: number) => THREE.Vector3;
    resolveTeamSpawn: (team: any, preferredSlot: number) => any;
    getSpawnYaw: (spawn: any) => number;
    setTeamScores: (scores: any) => void;
    setGameMode: (mode: GameMode) => void;
    getBotObjectiveContext: () => any;
    getNearestEnemyTarget: (team: any, from: THREE.Vector3, maxDistance?: number) => THREE.Vector3 | null;
    createBot: (id: string, team: any, slot: number) => DummyBot;
    destroyBot: (id: string) => void;
    haltHorizontalMotion: (body: any) => void;
    getLocalUnitId: () => string;
    getUnitTeam: (id: string) => any;
    setHitConfirmState: (state: { hitConfirmTimer: number; hitTargetHp: number; hitTargetMaxHp: number }) => void;
    registerRecentDeath: (team: any, position: { x: number; y: number; z: number }) => void;
    restartMatch: (fromNetwork?: boolean) => boolean;
};

export function buildSessionAdapters(s: GameAdapterSources): EngineSessionRuntimeAdapters {
    return createEngineSessionRuntimeAdapters({
        getSessionMode: () => s.sessionMode,
        remotePlayers: s.remotePlayers,
        remotePlayerStates: s.remotePlayerStates,
        remoteSpawnSlots: s.remoteSpawnSlots,
        localRespawnState: s.localRespawnState,
        respawnWaves: s.respawnWaves,
        bots: s.bots,
        localPlayer: s.golem,
        mechCamera: s.mechCamera,
        projectiles: s.projectiles,
        particles: s.particles,
        sounds: s.sounds,
        teamSize: s.teamSize,
        getLocalUnitId: () => s.getLocalUnitId(),
        createRemoteGolem: (options = {}) => s.createRemoteGolem(options),
        disposeRemoteGolem: (golem) => {
            s.renderer.scene.remove(golem.model);
            s.physics.removeRigidBody(golem.body);
        },
        placeGolemAtSpawn: (golem, spawn, yaw) => s.placeGolemAtSpawn(golem, spawn, yaw),
        setGolemPresence: (golem, alive) => s.setGolemPresence(golem, alive),
        allocateRemoteSpawnSlot: () => s.allocateRemoteSpawnSlot(),
        setRemotePlayerState: (id, patch) => s.setRemotePlayerState(id, patch),
        getTeamSpawn: (team, slot) => s.getTeamSpawn(team, slot),
        resolveTeamSpawn: (team, preferredSlot) => s.resolveTeamSpawn(team, preferredSlot),
        getSpawnYaw: (spawn) => s.getSpawnYaw(spawn),
        sendRemoteRespawn: (id, payload) => s.network.sendTo(id, { type: 'respawn', ...payload }),
        setTeamScores: (scores) => s.setTeamScores(scores),
        setGameMode: (mode) => s.setGameMode(mode),
        propManager: s.world.propManager,
        controlPoints: s.controlPoints,
        getMovementTarget: (botId, team, from, gameMode) => gameMode === 'control'
            ? calcBotMovementTarget(s.getBotObjectiveContext(), team, from, botId, s.bots.get(botId)?.hp ?? 100, (intent) => s.bots.get(botId)?.setIntent(intent))
            : s.getNearestEnemyTarget(team, from),
        getEngageTarget: (team, from, maxDistance) => s.getNearestEnemyTarget(team, from, maxDistance),
        createBot: (id, team, slot) => s.createBot(id, team, slot),
        destroyBot: (id) => s.destroyBot(id),
        haltHorizontalMotion: (body) => s.haltHorizontalMotion(body)
    });
}

export function buildRuntimeAdapters(
    s: GameAdapterSources & { sessionRuntimeAdapters: EngineSessionRuntimeAdapters }
): EngineRuntimeAdapters {
    return createEngineRuntimeAdapters({
        getSessionMode: () => s.sessionMode,
        getMyId: () => s.network.myId,
        isHost: () => s.network.isHost,
        getLocalUnitId: () => s.getLocalUnitId(),
        setHitConfirmState: s.setHitConfirmState,
        sendHitConfirm: (ownerId, payload) => s.network.sendTo(ownerId, payload),
        authoritativeStateContext: () => s.sessionRuntimeAdapters.authoritativeState(),
        hostClientInputContext: () => s.sessionRuntimeAdapters.hostClientInput(),
        respawnMessageContext: () => s.sessionRuntimeAdapters.respawnMessage(),
        restartMatchRequest: () => s.restartMatch(),
        restartMatchContext: () => ({
            setGameMode: (mode: GameMode) => s.setGameMode(mode),
            restartMatch: (fromNetwork = false) => s.restartMatch(fromNetwork)
        }),
        forwardFireMessage: (senderId, message) => {
            s.network.connections.forEach((conn, peerId) => {
                if (peerId !== senderId) conn.send(message);
            });
        },
        projectiles: s.projectiles,
        remotePlayers: s.remotePlayers,
        particles: s.particles,
        sounds: s.sounds,
        golem: s.golem,
        mechCamera: s.mechCamera,
        camera: s.renderer.camera,
        broadcastFire: s.sessionMode === 'solo'
            ? undefined
            : (ownerId, shots) => {
                s.network.broadcast({ type: 'fire', ownerId, shots });
            },
        bots: s.bots,
        localPlayer: s.golem,
        getGameMode: () => s.gameMode,
        getTeamScores: () => s.teamScores,
        getUnitTeam: (id) => s.getUnitTeam(id),
        queueLocalRespawn: () => queueLocalRespawnRuntime(s.sessionRuntimeAdapters.respawn(), RESPAWN_WAVE_DELAY),
        queueRemoteRespawn: (id) => queueRemoteRespawnRuntime(s.sessionRuntimeAdapters.respawn(), id, RESPAWN_WAVE_DELAY),
        scheduleRespawnWave: (team) => scheduleRespawnWaveRuntime(s.sessionRuntimeAdapters.respawn(), team, RESPAWN_WAVE_DELAY),
        registerDeath: (team, position) => s.registerRecentDeath(team, position),
        collisionMeshes: () => s.world.getCollisionMeshes(),
        propManager: s.world.propManager,
        decals: s.decals,
        getLocalRespawnAlive: () => s.localRespawnState.alive,
        getRemotePlayerStates: () => s.remotePlayerStates,
        getListenerPosition: () => s.golem.body.translation()
    });
}
