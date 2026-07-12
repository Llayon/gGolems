import * as THREE from 'three';
import type { GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import type { NetworkManager } from '../network/NetworkManager';
import type { ControlPointManager } from '../gameplay/ControlPointManager';
import type { GolemController } from '../entities/GolemController';
import type { DummyBot } from '../entities/DummyBot';
import type { PropManager } from '../world/PropManager';
import type { PlayerRespawnState, RemotePlayerState } from './respawn/types';
import {
    buildAuthoritativePlayerSnapshots,
    type NetworkPosition
} from './network/playerSnapshots';
import {
    buildAuthoritativeStateMessage,
    type AuthoritativeStateMessage
} from './network/NetworkSyncAdapter';
import { buildBotSnapshots } from './bots/BotRuntime';
import { buildClientInputPacket, type ClientInputPacket } from './network/clientInputPacket';
import { syncNetworkTick } from './network/NetworkSyncAdapter';

const NETWORK_TICK_INTERVAL = 0.05;

export type NetworkTickContext = {
    sessionMode: 'solo' | 'host' | 'client';
    network: NetworkManager;
    networkTickTimer: { value: number };
    gameMode: GameMode;
    teamScores: TeamScoreState;
    controlPoints: ControlPointManager;
    propManager: PropManager;
    bots: Map<string, DummyBot>;
    golem: GolemController;
    localRespawnState: PlayerRespawnState;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    remoteSpawnSlots: Map<string, number>;
    getLocalUnitId: () => string;
};

function buildHostSnapshot(ctx: NetworkTickContext) {
    const pos = ctx.golem.body.translation();
    const localSig = ctx.golem.signatureState;
    const snapshotSources = [{
        id: ctx.getLocalUnitId(),
        position: { x: pos.x, y: pos.y, z: pos.z },
        legYaw: ctx.golem.legYaw,
        torsoYaw: ctx.golem.torsoYaw,
        chassisId: ctx.golem.chassis.id,
        loadoutId: ctx.golem.loadout.id,
        hp: ctx.golem.hp,
        sections: ctx.golem.sections,
        alive: ctx.localRespawnState.alive,
        respawnTimer: ctx.localRespawnState.timer,
        slot: ctx.localRespawnState.slot,
        signatureId: localSig.abilityId,
        signatureActiveTimer: localSig.isActive ? localSig.activeTimer : 0
    }];

    ctx.remotePlayers.forEach((player, id) => {
        const state = ctx.remotePlayerStates.get(id)
            ?? { alive: true, timer: 0, slot: ctx.remoteSpawnSlots.get(id) ?? 1, team: 'blue' as TeamId };
        const pPos = player.body.translation();
        const playerSig = player.signatureState;
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
            slot: state.slot,
            signatureId: playerSig.abilityId,
            signatureActiveTimer: playerSig.isActive ? playerSig.activeTimer : 0
        });
    });

    return buildAuthoritativeStateMessage({
        players: buildAuthoritativePlayerSnapshots(snapshotSources),
        bots: buildBotSnapshots(ctx.bots),
        mode: ctx.gameMode,
        points: ctx.controlPoints.getSnapshot(),
        scores: ctx.teamScores,
        props: ctx.propManager.getSnapshot()
    });
}

function buildClientInput(ctx: NetworkTickContext): ClientInputPacket | undefined {
    if (!ctx.localRespawnState.alive) return undefined;
    const pos = ctx.golem.body.translation();
    return buildClientInputPacket({
        position: { x: pos.x, y: pos.y, z: pos.z },
        legYaw: ctx.golem.legYaw,
        torsoYaw: ctx.golem.torsoYaw,
        chassisId: ctx.golem.chassis.id,
        loadoutId: ctx.golem.loadout.id
    });
}

export function updateNetworkTick(ctx: NetworkTickContext, dt: number) {
    const matchEnded = ctx.teamScores.winner !== null;
    ctx.networkTickTimer.value += dt;
    if (ctx.networkTickTimer.value < NETWORK_TICK_INTERVAL) return;
    ctx.networkTickTimer.value = 0;

    let authoritativeStateMessage: AuthoritativeStateMessage | undefined;
    let clientInputPacket: ClientInputPacket | undefined;

    if (ctx.sessionMode === 'host') {
        authoritativeStateMessage = buildHostSnapshot(ctx);
    } else if (ctx.sessionMode === 'client') {
        clientInputPacket = buildClientInput(ctx);
    }

    syncNetworkTick({
        sessionMode: ctx.sessionMode,
        network: ctx.network,
        localAlive: ctx.localRespawnState.alive,
        matchEnded,
        authoritativeStateMessage,
        clientInputPacket
    });
}
