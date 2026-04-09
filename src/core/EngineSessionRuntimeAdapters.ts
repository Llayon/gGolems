import type { Vector3 } from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MechCamera } from '../camera/MechCamera';
import type { ProjectileManager } from '../combat/ProjectileManager';
import { spawnShot as spawnShotRuntime, type FireShotPayload } from './combat/ProjectileCombatRuntime';
import { playWeaponVolleyFx as playWeaponVolleyFxRuntime } from './combat/ProjectileCombatFxRuntime';
import type { AudioManager } from './AudioManager';
import type { GolemController, GolemControllerOptions } from '../entities/GolemController';
import type { DummyBot } from '../entities/DummyBot';
import type { ParticleManager } from '../fx/ParticleManager';
import type { BotStateView, GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import {
    applyBotSnapshots as applyBotSnapshotsRuntime,
    syncTeamBotRoster as syncTeamBotRosterRuntime,
    type BotRuntimeContext,
    type BotShotView
} from './bots/BotRuntime';
import type { NetworkPeerLifecycleContext } from './network/NetworkSyncAdapter';
import type {
    AuthoritativeStateRuntimeContext,
    HostClientInputRuntimeContext,
    RespawnMessageRuntimeContext
} from './network/NetworkMessageRuntime';
import type { NetworkPosition } from './network/playerSnapshots';
import type { RemotePlayerLifecycleContext } from './network/RemotePlayerLifecycleRuntime';
import type { RespawnRuntimeContext } from './respawn/RespawnRuntime';
import type { PlayerRespawnState, RemotePlayerState, RespawnSessionMode } from './respawn/types';

export type EngineSessionRuntimeAdapters = {
    remotePlayerLifecycle(): RemotePlayerLifecycleContext;
    networkPeerLifecycle(): NetworkPeerLifecycleContext;
    authoritativeState(): AuthoritativeStateRuntimeContext;
    hostClientInput(): HostClientInputRuntimeContext;
    respawnMessage(): RespawnMessageRuntimeContext;
    bot(): BotRuntimeContext;
    respawn(): RespawnRuntimeContext;
};

export type EngineSessionRuntimeAdaptersDeps = {
    getSessionMode: () => RespawnSessionMode;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    remoteSpawnSlots: Map<string, number>;
    localRespawnState: PlayerRespawnState;
    respawnWaves: Record<TeamId, number>;
    bots: Map<string, DummyBot>;
    localPlayer: GolemController;
    mechCamera: MechCamera;
    projectiles: ProjectileManager;
    particles: ParticleManager;
    sounds: AudioManager;
    teamSize: number;
    getLocalUnitId: () => string;
    createRemoteGolem: (options?: GolemControllerOptions) => GolemController;
    disposeRemoteGolem: (golem: GolemController) => void;
    placeGolemAtSpawn: (golem: GolemController, spawn: NetworkPosition, yaw?: number) => void;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
    allocateRemoteSpawnSlot: () => number;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    getTeamSpawn: (team: TeamId, slot: number) => NetworkPosition;
    resolveTeamSpawn: (team: TeamId, preferredSlot: number) => { spawn: NetworkPosition; slot: number };
    getSpawnYaw: (spawn: NetworkPosition) => number;
    sendRemoteRespawn: (id: string, payload: { x: number; y: number; z: number; yaw: number; slot: number }) => void;
    setTeamScores: (scores: TeamScoreState) => void;
    setGameMode: (mode: GameMode) => void;
    propManager: AuthoritativeStateRuntimeContext['propManager'];
    controlPoints: AuthoritativeStateRuntimeContext['controlPoints'];
    getMovementTarget: (botId: string, team: TeamId, from: Vector3, gameMode: GameMode) => Vector3 | null;
    getEngageTarget: (team: TeamId, from: Vector3, maxDistance: number) => Vector3 | null;
    createBot: (id: string, team: TeamId, slot: number) => DummyBot;
    destroyBot: (id: string) => void;
    haltHorizontalMotion: (body: RAPIER.RigidBody) => void;
};

export function createEngineSessionRuntimeAdapters(
    deps: EngineSessionRuntimeAdaptersDeps
): EngineSessionRuntimeAdapters {
    const getRemotePlayerLifecycleContext = (): RemotePlayerLifecycleContext => ({
        remotePlayers: deps.remotePlayers,
        createRemoteGolem: (options = {}) => deps.createRemoteGolem(options),
        disposeRemoteGolem: deps.disposeRemoteGolem,
        placeGolemAtSpawn: deps.placeGolemAtSpawn,
        setGolemPresence: deps.setGolemPresence
    });

    const getBotRuntimeContext = (): BotRuntimeContext => ({
        bots: deps.bots,
        sessionMode: deps.getSessionMode(),
        teamSize: deps.teamSize,
        localRespawnSlot: deps.localRespawnState.slot,
        remoteSpawnSlots: deps.remoteSpawnSlots,
        createBot: deps.createBot,
        destroyBot: deps.destroyBot,
        getMovementTarget: deps.getMovementTarget,
        getEngageTarget: deps.getEngageTarget,
        fireShot: (shot: BotShotView, ownerId: string) => spawnShotRuntime(deps.projectiles, {
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
        playWeaponVolleyFx: (shots: FireShotPayload[]) => playWeaponVolleyFxRuntime({
            particles: deps.particles,
            sounds: deps.sounds
        }, shots),
        haltHorizontalMotion: deps.haltHorizontalMotion
    });

    const getRespawnRuntimeContext = (): RespawnRuntimeContext => ({
        sessionMode: deps.getSessionMode(),
        localRespawnState: deps.localRespawnState,
        remotePlayerStates: deps.remotePlayerStates,
        respawnWaves: deps.respawnWaves,
        remoteSpawnSlots: deps.remoteSpawnSlots,
        bots: deps.bots,
        remotePlayers: deps.remotePlayers,
        golem: deps.localPlayer,
        mechCamera: deps.mechCamera,
        getTeamSpawn: deps.getTeamSpawn,
        resolveTeamSpawn: deps.resolveTeamSpawn,
        getSpawnYaw: deps.getSpawnYaw,
        placeGolemAtSpawn: deps.placeGolemAtSpawn,
        setGolemPresence: deps.setGolemPresence,
        setRemotePlayerState: deps.setRemotePlayerState,
        sendRemoteRespawn: deps.sendRemoteRespawn
    });

    return {
        remotePlayerLifecycle: getRemotePlayerLifecycleContext,
        networkPeerLifecycle: () => ({
            sessionMode: deps.getSessionMode(),
            lifecycle: getRemotePlayerLifecycleContext(),
            remotePlayerStates: deps.remotePlayerStates,
            remoteSpawnSlots: deps.remoteSpawnSlots,
            allocateRemoteSpawnSlot: deps.allocateRemoteSpawnSlot,
            setRemotePlayerState: deps.setRemotePlayerState,
            getTeamSpawn: deps.getTeamSpawn,
            getSpawnYaw: deps.getSpawnYaw,
            placeGolemAtSpawn: deps.placeGolemAtSpawn,
            sendRespawn: deps.sendRemoteRespawn,
            syncTeamBotRoster: () => syncTeamBotRosterRuntime(getBotRuntimeContext())
        }),
        authoritativeState: () => ({
            propManager: deps.propManager,
            controlPoints: deps.controlPoints,
            setTeamScores: deps.setTeamScores,
            setGameMode: deps.setGameMode,
            applyBotSnapshots: (botStates: BotStateView[]) => applyBotSnapshotsRuntime(getBotRuntimeContext(), botStates),
            lifecycle: getRemotePlayerLifecycleContext(),
            remotePlayerStates: deps.remotePlayerStates,
            setRemotePlayerState: deps.setRemotePlayerState,
            getLocalUnitId: deps.getLocalUnitId,
            localPlayer: deps.localPlayer,
            mechCamera: deps.mechCamera,
            localRespawnState: deps.localRespawnState,
            setGolemPresence: deps.setGolemPresence
        }),
        hostClientInput: () => ({
            remotePlayerStates: deps.remotePlayerStates,
            lifecycle: getRemotePlayerLifecycleContext()
        }),
        respawnMessage: () => ({
            localRespawnState: deps.localRespawnState,
            localPlayer: deps.localPlayer,
            mechCamera: deps.mechCamera,
            setGolemPresence: deps.setGolemPresence
        }),
        bot: getBotRuntimeContext,
        respawn: getRespawnRuntimeContext
    };
}
