import type { ChassisId, LoadoutId } from '../../mechs/types';
import type { PlayerSnapshot, PlayerSnapshotMap } from './playerSnapshots';

export type RemotePlayerConfigRef = {
    chassisId: ChassisId;
    loadoutId: LoadoutId;
};

export type ReconciledRemotePlayer = {
    id: string;
    snapshot: PlayerSnapshot;
    config: RemotePlayerConfigRef;
};

export type ReconcileRemotePlayersPlan = {
    removeIds: string[];
    localPlayerSnapshot?: PlayerSnapshot;
    remotePlayers: ReconciledRemotePlayer[];
};

export type ReconcileRemotePlayersInput = {
    currentRemotePlayerIds: Iterable<string>;
    playerSnapshots: PlayerSnapshotMap;
    localPlayerId: string;
};

export function reconcileRemotePlayerSet(input: ReconcileRemotePlayersInput): ReconcileRemotePlayersPlan {
    const remotePlayers: ReconciledRemotePlayer[] = [];
    let localPlayerSnapshot: PlayerSnapshot | undefined;

    for (const [id, snapshot] of Object.entries(input.playerSnapshots)) {
        if (id === input.localPlayerId) {
            localPlayerSnapshot = snapshot;
            continue;
        }

        remotePlayers.push({
            id,
            snapshot,
            config: {
                chassisId: snapshot.chassisId,
                loadoutId: snapshot.loadoutId
            }
        });
    }

    const authoritativeRemoteIds = new Set(remotePlayers.map((player) => player.id));
    const removeIds: string[] = [];
    for (const currentId of input.currentRemotePlayerIds) {
        if (!authoritativeRemoteIds.has(currentId)) {
            removeIds.push(currentId);
        }
    }

    return {
        removeIds,
        localPlayerSnapshot,
        remotePlayers
    };
}
