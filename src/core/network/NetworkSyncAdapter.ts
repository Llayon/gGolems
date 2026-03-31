import type { GolemController } from '../../entities/GolemController';
import type { BotStateView, GameMode, TeamId, TeamScoreState } from '../../gameplay/types';
import type { NetworkManager } from '../../network/NetworkManager';
import type { RemotePlayerLifecycleContext } from './RemotePlayerLifecycleRuntime';
import { ensureRemoteGolemConfig, removeRemoteGolem } from './RemotePlayerLifecycleRuntime';
import type { ClientInputPacket } from './clientInputPacket';
import type { NetworkPosition, PlayerSnapshotMap } from './playerSnapshots';
import type { RemotePlayerState, RespawnSessionMode } from '../respawn/types';

export type AuthoritativeStateMessage<TPoints = unknown, TProps = unknown> = {
    type: 'state';
    players: PlayerSnapshotMap;
    bots: BotStateView[];
    mode: GameMode;
    points: TPoints;
    scores: TeamScoreState;
    props: TProps;
};

export type NetworkSyncTickContext<TPoints = unknown, TProps = unknown> = {
    sessionMode: RespawnSessionMode;
    network: NetworkManager;
    localAlive: boolean;
    matchEnded: boolean;
    authoritativeStateMessage?: AuthoritativeStateMessage<TPoints, TProps>;
    clientInputPacket?: ClientInputPacket;
};

export type NetworkPeerLifecycleContext = {
    sessionMode: RespawnSessionMode;
    lifecycle: RemotePlayerLifecycleContext;
    remotePlayerStates: Map<string, RemotePlayerState>;
    remoteSpawnSlots: Map<string, number>;
    allocateRemoteSpawnSlot: () => number;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    getTeamSpawn: (team: TeamId, slot: number) => NetworkPosition;
    getSpawnYaw: (spawn: NetworkPosition) => number;
    placeGolemAtSpawn: (golem: GolemController, spawn: NetworkPosition, yaw?: number) => void;
    sendRespawn: (id: string, payload: { x: number; y: number; z: number; yaw: number; slot: number }) => void;
    syncTeamBotRoster: () => void;
};

export function buildAuthoritativeStateMessage<TPoints, TProps>(params: {
    players: PlayerSnapshotMap;
    bots: BotStateView[];
    mode: GameMode;
    points: TPoints;
    scores: TeamScoreState;
    props: TProps;
}): AuthoritativeStateMessage<TPoints, TProps> {
    return {
        type: 'state',
        players: params.players,
        bots: params.bots,
        mode: params.mode,
        points: params.points,
        scores: { ...params.scores },
        props: params.props
    };
}

export function syncNetworkTick<TPoints, TProps>(context: NetworkSyncTickContext<TPoints, TProps>) {
    if (context.sessionMode === 'host') {
        if (context.authoritativeStateMessage) {
            context.network.broadcast(context.authoritativeStateMessage);
        }
        return;
    }

    if (context.sessionMode === 'client' && context.localAlive && !context.matchEnded && context.clientInputPacket) {
        context.network.sendToHost(context.clientInputPacket);
    }
}

export function handlePeerConnect(context: NetworkPeerLifecycleContext, id: string) {
    const remoteGolem = ensureRemoteGolemConfig(context.lifecycle, id, {});

    if (context.sessionMode === 'host') {
        const spawnSlot = context.allocateRemoteSpawnSlot();
        context.remoteSpawnSlots.set(id, spawnSlot);
        context.setRemotePlayerState(id, { alive: true, timer: 0, slot: spawnSlot, team: 'blue' });
        const spawn = context.getTeamSpawn('blue', spawnSlot);
        const yaw = context.getSpawnYaw(spawn);
        context.placeGolemAtSpawn(remoteGolem, spawn, yaw);
        context.sendRespawn(id, { x: spawn.x, y: spawn.y, z: spawn.z, yaw, slot: spawnSlot });
        context.syncTeamBotRoster();
    } else if (context.sessionMode === 'client') {
        context.setRemotePlayerState(id, { alive: true, timer: 0, slot: 0, team: 'blue' });
        context.placeGolemAtSpawn(remoteGolem, context.getTeamSpawn('blue', 0));
    }
}

export function handlePeerDisconnect(context: NetworkPeerLifecycleContext, id: string) {
    removeRemoteGolem(context.lifecycle, id);
    context.remotePlayerStates.delete(id);
    context.remoteSpawnSlots.delete(id);
    if (context.sessionMode === 'host') {
        context.syncTeamBotRoster();
    }
}
