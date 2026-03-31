import type { BotStateView, GameMode, TeamScoreState } from '../../gameplay/types';
import type { MechCamera } from '../../camera/MechCamera';
import type { GolemController } from '../../entities/GolemController';
import type { PlayerRespawnState, RemotePlayerState } from '../respawn/types';
import {
    applyAuthoritativeLocalPlayerState,
    applyAuthoritativeRemotePlayerState,
    buildRemoteGolemSnapshotSeed,
    buildRemotePlayerStatePatch
} from './applyAuthoritativePlayerState';
import type { ClientInputPacket } from './clientInputPacket';
import {
    ensureRemoteGolemConfig,
    removeRemoteGolems,
    type RemotePlayerLifecycleContext
} from './RemotePlayerLifecycleRuntime';
import { readPlayerSnapshotMap } from './playerSnapshots';
import { reconcileRemotePlayerSet } from './reconcileRemotePlayers';
import { readFireShotPayloads, type FireShotPayload } from '../combat/ProjectileCombatRuntime';

export type AuthoritativeStateMessageLike = {
    players?: unknown;
    bots?: BotStateView[];
    mode?: GameMode;
    points?: unknown;
    scores?: TeamScoreState;
    props?: unknown;
};

export type AuthoritativeStateRuntimeContext = {
    propManager: { applySnapshot: (snapshot: unknown) => void };
    controlPoints: { setState: (state: any) => void };
    setTeamScores: (scores: TeamScoreState) => void;
    setGameMode: (mode: GameMode) => void;
    applyBotSnapshots: (botStates: BotStateView[]) => void;
    lifecycle: RemotePlayerLifecycleContext;
    remotePlayerStates: Map<string, RemotePlayerState>;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    getLocalUnitId: () => string;
    localPlayer: GolemController;
    mechCamera: MechCamera;
    localRespawnState: PlayerRespawnState;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
};

export type HostClientInputRuntimeContext = {
    remotePlayerStates: Map<string, RemotePlayerState>;
    lifecycle: RemotePlayerLifecycleContext;
};

export type RespawnMessageLike = {
    x: number;
    y: number;
    z: number;
    yaw?: number;
    slot?: number;
};

export type RespawnMessageRuntimeContext = {
    localRespawnState: PlayerRespawnState;
    localPlayer: GolemController;
    mechCamera: MechCamera;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
};

export type RestartMatchMessageLike = {
    mode?: GameMode;
};

export type RestartMatchRuntimeContext = {
    setGameMode: (mode: GameMode) => void;
    restartMatch: (fromNetwork?: boolean) => boolean;
};

export type RemoteFireMessageLike = {
    ownerId?: string;
    shots?: FireShotPayload[];
    ox?: number;
    oy?: number;
    oz?: number;
    dx?: number;
    dy?: number;
    dz?: number;
};

export type RemoteFireRuntimeContext = {
    myId: string;
    isHost: boolean;
    applyRemoteFire: (ownerId: string, shots: FireShotPayload[]) => void;
    forwardFireMessage: (senderId: string, data: RemoteFireMessageLike) => void;
};

export type HitConfirmMessageLike = {
    hp?: number;
    maxHp?: number;
};

export function applyAuthoritativeStateMessage(
    context: AuthoritativeStateRuntimeContext,
    data: AuthoritativeStateMessageLike
) {
    if (data.props) {
        context.propManager.applySnapshot(data.props);
    }
    if (data.points) {
        context.controlPoints.setState(data.points);
    }
    if (data.scores) {
        context.setTeamScores(data.scores);
    }
    if (data.mode === 'control' || data.mode === 'tdm') {
        context.setGameMode(data.mode);
    }
    if (data.bots) {
        context.applyBotSnapshots(data.bots);
    }

    const playerSnapshots = readPlayerSnapshotMap(data.players);
    if (!playerSnapshots) return;

    const reconcilePlan = reconcileRemotePlayerSet({
        currentRemotePlayerIds: context.lifecycle.remotePlayers.keys(),
        playerSnapshots,
        localPlayerId: context.getLocalUnitId()
    });

    removeRemoteGolems(context.lifecycle, reconcilePlan.removeIds);
    for (const id of reconcilePlan.removeIds) {
        context.remotePlayerStates.delete(id);
    }

    if (reconcilePlan.localPlayerSnapshot) {
        applyAuthoritativeLocalPlayerState({
            snapshot: reconcilePlan.localPlayerSnapshot,
            golem: context.localPlayer,
            mechCamera: context.mechCamera,
            localRespawnState: context.localRespawnState,
            setGolemPresence: context.setGolemPresence
        });
    }

    for (const remoteEntry of reconcilePlan.remotePlayers) {
        const remoteGolem = ensureRemoteGolemConfig(
            context.lifecycle,
            remoteEntry.id,
            remoteEntry.config,
            buildRemoteGolemSnapshotSeed(remoteEntry.snapshot)
        );

        context.setRemotePlayerState(
            remoteEntry.id,
            buildRemotePlayerStatePatch(remoteEntry.snapshot, 'blue')
        );

        applyAuthoritativeRemotePlayerState({
            snapshot: remoteEntry.snapshot,
            golem: remoteGolem,
            setGolemPresence: context.setGolemPresence
        });
    }
}

export function applyClientInputToRemotePlayer(
    context: HostClientInputRuntimeContext,
    id: string,
    inputPacket: ClientInputPacket
) {
    if (!context.remotePlayerStates.get(id)?.alive) return;

    const remoteGolem = ensureRemoteGolemConfig(context.lifecycle, id, {
        chassisId: inputPacket.chassisId,
        loadoutId: inputPacket.loadoutId
    }, {
        pos: inputPacket.pos,
        legYaw: inputPacket.ly,
        torsoYaw: inputPacket.ty,
        alive: context.remotePlayerStates.get(id)?.alive !== false
    });

    if (!remoteGolem) return;

    remoteGolem.targetLegYaw = inputPacket.ly;
    remoteGolem.targetTorsoYaw = inputPacket.ty;
    remoteGolem.targetPos.set(inputPacket.pos.x, inputPacket.pos.y, inputPacket.pos.z);
}

export function applyRespawnMessage(
    context: RespawnMessageRuntimeContext,
    data: RespawnMessageLike
) {
    if (typeof data.slot === 'number') {
        context.localRespawnState.slot = data.slot;
    }
    context.localPlayer.body.setTranslation({ x: data.x, y: data.y, z: data.z }, true);
    context.localPlayer.targetPos.set(data.x, data.y, data.z);
    if (typeof data.yaw === 'number') {
        context.localPlayer.legYaw = data.yaw;
        context.localPlayer.torsoYaw = data.yaw;
        context.localPlayer.targetLegYaw = data.yaw;
        context.localPlayer.targetTorsoYaw = data.yaw;
        context.mechCamera.aimYaw = data.yaw;
    }
    context.localRespawnState.alive = true;
    context.localRespawnState.timer = 0;
    context.localPlayer.resetSections();
    context.localPlayer.steam = context.localPlayer.maxSteam;
    context.localPlayer.isOverheated = false;
    context.localPlayer.overheatTimer = 0;
    context.setGolemPresence(context.localPlayer, true);
    context.mechCamera.addTrauma(1.0);
}

export function applyRestartMatchMessage(
    context: RestartMatchRuntimeContext,
    data: RestartMatchMessageLike
) {
    if (data.mode === 'control' || data.mode === 'tdm') {
        context.setGameMode(data.mode);
    }
    context.restartMatch(true);
}

export function applyRemoteFireMessage(
    context: RemoteFireRuntimeContext,
    senderId: string,
    data: RemoteFireMessageLike
) {
    if (senderId === context.myId) return;

    const ownerId = context.isHost ? senderId : (data.ownerId ?? senderId);
    const shots = readFireShotPayloads(data);
    context.applyRemoteFire(ownerId, shots);

    if (context.isHost) {
        context.forwardFireMessage(senderId, data);
    }
}

export function applyHitConfirmMessage(
    registerHitConfirm: (targetHp: number, targetMaxHp: number) => void,
    data: HitConfirmMessageLike
) {
    registerHitConfirm(data.hp ?? 0, data.maxHp ?? 100);
}
