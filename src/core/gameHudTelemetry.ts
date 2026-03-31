import * as THREE from 'three';
import type { DummyBot } from '../entities/DummyBot';
import type { GolemController } from '../entities/GolemController';
import type { TeamId } from '../gameplay/types';
import type { RadarContact } from './gameHudState';
import type { RemotePlayerState, RespawnSessionMode } from './respawn/types';

const _radarDelta = new THREE.Vector3();
const _radarRight = new THREE.Vector3();
const _radarForward = new THREE.Vector3();

export type HitConfirmState = {
    hitConfirmTimer: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
};

export type HitConfirmRuntimeContext = {
    sessionMode: RespawnSessionMode;
    myId: string;
    getLocalUnitId: () => string;
    registerHitConfirm: (targetHp: number, targetMaxHp: number) => void;
    sendHitConfirm: (ownerId: string, payload: { type: 'hitConfirm'; hp: number; maxHp: number }) => void;
};

export type RadarContactsRuntimeContext = {
    localPlayer: GolemController;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    bots: Map<string, DummyBot>;
    maxRange?: number;
};

export function registerHitConfirmState(
    setState: (next: HitConfirmState) => void,
    targetHp: number,
    targetMaxHp: number
) {
    setState({
        hitConfirmTimer: 0.22,
        hitTargetHp: Math.max(0, targetHp),
        hitTargetMaxHp: Math.max(1, targetMaxHp)
    });
}

export function confirmHitForOwner(
    context: HitConfirmRuntimeContext,
    ownerId: string,
    targetHp: number,
    targetMaxHp: number
) {
    if (!ownerId || ownerId.startsWith('bot-')) return;

    const localUnitId = context.getLocalUnitId();
    const isLocalShooter = context.sessionMode === 'solo'
        ? ownerId === localUnitId
        : ownerId === context.myId || ownerId === localUnitId;

    if (isLocalShooter) {
        context.registerHitConfirm(targetHp, targetMaxHp);
        return;
    }

    if (context.sessionMode === 'host') {
        context.sendHitConfirm(ownerId, { type: 'hitConfirm', hp: targetHp, maxHp: targetMaxHp });
    }
}

export function buildRadarContacts(context: RadarContactsRuntimeContext): RadarContact[] {
    const localPos = context.localPlayer.body.translation();
    const maxRange = context.maxRange ?? 90;
    const contacts: RadarContact[] = [];
    const yaw = context.localPlayer.legYaw;

    _radarRight.set(Math.cos(yaw), 0, Math.sin(yaw));
    _radarForward.set(Math.sin(yaw), 0, -Math.cos(yaw));

    const pushContact = (worldX: number, worldZ: number, kind: 'enemy' | 'bot') => {
        _radarDelta.set(worldX - localPos.x, 0, worldZ - localPos.z);
        const distance = _radarDelta.length();
        if (distance < 0.001 || distance > maxRange) return;

        let x = _radarDelta.dot(_radarRight) / maxRange;
        let y = _radarDelta.dot(_radarForward) / maxRange;
        const radial = Math.hypot(x, y);
        if (radial > 1) {
            x /= radial;
            y /= radial;
        }

        contacts.push({
            x: Number(x.toFixed(3)),
            y: Number(y.toFixed(3)),
            kind,
            distance: Number((distance / maxRange).toFixed(3)),
            meters: Math.round(distance)
        });
    };

    context.remotePlayers.forEach((player, id) => {
        const pos = player.body.translation();
        const state = context.remotePlayerStates.get(id);
        if (state?.team === 'red' && state.alive) {
            pushContact(pos.x, pos.z, 'enemy');
        }
    });

    for (const bot of context.bots.values()) {
        if (bot.team === 'red' && bot.alive) {
            const pos = bot.body.translation();
            pushContact(pos.x, pos.z, 'bot');
        }
    }

    contacts.sort((left, right) => left.distance - right.distance);
    return contacts.slice(0, 6);
}
