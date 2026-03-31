import type { GameMode } from '../gameplay/types';
import {
    confirmHitForOwner as confirmHitForOwnerRuntime,
    registerHitConfirmState
} from './gameHudTelemetry';
import {
    applyRemoteFire,
    type ProjectileCollisionRuntimeContext,
    type WeaponFireRuntimeContext
} from './combat/ProjectileCombatRuntime';
import { handlePlayerHit as handlePlayerHitRuntime, type PlayerHitRuntimeContext } from './combat/PlayerHitRuntime';
import {
    playProjectileImpactFx as playProjectileImpactFxRuntime,
    playWeaponVolleyFx as playWeaponVolleyFxRuntime,
    type ProjectileImpactFxContext
} from './combat/ProjectileCombatFxRuntime';
import {
    applyAuthoritativeStateMessage,
    applyClientInputToRemotePlayer,
    applyHitConfirmMessage,
    applyRemoteFireMessage,
    applyRespawnMessage,
    applyRestartMatchMessage,
    type NetworkDataDispatchContext,
    type RemoteFireRuntimeContext
} from './network/NetworkMessageRuntime';
import type { Game } from './Engine';

export function createHitConfirmRuntimeContext(game: Game) {
    return {
        sessionMode: game.sessionMode,
        myId: game.network.myId,
        getLocalUnitId: () => game.getLocalUnitId(),
        registerHitConfirm: (targetHp: number, targetMaxHp: number) => {
            registerHitConfirmState((next) => {
                game.hitConfirmTimer = next.hitConfirmTimer;
                game.hitTargetHp = next.hitTargetHp;
                game.hitTargetMaxHp = next.hitTargetMaxHp;
            }, targetHp, targetMaxHp);
        },
        sendHitConfirm: (ownerId: string, payload: { type: 'hitConfirm'; hp: number; maxHp: number }) => {
            game.network.sendTo(ownerId, payload);
        }
    };
}

export function createRemoteFireRuntimeContext(game: Game): RemoteFireRuntimeContext {
    return {
        myId: game.network.myId,
        isHost: game.network.isHost,
        applyRemoteFire: (ownerId, shots) => applyRemoteFire({
            projectiles: game.projectiles,
            remotePlayers: game.remotePlayers,
            playWeaponVolleyFx: (payloads) => playWeaponVolleyFxRuntime({
                particles: game.particles,
                sounds: game.sounds
            }, payloads)
        }, ownerId, shots),
        forwardFireMessage: (senderId, message) => {
            game.network.connections.forEach((conn, peerId) => {
                if (peerId !== senderId) conn.send(message);
            });
        }
    };
}

export function createNetworkDataDispatchContext(game: Game): NetworkDataDispatchContext {
    return {
        isHost: game.network.isHost,
        onStateMessage: (message) => {
            applyAuthoritativeStateMessage(game.getAuthoritativeStateRuntimeContext(), message);
        },
        onClientInputPacket: (senderId, packet) => {
            applyClientInputToRemotePlayer(game.getHostClientInputRuntimeContext(), senderId, packet);
        },
        onRestartRequest: () => {
            game.restartMatch();
        },
        onRespawnMessage: (message) => {
            applyRespawnMessage(game.getRespawnMessageRuntimeContext(), message);
        },
        onRestartMatchMessage: (message) => {
            applyRestartMatchMessage({
                setGameMode: (mode: GameMode) => game.setGameMode(mode),
                restartMatch: (fromNetwork = false) => game.restartMatch(fromNetwork)
            }, message);
        },
        onRemoteFireMessage: (senderId, message) => {
            applyRemoteFireMessage(createRemoteFireRuntimeContext(game), senderId, message);
        },
        onHitConfirmMessage: (message) => {
            applyHitConfirmMessage(
                (targetHp, targetMaxHp) => createHitConfirmRuntimeContext(game).registerHitConfirm(targetHp, targetMaxHp),
                message
            );
        }
    };
}

export function createWeaponFireRuntimeContext(game: Game): WeaponFireRuntimeContext {
    return {
        golem: game.golem,
        mechCamera: game.mechCamera,
        camera: game.renderer.camera,
        projectiles: game.projectiles,
        playWeaponVolleyFx: (shots) => playWeaponVolleyFxRuntime({
            particles: game.particles,
            sounds: game.sounds
        }, shots),
        broadcastFire: game.sessionMode === 'solo'
            ? undefined
            : (ownerId, shots) => {
                game.network.broadcast({
                    type: 'fire',
                    ownerId,
                    shots
                });
            }
    };
}

export function createPlayerHitRuntimeContext(game: Game, localPlayerId: string): PlayerHitRuntimeContext {
    return {
        bots: game.bots,
        remotePlayers: game.remotePlayers,
        localPlayer: game.golem,
        mechCamera: game.mechCamera,
        gameMode: game.gameMode,
        teamScores: game.teamScores,
        localPlayerId,
        getUnitTeam: (id) => game.getUnitTeam(id),
        queueLocalRespawn: () => game.queueLocalRespawn(),
        queueRemoteRespawn: (id) => game.queueRemoteRespawn(id),
        scheduleRespawnWave: (team) => game.scheduleRespawnWave(team),
        confirmHitForOwner: (ownerId, targetHp, targetMaxHp) => confirmHitForOwnerRuntime(
            createHitConfirmRuntimeContext(game),
            ownerId,
            targetHp,
            targetMaxHp
        )
    };
}

export function createProjectileCollisionRuntimeContext(
    game: Game,
    authorityMode: boolean,
    localPlayerId: string
): ProjectileCollisionRuntimeContext {
    return {
        projectiles: game.projectiles,
        bots: game.bots,
        remotePlayers: game.remotePlayers,
        localPlayer: game.golem,
        localPlayerId,
        authorityMode,
        collisionMeshes: game.world.getCollisionMeshes(),
        propManager: game.world.propManager,
        decals: game.decals,
        getUnitTeam: (unitId) => game.getUnitTeam(unitId),
        isTargetAlive: (targetId) => targetId === localPlayerId
            ? game.localRespawnState.alive
            : (game.remotePlayerStates.get(targetId)?.alive ?? true),
        onPlayerHit: (ownerId, targetId, damage, section) => handlePlayerHitRuntime(
            createPlayerHitRuntimeContext(game, localPlayerId),
            ownerId,
            targetId,
            damage,
            section
        )
    };
}

export function createProjectileImpactFxContext(game: Game): ProjectileImpactFxContext {
    return {
        particles: game.particles,
        sounds: game.sounds,
        mechCamera: game.mechCamera,
        projectiles: game.projectiles,
        listenerPosition: game.golem.body.translation()
    };
}
