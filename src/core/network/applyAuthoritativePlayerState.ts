import type { MechCamera } from '../../camera/MechCamera';
import type {
    GolemController,
    GolemSectionState
} from '../../entities/GolemController';
import { cloneSectionState } from '../../mechs/sections';
import type { TeamId } from '../../gameplay/types';
import type { NetworkPosition, PlayerSnapshot } from './playerSnapshots';

export type LocalRespawnStateLike = {
    alive: boolean;
    timer: number;
    slot: number;
};

export type RemoteGolemSnapshotSeed = {
    pos?: NetworkPosition;
    legYaw?: number;
    torsoYaw?: number;
    hp?: number;
    sections?: GolemSectionState;
    alive?: boolean;
};

export type RemotePlayerStatePatch = LocalRespawnStateLike & {
    team: TeamId;
};

type PresenceApplier = (golem: GolemController, alive: boolean) => void;

export function buildRemoteGolemSnapshotSeed(snapshot: PlayerSnapshot): RemoteGolemSnapshotSeed {
    return {
        pos: { x: snapshot.x, y: snapshot.y, z: snapshot.z },
        legYaw: snapshot.ly,
        torsoYaw: snapshot.ty,
        hp: snapshot.hp,
        sections: cloneSectionState(snapshot.sections),
        alive: snapshot.alive
    };
}

export function buildRemotePlayerStatePatch(
    snapshot: PlayerSnapshot,
    team: TeamId
): RemotePlayerStatePatch {
    return {
        alive: snapshot.alive,
        timer: snapshot.respawnTimer,
        slot: snapshot.slot,
        team
    };
}

export function applyAuthoritativeLocalPlayerState(params: {
    snapshot: PlayerSnapshot;
    golem: GolemController;
    mechCamera: MechCamera;
    localRespawnState: LocalRespawnStateLike;
    setGolemPresence: PresenceApplier;
}) {
    const { snapshot, golem, mechCamera, localRespawnState, setGolemPresence } = params;

    localRespawnState.slot = snapshot.slot;
    localRespawnState.alive = snapshot.alive;
    localRespawnState.timer = snapshot.respawnTimer;

    if (golem.hp > snapshot.hp) {
        mechCamera.onHit(golem.hp - snapshot.hp);
    }

    golem.setSectionState(snapshot.sections);
    golem.hp = snapshot.hp;
    setGolemPresence(golem, localRespawnState.alive);
}

export function applyAuthoritativeRemotePlayerState(params: {
    snapshot: PlayerSnapshot;
    golem: GolemController;
    setGolemPresence: PresenceApplier;
}) {
    const { snapshot, golem, setGolemPresence } = params;

    golem.targetPos.set(snapshot.x, snapshot.y, snapshot.z);
    golem.targetLegYaw = snapshot.ly;
    golem.targetTorsoYaw = snapshot.ty;

    if (golem.hp > snapshot.hp) {
        golem.flashDamage();
    }

    golem.setSectionState(snapshot.sections);
    golem.hp = snapshot.hp;
    setGolemPresence(golem, snapshot.alive);
}
