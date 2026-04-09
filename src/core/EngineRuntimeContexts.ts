import type { Camera } from 'three';
import type { GameMode } from '../gameplay/types';
import type { GolemController } from '../entities/GolemController';
import type { ProjectileManager } from '../combat/ProjectileManager';
import type { ParticleManager } from '../fx/ParticleManager';
import type { AudioManager } from './AudioManager';
import {
    confirmHitForOwner as confirmHitForOwnerRuntime,
    registerHitConfirmState,
    type HitConfirmState,
    type HitConfirmRuntimeContext
} from './gameHudTelemetry';
import {
    applyRemoteFire,
    type FireShotPayload,
    type ProjectileCollisionRuntimeContext,
    type WeaponFireRuntimeContext
} from './combat/ProjectileCombatRuntime';
import { handlePlayerHit as handlePlayerHitRuntime, type PlayerHitRuntimeContext } from './combat/PlayerHitRuntime';
import type { ProjectileImpactFxContext } from './combat/ProjectileCombatFxRuntime';
import { playWeaponVolleyFx as playWeaponVolleyFxRuntime } from './combat/ProjectileCombatFxRuntime';
import {
    applyAuthoritativeStateMessage,
    applyClientInputToRemotePlayer,
    applyHitConfirmMessage,
    applyRemoteFireMessage,
    applyRespawnMessage,
    applyRestartMatchMessage,
    type AuthoritativeStateRuntimeContext,
    type HostClientInputRuntimeContext,
    type NetworkDataDispatchContext,
    type RemoteFireMessageLike,
    type RemoteFireRuntimeContext,
    type RespawnMessageRuntimeContext,
    type RestartMatchRuntimeContext
} from './network/NetworkMessageRuntime';
import type { TeamScoreState } from '../gameplay/types';
import type { PlayerRespawnState, RemotePlayerState, RespawnSessionMode } from './respawn/types';

export type HitConfirmRuntimeContextDeps = {
    sessionMode: HitConfirmRuntimeContext['sessionMode'];
    myId: string;
    getLocalUnitId: () => string;
    setHitConfirmState: (next: HitConfirmState) => void;
    sendHitConfirm: HitConfirmRuntimeContext['sendHitConfirm'];
};

export function createHitConfirmRuntimeContext(
    deps: HitConfirmRuntimeContextDeps
): HitConfirmRuntimeContext {
    return {
        sessionMode: deps.sessionMode,
        myId: deps.myId,
        getLocalUnitId: deps.getLocalUnitId,
        registerHitConfirm: (targetHp: number, targetMaxHp: number) => {
            registerHitConfirmState(
                (next) => deps.setHitConfirmState(next),
                targetHp,
                targetMaxHp
            );
        },
        sendHitConfirm: deps.sendHitConfirm
    };
}

export type RemoteFireRuntimeContextDeps = {
    myId: string;
    isHost: boolean;
    projectiles: ProjectileManager;
    remotePlayers: Map<string, GolemController>;
    playWeaponVolleyFx: (shots: FireShotPayload[]) => void;
    forwardFireMessage: (senderId: string, data: RemoteFireMessageLike) => void;
};

export function createRemoteFireRuntimeContext(
    deps: RemoteFireRuntimeContextDeps
): RemoteFireRuntimeContext {
    return {
        myId: deps.myId,
        isHost: deps.isHost,
        applyRemoteFire: (ownerId, shots) => applyRemoteFire({
            projectiles: deps.projectiles,
            remotePlayers: deps.remotePlayers,
            playWeaponVolleyFx: deps.playWeaponVolleyFx
        }, ownerId, shots),
        forwardFireMessage: deps.forwardFireMessage
    };
}

export type NetworkDataDispatchContextDeps = {
    isHost: boolean;
    authoritativeStateContext: AuthoritativeStateRuntimeContext;
    hostClientInputContext: HostClientInputRuntimeContext;
    restartMatchRequest: () => void;
    respawnMessageContext: RespawnMessageRuntimeContext;
    restartMatchContext: RestartMatchRuntimeContext;
    remoteFireContext: RemoteFireRuntimeContext;
    registerHitConfirm: (targetHp: number, targetMaxHp: number) => void;
};

export function createNetworkDataDispatchContext(
    deps: NetworkDataDispatchContextDeps
): NetworkDataDispatchContext {
    return {
        isHost: deps.isHost,
        onStateMessage: (message) => {
            applyAuthoritativeStateMessage(deps.authoritativeStateContext, message);
        },
        onClientInputPacket: (senderId, packet) => {
            applyClientInputToRemotePlayer(deps.hostClientInputContext, senderId, packet);
        },
        onRestartRequest: deps.restartMatchRequest,
        onRespawnMessage: (message) => {
            applyRespawnMessage(deps.respawnMessageContext, message);
        },
        onRestartMatchMessage: (message) => {
            applyRestartMatchMessage(deps.restartMatchContext, message);
        },
        onRemoteFireMessage: (senderId, message) => {
            applyRemoteFireMessage(deps.remoteFireContext, senderId, message);
        },
        onHitConfirmMessage: (message) => {
            applyHitConfirmMessage(deps.registerHitConfirm, message);
        }
    };
}

export type WeaponFireRuntimeContextDeps = {
    golem: WeaponFireRuntimeContext['golem'];
    mechCamera: WeaponFireRuntimeContext['mechCamera'];
    camera: Camera;
    projectiles: ProjectileManager;
    playWeaponVolleyFx: (shots: FireShotPayload[]) => void;
    broadcastFire?: WeaponFireRuntimeContext['broadcastFire'];
};

export function createWeaponFireRuntimeContext(
    deps: WeaponFireRuntimeContextDeps
): WeaponFireRuntimeContext {
    return {
        golem: deps.golem,
        mechCamera: deps.mechCamera,
        camera: deps.camera,
        projectiles: deps.projectiles,
        playWeaponVolleyFx: deps.playWeaponVolleyFx,
        broadcastFire: deps.broadcastFire
    };
}

export type PlayerHitRuntimeContextDeps = {
    bots: PlayerHitRuntimeContext['bots'];
    remotePlayers: PlayerHitRuntimeContext['remotePlayers'];
    localPlayer: PlayerHitRuntimeContext['localPlayer'];
    mechCamera: PlayerHitRuntimeContext['mechCamera'];
    gameMode: GameMode;
    teamScores: PlayerHitRuntimeContext['teamScores'];
    localPlayerId: string;
    getUnitTeam: PlayerHitRuntimeContext['getUnitTeam'];
    queueLocalRespawn: PlayerHitRuntimeContext['queueLocalRespawn'];
    queueRemoteRespawn: PlayerHitRuntimeContext['queueRemoteRespawn'];
    scheduleRespawnWave: PlayerHitRuntimeContext['scheduleRespawnWave'];
    hitConfirmContext: HitConfirmRuntimeContext;
    registerDeath?: PlayerHitRuntimeContext['registerDeath'];
};

export function createPlayerHitRuntimeContext(
    deps: PlayerHitRuntimeContextDeps
): PlayerHitRuntimeContext {
    return {
        bots: deps.bots,
        remotePlayers: deps.remotePlayers,
        localPlayer: deps.localPlayer,
        mechCamera: deps.mechCamera,
        gameMode: deps.gameMode,
        teamScores: deps.teamScores,
        localPlayerId: deps.localPlayerId,
        getUnitTeam: deps.getUnitTeam,
        queueLocalRespawn: deps.queueLocalRespawn,
        queueRemoteRespawn: deps.queueRemoteRespawn,
        scheduleRespawnWave: deps.scheduleRespawnWave,
        registerDeath: deps.registerDeath,
        confirmHitForOwner: (ownerId, targetHp, targetMaxHp) => confirmHitForOwnerRuntime(
            deps.hitConfirmContext,
            ownerId,
            targetHp,
            targetMaxHp
        )
    };
}

export type ProjectileCollisionRuntimeContextDeps = {
    projectiles: ProjectileCollisionRuntimeContext['projectiles'];
    bots: ProjectileCollisionRuntimeContext['bots'];
    remotePlayers: ProjectileCollisionRuntimeContext['remotePlayers'];
    localPlayer: ProjectileCollisionRuntimeContext['localPlayer'];
    localPlayerId: string;
    authorityMode: boolean;
    collisionMeshes: ProjectileCollisionRuntimeContext['collisionMeshes'];
    propManager: ProjectileCollisionRuntimeContext['propManager'];
    decals: ProjectileCollisionRuntimeContext['decals'];
    getUnitTeam: ProjectileCollisionRuntimeContext['getUnitTeam'];
    isTargetAlive: ProjectileCollisionRuntimeContext['isTargetAlive'];
    playerHitContext: PlayerHitRuntimeContext;
};

export function createProjectileCollisionRuntimeContext(
    deps: ProjectileCollisionRuntimeContextDeps
): ProjectileCollisionRuntimeContext {
    return {
        projectiles: deps.projectiles,
        bots: deps.bots,
        remotePlayers: deps.remotePlayers,
        localPlayer: deps.localPlayer,
        localPlayerId: deps.localPlayerId,
        authorityMode: deps.authorityMode,
        collisionMeshes: deps.collisionMeshes,
        propManager: deps.propManager,
        decals: deps.decals,
        getUnitTeam: deps.getUnitTeam,
        isTargetAlive: deps.isTargetAlive,
        onPlayerHit: (ownerId, targetId, damage, section) => handlePlayerHitRuntime(
            deps.playerHitContext,
            ownerId,
            targetId,
            damage,
            section
        )
    };
}

export type ProjectileImpactFxContextDeps = {
    particles: ParticleManager;
    sounds: AudioManager;
    mechCamera: ProjectileImpactFxContext['mechCamera'];
    projectiles: ProjectileImpactFxContext['projectiles'];
    listenerPosition: ProjectileImpactFxContext['listenerPosition'];
};

export function createProjectileImpactFxContext(
    deps: ProjectileImpactFxContextDeps
): ProjectileImpactFxContext {
    return {
        particles: deps.particles,
        sounds: deps.sounds,
        mechCamera: deps.mechCamera,
        projectiles: deps.projectiles,
        listenerPosition: deps.listenerPosition
    };
}

export type EngineRuntimeAdapters = {
    networkDataDispatch(): NetworkDataDispatchContext;
    weaponFire(): WeaponFireRuntimeContext;
    projectileCollision(authorityMode: boolean, localPlayerId: string): ProjectileCollisionRuntimeContext;
    projectileImpactFx(): ProjectileImpactFxContext;
};

export type EngineRuntimeAdaptersDeps = {
    getSessionMode: () => RespawnSessionMode;
    getMyId: () => string;
    isHost: () => boolean;
    getLocalUnitId: () => string;
    setHitConfirmState: (next: HitConfirmState) => void;
    sendHitConfirm: HitConfirmRuntimeContext['sendHitConfirm'];
    authoritativeStateContext: () => AuthoritativeStateRuntimeContext;
    hostClientInputContext: () => HostClientInputRuntimeContext;
    respawnMessageContext: () => RespawnMessageRuntimeContext;
    restartMatchRequest: () => void;
    restartMatchContext: () => RestartMatchRuntimeContext;
    forwardFireMessage: (senderId: string, data: RemoteFireMessageLike) => void;
    projectiles: ProjectileManager;
    remotePlayers: Map<string, GolemController>;
    particles: ParticleManager;
    sounds: AudioManager;
    golem: WeaponFireRuntimeContext['golem'];
    mechCamera: WeaponFireRuntimeContext['mechCamera'];
    camera: Camera;
    broadcastFire?: WeaponFireRuntimeContext['broadcastFire'];
    bots: PlayerHitRuntimeContext['bots'];
    localPlayer: PlayerHitRuntimeContext['localPlayer'];
    getGameMode: () => GameMode;
    getTeamScores: () => TeamScoreState;
    getUnitTeam: PlayerHitRuntimeContext['getUnitTeam'];
    queueLocalRespawn: PlayerHitRuntimeContext['queueLocalRespawn'];
    queueRemoteRespawn: PlayerHitRuntimeContext['queueRemoteRespawn'];
    scheduleRespawnWave: PlayerHitRuntimeContext['scheduleRespawnWave'];
    registerDeath?: PlayerHitRuntimeContext['registerDeath'];
    collisionMeshes: () => ProjectileCollisionRuntimeContext['collisionMeshes'];
    propManager: ProjectileCollisionRuntimeContext['propManager'];
    decals: ProjectileCollisionRuntimeContext['decals'];
    getLocalRespawnAlive: () => PlayerRespawnState['alive'];
    getRemotePlayerStates: () => Map<string, RemotePlayerState>;
    getListenerPosition: () => ProjectileImpactFxContext['listenerPosition'];
};

export function createEngineRuntimeAdapters(
    deps: EngineRuntimeAdaptersDeps
): EngineRuntimeAdapters {
    const getHitConfirmContext = () => createHitConfirmRuntimeContext({
        sessionMode: deps.getSessionMode(),
        myId: deps.getMyId(),
        getLocalUnitId: deps.getLocalUnitId,
        setHitConfirmState: deps.setHitConfirmState,
        sendHitConfirm: deps.sendHitConfirm
    });

    const getRemoteFireContext = () => createRemoteFireRuntimeContext({
        myId: deps.getMyId(),
        isHost: deps.isHost(),
        projectiles: deps.projectiles,
        remotePlayers: deps.remotePlayers,
        playWeaponVolleyFx: (shots) => playWeaponVolleyFxRuntime({
            particles: deps.particles,
            sounds: deps.sounds
        }, shots),
        forwardFireMessage: deps.forwardFireMessage
    });

    return {
        networkDataDispatch: () => createNetworkDataDispatchContext({
            isHost: deps.isHost(),
            authoritativeStateContext: deps.authoritativeStateContext(),
            hostClientInputContext: deps.hostClientInputContext(),
            restartMatchRequest: deps.restartMatchRequest,
            respawnMessageContext: deps.respawnMessageContext(),
            restartMatchContext: deps.restartMatchContext(),
            remoteFireContext: getRemoteFireContext(),
            registerHitConfirm: (targetHp, targetMaxHp) => getHitConfirmContext().registerHitConfirm(targetHp, targetMaxHp)
        }),
        weaponFire: () => createWeaponFireRuntimeContext({
            golem: deps.golem,
            mechCamera: deps.mechCamera,
            camera: deps.camera,
            projectiles: deps.projectiles,
            playWeaponVolleyFx: (shots) => playWeaponVolleyFxRuntime({
                particles: deps.particles,
                sounds: deps.sounds
            }, shots),
            broadcastFire: deps.broadcastFire
        }),
        projectileCollision: (authorityMode, localPlayerId) => createProjectileCollisionRuntimeContext({
            projectiles: deps.projectiles,
            bots: deps.bots,
            remotePlayers: deps.remotePlayers,
            localPlayer: deps.localPlayer,
            localPlayerId,
            authorityMode,
            collisionMeshes: deps.collisionMeshes(),
            propManager: deps.propManager,
            decals: deps.decals,
            getUnitTeam: deps.getUnitTeam,
            isTargetAlive: (targetId) => targetId === localPlayerId
                ? deps.getLocalRespawnAlive()
                : (deps.getRemotePlayerStates().get(targetId)?.alive ?? true),
            playerHitContext: createPlayerHitRuntimeContext({
                bots: deps.bots,
                remotePlayers: deps.remotePlayers,
                localPlayer: deps.localPlayer,
                mechCamera: deps.mechCamera,
                gameMode: deps.getGameMode(),
                teamScores: deps.getTeamScores(),
                localPlayerId,
                getUnitTeam: deps.getUnitTeam,
                queueLocalRespawn: deps.queueLocalRespawn,
                queueRemoteRespawn: deps.queueRemoteRespawn,
                scheduleRespawnWave: deps.scheduleRespawnWave,
                registerDeath: deps.registerDeath,
                hitConfirmContext: getHitConfirmContext()
            })
        }),
        projectileImpactFx: () => createProjectileImpactFxContext({
            particles: deps.particles,
            sounds: deps.sounds,
            mechCamera: deps.mechCamera,
            projectiles: deps.projectiles,
            listenerPosition: deps.getListenerPosition()
        })
    };
}
