import * as THREE from 'three';
import type { MechCamera } from '../../camera/MechCamera';
import type { GolemController } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { TeamId } from '../../gameplay/types';
import type { NetworkPosition } from '../network/playerSnapshots';
import type { PlayerRespawnState, RemotePlayerState, RespawnSessionMode } from './types';

export type RespawnRuntimeContext = {
    sessionMode: RespawnSessionMode;
    localRespawnState: PlayerRespawnState;
    remotePlayerStates: Map<string, RemotePlayerState>;
    respawnWaves: Record<TeamId, number>;
    remoteSpawnSlots: Map<string, number>;
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    golem: GolemController;
    mechCamera: MechCamera;
    getTeamSpawn: (team: TeamId, slot: number) => NetworkPosition;
    getSpawnYaw: (spawn: NetworkPosition) => number;
    placeGolemAtSpawn: (golem: GolemController, spawn: NetworkPosition, yaw?: number) => void;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    sendRemoteRespawn: (id: string, payload: { x: number; y: number; z: number; yaw: number; slot: number }) => void;
};

export function applyTeamWaveTimer(context: RespawnRuntimeContext, team: TeamId, timer: number) {
    const clamped = Math.max(0, timer);
    if (team === 'blue') {
        if (!context.localRespawnState.alive) {
            context.localRespawnState.timer = clamped;
        }
        for (const [id, state] of context.remotePlayerStates) {
            if (state.team === 'blue' && !state.alive) {
                context.setRemotePlayerState(id, { timer: clamped });
            }
        }
    } else {
        for (const [id, state] of context.remotePlayerStates) {
            if (state.team === 'red' && !state.alive) {
                context.setRemotePlayerState(id, { timer: clamped });
            }
        }
    }

    for (const bot of context.bots.values()) {
        if (bot.team === team && !bot.alive) {
            bot.respawnTimer = clamped;
        }
    }
}

export function teamHasPendingRespawns(context: RespawnRuntimeContext, team: TeamId) {
    if (team === 'blue') {
        if (!context.localRespawnState.alive) return true;
        for (const state of context.remotePlayerStates.values()) {
            if (state.team === 'blue' && !state.alive) return true;
        }
    } else {
        for (const state of context.remotePlayerStates.values()) {
            if (state.team === 'red' && !state.alive) return true;
        }
    }

    for (const bot of context.bots.values()) {
        if (bot.team === team && !bot.alive) return true;
    }

    return false;
}

export function scheduleRespawnWave(context: RespawnRuntimeContext, team: TeamId, delay: number) {
    if (context.respawnWaves[team] <= 0) {
        context.respawnWaves[team] = delay;
    }
    applyTeamWaveTimer(context, team, context.respawnWaves[team]);
}

export function queueLocalRespawn(context: RespawnRuntimeContext, delay: number) {
    context.localRespawnState.alive = false;
    context.localRespawnState.timer = 0;
    context.golem.resetSections();
    context.golem.hp = 0;
    context.setGolemPresence(context.golem, false);
    const spawn = context.getTeamSpawn('blue', context.localRespawnState.slot);
    context.placeGolemAtSpawn(context.golem, spawn);
    scheduleRespawnWave(context, 'blue', delay);
}

export function respawnLocalPlayer(context: RespawnRuntimeContext) {
    context.localRespawnState.alive = true;
    context.localRespawnState.timer = 0;
    const spawn = context.getTeamSpawn('blue', context.localRespawnState.slot);
    context.placeGolemAtSpawn(context.golem, spawn);
    context.golem.steam = context.golem.maxSteam;
    context.golem.isOverheated = false;
    context.golem.overheatTimer = 0;
    context.setGolemPresence(context.golem, true);
    context.mechCamera.addTrauma(1.0);
}

export function queueRemoteRespawn(context: RespawnRuntimeContext, id: string, delay: number) {
    const player = context.remotePlayers.get(id);
    if (!player) return;
    const slot = context.remoteSpawnSlots.get(id) ?? 1;
    context.setRemotePlayerState(id, { alive: false, timer: 0, slot });
    player.resetSections();
    player.hp = 0;
    context.setGolemPresence(player, false);
    const spawn = context.getTeamSpawn('blue', slot);
    context.placeGolemAtSpawn(player, spawn);
    scheduleRespawnWave(context, 'blue', delay);
}

export function respawnRemotePlayer(context: RespawnRuntimeContext, id: string) {
    const player = context.remotePlayers.get(id);
    if (!player) return;
    const slot = context.remoteSpawnSlots.get(id) ?? 1;
    const spawn = context.getTeamSpawn('blue', slot);
    context.placeGolemAtSpawn(player, spawn);
    player.steam = player.maxSteam;
    player.isOverheated = false;
    player.overheatTimer = 0;
    context.setGolemPresence(player, true);
    context.setRemotePlayerState(id, { alive: true, timer: 0, slot });
    context.sendRemoteRespawn(id, { x: spawn.x, y: spawn.y, z: spawn.z, yaw: context.getSpawnYaw(spawn), slot });
}

export function resolveRespawnWave(context: RespawnRuntimeContext, team: TeamId) {
    if (team === 'blue') {
        if (!context.localRespawnState.alive) {
            respawnLocalPlayer(context);
        }
        for (const [id, state] of context.remotePlayerStates) {
            if (state.team === 'blue' && !state.alive) {
                respawnRemotePlayer(context, id);
            }
        }
    } else {
        for (const [id, state] of context.remotePlayerStates) {
            if (state.team === 'red' && !state.alive) {
                respawnRemotePlayer(context, id);
            }
        }
    }

    for (const [id, bot] of context.bots) {
        if (bot.team === team && !bot.alive) {
            const slot = Number(id.split('-').pop() ?? 0) || 0;
            const spawn = context.getTeamSpawn(bot.team, slot);
            bot.respawnAt(new THREE.Vector3(spawn.x, spawn.y, spawn.z));
        }
    }

    context.respawnWaves[team] = 0;
    applyTeamWaveTimer(context, team, 0);
}

export function updateRespawns(context: RespawnRuntimeContext, dt: number, defaultWaveDelay: number) {
    if (context.sessionMode === 'client') {
        context.localRespawnState.timer = Math.max(0, context.localRespawnState.timer - dt);
        return;
    }

    for (const team of ['blue', 'red'] as TeamId[]) {
        if (teamHasPendingRespawns(context, team) && context.respawnWaves[team] <= 0) {
            scheduleRespawnWave(context, team, defaultWaveDelay);
        }

        if (context.respawnWaves[team] > 0) {
            context.respawnWaves[team] = Math.max(0, context.respawnWaves[team] - dt);
            applyTeamWaveTimer(context, team, context.respawnWaves[team]);
            if (context.respawnWaves[team] <= 0) {
                resolveRespawnWave(context, team);
            }
        }
    }
}
