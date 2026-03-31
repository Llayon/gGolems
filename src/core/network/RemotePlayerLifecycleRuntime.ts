import { GolemController, type GolemControllerOptions } from '../../entities/GolemController';
import type { RemoteGolemSnapshotSeed } from './applyAuthoritativePlayerState';

export type RemotePlayerLifecycleContext = {
    remotePlayers: Map<string, GolemController>;
    createRemoteGolem: (options?: GolemControllerOptions) => GolemController;
    disposeRemoteGolem: (golem: GolemController) => void;
    placeGolemAtSpawn: (golem: GolemController, snapshot: NonNullable<RemoteGolemSnapshotSeed['pos']>, yaw?: number) => void;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
};

export function removeRemoteGolem(
    context: RemotePlayerLifecycleContext,
    id: string
) {
    const remoteGolem = context.remotePlayers.get(id);
    if (!remoteGolem) {
        return false;
    }

    context.disposeRemoteGolem(remoteGolem);
    context.remotePlayers.delete(id);
    return true;
}

export function replaceRemoteGolem(
    context: RemotePlayerLifecycleContext,
    id: string,
    nextOptions: GolemControllerOptions,
    snapshot?: RemoteGolemSnapshotSeed
) {
    removeRemoteGolem(context, id);

    const remoteGolem = context.createRemoteGolem(nextOptions);
    context.remotePlayers.set(id, remoteGolem);

    if (snapshot?.pos) {
        context.placeGolemAtSpawn(remoteGolem, snapshot.pos, snapshot.legYaw ?? 0);
        remoteGolem.targetPos.set(snapshot.pos.x, snapshot.pos.y, snapshot.pos.z);
        remoteGolem.targetLegYaw = snapshot.legYaw ?? 0;
        remoteGolem.targetTorsoYaw = snapshot.torsoYaw ?? 0;
    }
    if (typeof snapshot?.hp === 'number') {
        remoteGolem.hp = snapshot.hp;
    }
    if (snapshot?.sections) {
        remoteGolem.setSectionState(snapshot.sections);
    }
    if (typeof snapshot?.alive === 'boolean') {
        context.setGolemPresence(remoteGolem, snapshot.alive);
    }

    return remoteGolem;
}

export function ensureRemoteGolemConfig(
    context: RemotePlayerLifecycleContext,
    id: string,
    options: GolemControllerOptions,
    snapshot?: RemoteGolemSnapshotSeed
) {
    const remoteGolem = context.remotePlayers.get(id);
    if (!remoteGolem) {
        return replaceRemoteGolem(context, id, options, snapshot);
    }

    const chassisMismatch = options.chassisId && remoteGolem.chassis.id !== options.chassisId;
    const loadoutMismatch = options.loadoutId && remoteGolem.loadout.id !== options.loadoutId;
    if (chassisMismatch || loadoutMismatch) {
        return replaceRemoteGolem(context, id, options, snapshot);
    }

    return remoteGolem;
}

export function removeRemoteGolems(
    context: RemotePlayerLifecycleContext,
    ids: Iterable<string>
) {
    for (const id of ids) {
        removeRemoteGolem(context, id);
    }
}
