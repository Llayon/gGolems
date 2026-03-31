import { CHASSIS_DEFINITIONS, LOADOUT_DEFINITIONS } from '../../mechs/definitions';
import type { ChassisId, LoadoutId } from '../../mechs/types';
import type { NetworkPosition } from './playerSnapshots';

export type ClientInputPacket = {
    type: 'input';
    pos: NetworkPosition;
    ly: number;
    ty: number;
    chassisId: ChassisId;
    loadoutId: LoadoutId;
};

export type ClientInputPacketSource = {
    position: NetworkPosition;
    legYaw: number;
    torsoYaw: number;
    chassisId: ChassisId;
    loadoutId: LoadoutId;
};

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

export function buildClientInputPacket(source: ClientInputPacketSource): ClientInputPacket {
    return {
        type: 'input',
        pos: {
            x: source.position.x,
            y: source.position.y,
            z: source.position.z
        },
        ly: source.legYaw,
        ty: source.torsoYaw,
        chassisId: source.chassisId,
        loadoutId: source.loadoutId
    };
}

export function readClientInputPacket(value: unknown): ClientInputPacket | null {
    if (!isRecord(value) || value.type !== 'input' || !isRecord(value.pos)) {
        return null;
    }

    if (
        !isFiniteNumber(value.pos.x) ||
        !isFiniteNumber(value.pos.y) ||
        !isFiniteNumber(value.pos.z) ||
        !isFiniteNumber(value.ly) ||
        !isFiniteNumber(value.ty) ||
        !isChassisId(value.chassisId) ||
        !isLoadoutId(value.loadoutId)
    ) {
        return null;
    }

    return {
        type: 'input',
        pos: {
            x: value.pos.x,
            y: value.pos.y,
            z: value.pos.z
        },
        ly: value.ly,
        ty: value.ty,
        chassisId: value.chassisId,
        loadoutId: value.loadoutId
    };
}
