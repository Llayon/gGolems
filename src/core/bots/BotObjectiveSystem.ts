import * as THREE from 'three';
import type { TeamId } from '../../gameplay/types';
import type { ArenaLaneNodeKind, ArenaLaneNodeSide } from '../../world/Arena';

export type BotObjectiveRole = 'anchor' | 'assault' | 'flank';
export type BotIntent = 'push' | 'hold' | 'contest' | 'retreat';

export type BotObjectiveContext = {
    gameMode: string;
    teamScores: { blue: number; red: number };
    controlPoints: ReadonlyArray<{
        id: string;
        owner: TeamId | 'neutral';
        capture: number;
        contested: boolean;
        blueInside: number;
        redInside: number;
        position: THREE.Vector3;
        radius: number;
    }>;
    getLaneNode: (
        pointId: string,
        kind: ArenaLaneNodeKind,
        team: TeamId,
        side: ArenaLaneNodeSide | 'center'
    ) => THREE.Vector3 | undefined;
    getNearestLaneId: (position: THREE.Vector3) => 'A' | 'B' | 'C';
    getNearestEnemyTarget: (team: TeamId, from: THREE.Vector3, maxDistance?: number) => THREE.Vector3 | null;
};

const _attackDir = new THREE.Vector3();
const _sideDir = new THREE.Vector3();
const _offsetTarget = new THREE.Vector3();

export function getBotObjectiveRole(botId: string): { role: BotObjectiveRole; slot: number; sideBias: -1 | 1 } {
    const slot = Number(botId.split('-').pop() ?? 0) || 0;
    const roleCycle: BotObjectiveRole[] = ['anchor', 'assault', 'flank'];
    return {
        role: roleCycle[slot % roleCycle.length],
        slot,
        sideBias: slot % 2 === 0 ? -1 : 1
    };
}

function getTeamControlLanes(team: TeamId) {
    return team === 'blue'
        ? { home: 'C' as const, center: 'B' as const, enemy: 'A' as const }
        : { home: 'A' as const, center: 'B' as const, enemy: 'C' as const };
}

export function getPriorityControlPoint(
    ctx: BotObjectiveContext,
    team: TeamId,
    from: THREE.Vector3,
    botId: string
) {
    const roleState = getBotObjectiveRole(botId);
    const lanes = getTeamControlLanes(team);
    const blueHeld = ctx.controlPoints.filter((p) => p.owner === 'blue').length;
    const redHeld = ctx.controlPoints.filter((p) => p.owner === 'red').length;
    const heldAdvantage = team === 'blue' ? blueHeld - redHeld : redHeld - blueHeld;
    const scoreAdvantage = team === 'blue'
        ? ctx.teamScores.blue - ctx.teamScores.red
        : ctx.teamScores.red - ctx.teamScores.blue;
    const trailing = heldAdvantage < 0 || scoreAdvantage < 0;

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestPoint: (typeof ctx.controlPoints)[number] | null = null;

    for (const point of ctx.controlPoints) {
        const friendlyInside = team === 'blue' ? point.blueInside : point.redInside;
        const enemyInside = team === 'blue' ? point.redInside : point.blueInside;
        const distance = from.distanceTo(point.position);
        const capturePressure = point.capture * (team === 'blue' ? 1 : -1);
        const fullySecured = point.owner === team && capturePressure >= 0.98;
        const needsHelp = point.contested || enemyInside > 0 || (point.owner === team && capturePressure < 0.9);
        let score = -distance * 1.45;

        if (point.contested) {
            score += 260;
        } else if (point.owner === 'neutral') {
            score += 180;
        } else if (enemyInside > 0) {
            score += 210;
        } else {
            score += 60;
        }

        if (roleState.role === 'anchor') {
            if (point.id === lanes.home) score += needsHelp ? 300 : 120;
            else if (point.id === lanes.center) score += trailing ? 150 : 80;
            else score += trailing ? 55 : -20;
        } else if (roleState.role === 'assault') {
            if (point.id === lanes.center) score += 240;
            else if (point.id === lanes.enemy) score += trailing ? 165 : 110;
            else score += needsHelp ? 120 : 10;
        } else {
            if (point.id === lanes.enemy) score += 240;
            else if (point.id === lanes.center) score += point.contested ? 170 : 95;
            else score += needsHelp ? 90 : -30;
        }

        if (point.owner === team && fullySecured) {
            score -= 25;
        }

        const desiredFriendly = roleState.role === 'anchor'
            ? (point.id === lanes.home ? 2 : 1)
            : roleState.role === 'assault'
                ? (point.id === lanes.center ? 2 : 1)
                : 1;

        score -= friendlyInside * 28;
        score -= Math.max(0, friendlyInside - desiredFriendly) * 85;
        score += enemyInside * 16;

        if (distance <= point.radius * 0.78) {
            score += 32;
        }

        if (trailing && (point.owner === 'neutral' || point.contested)) {
            score += 38;
        }

        if (!trailing && point.id === lanes.home && needsHelp) {
            score += 24;
        }

        if (score > bestScore) {
            bestScore = score;
            bestPoint = point;
        }
    }

    return bestPoint;
}

export function getControlPointStagingTarget(
    ctx: BotObjectiveContext,
    point: (typeof ctx.controlPoints)[number],
    team: TeamId,
    botId: string
): THREE.Vector3 {
    const roleState = getBotObjectiveRole(botId);
    const lanes = getTeamControlLanes(team);
    const side: ArenaLaneNodeSide = roleState.sideBias < 0 ? 'left' : 'right';
    const preferredKinds: ArenaLaneNodeKind[] = roleState.role === 'anchor'
        ? (point.id === lanes.home ? ['hold_node', 'staging_node', 'objective_entry'] : ['objective_entry', 'hold_node', 'rotate_node'])
        : roleState.role === 'assault'
            ? ['objective_entry', 'staging_node', 'rotate_node']
            : ['rotate_node', 'objective_entry', 'staging_node'];

    const enemyInside = team === 'blue' ? point.redInside : point.blueInside;
    if (point.contested || enemyInside > 0) {
        preferredKinds.unshift('objective_entry');
    }

    for (const kind of preferredKinds) {
        const node = ctx.getLaneNode(point.id, kind, team, side);
        if (node) {
            return node;
        }
    }

    const homePoint = ctx.controlPoints.find((entry) => entry.id === lanes.home);
    const enemyPoint = ctx.controlPoints.find((entry) => entry.id === lanes.enemy);
    if (!homePoint || !enemyPoint) {
        return point.position.clone();
    }

    _attackDir.copy(enemyPoint.position).sub(homePoint.position).setY(0);
    if (_attackDir.lengthSq() < 0.0001) {
        _attackDir.set(team === 'blue' ? 1 : -1, 0, 0);
    } else {
        _attackDir.normalize();
    }
    _sideDir.set(-_attackDir.z, 0, _attackDir.x);

    let attackOffset = 0;
    let sideOffset = 0;
    if (roleState.role === 'anchor') {
        attackOffset = point.id === lanes.home ? -0.34 : -0.16;
        sideOffset = 0.18 * roleState.sideBias;
    } else if (roleState.role === 'assault') {
        attackOffset = point.id === lanes.center ? 0.04 : 0.16;
        sideOffset = 0.26 * roleState.sideBias;
    } else {
        attackOffset = point.id === lanes.enemy ? 0.3 : 0.14;
        sideOffset = 0.28 * roleState.sideBias;
    }

    if (point.contested || enemyInside > 0) {
        attackOffset *= 0.55;
        sideOffset *= 0.55;
    }

    return _offsetTarget
        .copy(point.position)
        .addScaledVector(_attackDir, point.radius * attackOffset)
        .addScaledVector(_sideDir, point.radius * sideOffset)
        .clone();
}

export function getBotRetreatTarget(
    ctx: BotObjectiveContext,
    team: TeamId,
    botId: string
): THREE.Vector3 {
    const lanes = getTeamControlLanes(team);
    const homePoint = ctx.controlPoints.find((entry) => entry.id === lanes.home);
    const roleState = getBotObjectiveRole(botId);
    const side: ArenaLaneNodeSide = roleState.sideBias < 0 ? 'left' : 'right';
    const retreatNode = ctx.getLaneNode(lanes.home, 'retreat_node', team, side)
        ?? ctx.getLaneNode(lanes.home, 'retreat_node', team, 'center');
    if (retreatNode) {
        return retreatNode;
    }
    if (homePoint) {
        const retreatBase = getControlPointStagingTarget(ctx, homePoint, team, botId);
        const enemyLaneId = lanes.enemy === 'A' ? 'A' : 'C';
        const enemyPoint = ctx.controlPoints.find((entry) => entry.id === enemyLaneId);
        _attackDir.copy(
            enemyPoint?.position ?? homePoint.position
        ).sub(homePoint.position).setY(0);
        if (_attackDir.lengthSq() > 0.0001) {
            _attackDir.normalize();
            retreatBase.addScaledVector(_attackDir, -homePoint.radius * 0.42);
        }
        return retreatBase;
    }

    // Fallback: use slot-based spawn position approximation
    return new THREE.Vector3(team === 'blue' ? -40 : 40, 0, 0);
}

export function getBotMovementTarget(
    ctx: BotObjectiveContext,
    team: TeamId,
    from: THREE.Vector3,
    botId: string,
    botHpRatio: number,
    setIntent: (intent: BotIntent) => void
): THREE.Vector3 {
    const nearbyThreat = ctx.getNearestEnemyTarget(team, from, 42);
    if (botHpRatio <= 0.35 && nearbyThreat) {
        setIntent('retreat');
        return getBotRetreatTarget(ctx, team, botId);
    }

    const point = getPriorityControlPoint(ctx, team, from, botId);
    if (point) {
        const roleState = getBotObjectiveRole(botId);
        const side: ArenaLaneNodeSide = roleState.sideBias < 0 ? 'left' : 'right';
        const currentLane = ctx.getNearestLaneId(from);
        const enemyInside = team === 'blue' ? point.redInside : point.blueInside;
        const shouldRotateThroughNode = currentLane !== point.id &&
            from.distanceTo(point.position) > point.radius * 1.6 &&
            !point.contested &&
            enemyInside === 0 &&
            roleState.role !== 'anchor';

        if (shouldRotateThroughNode) {
            const rotateNode = ctx.getLaneNode(point.id, 'rotate_node', team, side)
                ?? ctx.getLaneNode(point.id, 'rotate_node', team, 'center');
            if (rotateNode && from.distanceTo(rotateNode) > 6) {
                setIntent('push');
                return rotateNode;
            }
        }

        const intent: BotIntent = point.contested || enemyInside > 0
            ? 'contest'
            : point.owner === team
                ? 'hold'
                : 'push';
        setIntent(intent);
        return getControlPointStagingTarget(ctx, point, team, botId);
    }
    setIntent('push');
    return ctx.getNearestEnemyTarget(team, from) ?? from.clone();
}
