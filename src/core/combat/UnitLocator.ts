import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { TeamId } from '../../gameplay/types';

type UnitInfo = {
    id: string;
    position: THREE.Vector3;
    team: TeamId;
    alive: boolean;
};

export type UnitLocatorContext = {
    localPlayer: { id: string; body: RAPIER.RigidBody; team: TeamId; alive: boolean };
    remotePlayers: Map<string, { id: string; body: RAPIER.RigidBody; team: TeamId; alive: boolean }>;
    remotePlayerStates: Map<string, { alive: boolean }>;
    bots: Map<string, { id: string; body: RAPIER.RigidBody; team: TeamId; alive: boolean }>;
    localUnitId: string;
};

const _tmpPos = new THREE.Vector3();

export function getUnitTeam(
    unitId: string,
    localUnitId: string,
    remotePlayers: Map<string, unknown>,
    remotePlayerStates: Map<string, unknown>
): TeamId {
    if (!unitId) return 'blue';
    if (unitId === localUnitId) return 'blue';
    if (unitId.startsWith('bot-blue')) return 'blue';
    if (unitId.startsWith('bot-red')) return 'red';
    if (remotePlayers.has(unitId) || remotePlayerStates.has(unitId)) return 'blue';
    return 'blue';
}

export function forEachEnemyPosition(
    ctx: UnitLocatorContext,
    team: TeamId,
    callback: (position: THREE.Vector3) => void
) {
    const consider = (position: THREE.Vector3, enemyTeam: TeamId, alive: boolean) => {
        if (!alive || enemyTeam === team) return;
        callback(position);
    };

    const localPos = ctx.localPlayer.body.translation();
    consider(
        _tmpPos.set(localPos.x, localPos.y, localPos.z),
        ctx.localPlayer.team,
        ctx.localPlayer.alive
    );

    ctx.remotePlayers.forEach((player) => {
        const state = ctx.remotePlayerStates.get(player.id);
        const alive = state ? state.alive : true;
        const pos = player.body.translation();
        consider(_tmpPos.set(pos.x, pos.y, pos.z), player.team, alive);
    });

    for (const bot of ctx.bots.values()) {
        const pos = bot.body.translation();
        consider(_tmpPos.set(pos.x, pos.y, pos.z), bot.team, bot.alive);
    }
}

export function getNearestEnemyTarget(
    ctx: UnitLocatorContext,
    team: TeamId,
    from: THREE.Vector3,
    maxDistance = Number.POSITIVE_INFINITY
): THREE.Vector3 | null {
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    let bestTarget: THREE.Vector3 | null = null;
    const maxDistanceSq = maxDistance * maxDistance;

    const consider = (target: THREE.Vector3, enemyTeam: TeamId, alive: boolean, yOffset = 1.4) => {
        if (!alive || enemyTeam === team) return;
        const adjusted = _tmpPos.set(target.x, target.y + yOffset, target.z);
        const distanceSq = from.distanceToSquared(adjusted);
        if (distanceSq > maxDistanceSq) return;
        if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            bestTarget = adjusted.clone();
        }
    };

    const localPos = ctx.localPlayer.body.translation();
    consider(
        _tmpPos.set(localPos.x, localPos.y, localPos.z),
        ctx.localPlayer.team,
        ctx.localPlayer.alive
    );

    ctx.remotePlayers.forEach((player) => {
        const state = ctx.remotePlayerStates.get(player.id);
        const alive = state ? state.alive : true;
        const pos = player.body.translation();
        consider(_tmpPos.set(pos.x, pos.y, pos.z), player.team, alive);
    });

    for (const bot of ctx.bots.values()) {
        const pos = bot.body.translation();
        consider(_tmpPos.set(pos.x, pos.y, pos.z), bot.team, bot.alive, 1.3);
    }

    return bestTarget;
}
