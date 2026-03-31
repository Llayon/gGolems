import { CHASSIS_DEFINITIONS, LOADOUT_DEFINITIONS } from '../../mechs/definitions';
import {
    GOLEM_SECTION_ORDER,
    cloneSectionState,
    type GolemSection,
    type GolemSectionState
} from '../../mechs/sections';
import type { ChassisId, LoadoutId } from '../../mechs/types';

export type NetworkPosition = {
    x: number;
    y: number;
    z: number;
};

export type PlayerSnapshot = {
    x: number;
    y: number;
    z: number;
    ly: number;
    ty: number;
    chassisId: ChassisId;
    loadoutId: LoadoutId;
    hp: number;
    sections: GolemSectionState;
    alive: boolean;
    respawnTimer: number;
    slot: number;
};

export type PlayerSnapshotMap = Record<string, PlayerSnapshot>;

export type AuthoritativePlayerSnapshotSource = {
    id: string;
    position: NetworkPosition;
    legYaw: number;
    torsoYaw: number;
    chassisId: ChassisId;
    loadoutId: LoadoutId;
    hp: number;
    sections: GolemSectionState;
    alive: boolean;
    respawnTimer: number;
    slot: number;
};

function roundToHundredths(value: number) {
    return Number(value.toFixed(2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isChassisId(value: unknown): value is ChassisId {
    return typeof value === 'string' && value in CHASSIS_DEFINITIONS;
}

function isLoadoutId(value: unknown): value is LoadoutId {
    return typeof value === 'string' && value in LOADOUT_DEFINITIONS;
}

function readSectionState(value: unknown): GolemSectionState | null {
    if (!isRecord(value)) {
        return null;
    }

    const sections = {} as Record<GolemSection, number>;
    for (const section of GOLEM_SECTION_ORDER) {
        const amount = value[section];
        if (!isFiniteNumber(amount)) {
            return null;
        }
        sections[section] = amount;
    }

    return cloneSectionState(sections as GolemSectionState);
}

export function buildPlayerSnapshot(source: AuthoritativePlayerSnapshotSource): PlayerSnapshot {
    return {
        x: roundToHundredths(source.position.x),
        y: roundToHundredths(source.position.y),
        z: roundToHundredths(source.position.z),
        ly: roundToHundredths(source.legYaw),
        ty: roundToHundredths(source.torsoYaw),
        chassisId: source.chassisId,
        loadoutId: source.loadoutId,
        hp: source.hp,
        sections: cloneSectionState(source.sections),
        alive: source.alive,
        respawnTimer: roundToHundredths(source.respawnTimer),
        slot: source.slot
    };
}

export function buildAuthoritativePlayerSnapshots(
    sources: Iterable<AuthoritativePlayerSnapshotSource>
): PlayerSnapshotMap {
    const snapshots: PlayerSnapshotMap = {};

    for (const source of sources) {
        snapshots[source.id] = buildPlayerSnapshot(source);
    }

    return snapshots;
}

export function readPlayerSnapshot(value: unknown): PlayerSnapshot | null {
    if (!isRecord(value)) {
        return null;
    }

    const sections = readSectionState(value.sections);
    if (!sections) {
        return null;
    }

    if (
        !isFiniteNumber(value.x) ||
        !isFiniteNumber(value.y) ||
        !isFiniteNumber(value.z) ||
        !isFiniteNumber(value.ly) ||
        !isFiniteNumber(value.ty) ||
        !isChassisId(value.chassisId) ||
        !isLoadoutId(value.loadoutId) ||
        !isFiniteNumber(value.hp) ||
        typeof value.alive !== 'boolean' ||
        !isFiniteNumber(value.respawnTimer) ||
        !isFiniteNumber(value.slot)
    ) {
        return null;
    }

    return {
        x: value.x,
        y: value.y,
        z: value.z,
        ly: value.ly,
        ty: value.ty,
        chassisId: value.chassisId,
        loadoutId: value.loadoutId,
        hp: value.hp,
        sections,
        alive: value.alive,
        respawnTimer: value.respawnTimer,
        slot: value.slot
    };
}

export function readPlayerSnapshotMap(value: unknown): PlayerSnapshotMap | null {
    if (!isRecord(value)) {
        return null;
    }

    const snapshots: PlayerSnapshotMap = {};
    for (const [id, rawSnapshot] of Object.entries(value)) {
        const snapshot = readPlayerSnapshot(rawSnapshot);
        if (snapshot) {
            snapshots[id] = snapshot;
        }
    }

    return snapshots;
}
