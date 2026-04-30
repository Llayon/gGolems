import * as THREE from 'three';
import type { TeamId } from '../../gameplay/types';
import type { NetworkPosition } from '../network/playerSnapshots';

const RECENT_DEATH_WINDOW = 12;

export type RecentDeath = {
    team: TeamId;
    position: THREE.Vector3;
    age: number;
};

export type SpawnPoint = { x: number; y: number; z: number };

export type SpawnSystemContext = {
    getTeamSpawns: (team: TeamId) => THREE.Vector3[];
    controlPointPositions: Record<'A' | 'B' | 'C', THREE.Vector3>;
    controlPoints: ReadonlyArray<{
        id: 'A' | 'B' | 'C';
        owner: TeamId | 'neutral';
        capture: number;
        contested: boolean;
        blueInside: number;
        redInside: number;
        position: THREE.Vector3;
    }>;
    getControlPoints: () => ReadonlyArray<{
        id: string;
        owner: TeamId | 'neutral';
        capture: number;
        contested: boolean;
        blueInside: number;
        redInside: number;
        position: THREE.Vector3;
    }>;
    forEachEnemyPosition: (team: TeamId, callback: (pos: THREE.Vector3) => void) => void;
    recentDeaths: RecentDeath[];
    collisionMeshes: () => THREE.Object3D[];
};

const _spawnDir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

function hasLineOfSight(
    enemyPosition: THREE.Vector3,
    spawn: THREE.Vector3,
    collisionMeshes: THREE.Object3D[]
): boolean {
    _origin.copy(enemyPosition);
    _origin.y += 1.6;
    _target.copy(spawn);
    _target.y += 1.2;
    _dir.copy(_target).sub(_origin);
    const distance = _dir.length();
    if (distance <= 1) return true;
    _dir.divideScalar(distance);
    raycaster.set(_origin, _dir);
    raycaster.far = Math.max(0, distance - 1.5);
    const hits = raycaster.intersectObjects(collisionMeshes, false);
    return hits.length === 0;
}

function getRespawnObjectivePoint(
    ctx: SpawnSystemContext,
    team: TeamId
): THREE.Vector3 {
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestPoint: THREE.Vector3 | null = null;

    for (const point of ctx.controlPoints) {
        const capturePressure = point.capture * (team === 'blue' ? 1 : -1);
        let score = point.id === 'B' ? 24 : 0;

        if (point.contested) {
            score += 220;
        } else if (point.owner === 'neutral') {
            score += 150;
        } else if (point.owner === team && capturePressure < 0.9) {
            score += 110;
        } else {
            score += 40;
        }

        const enemyInside = team === 'blue' ? point.redInside : point.blueInside;
        const friendlyInside = team === 'blue' ? point.blueInside : point.redInside;
        score += enemyInside * 18;
        score -= friendlyInside * 12;

        if (score > bestScore) {
            bestScore = score;
            bestPoint = point.position;
        }
    }

    return (bestPoint ?? ctx.controlPointPositions.B).clone();
}

export function registerRecentDeath(
    deaths: RecentDeath[],
    team: TeamId,
    position: { x: number; y: number; z: number }
) {
    deaths.push({
        team,
        position: new THREE.Vector3(position.x, position.y, position.z),
        age: 0
    });
    if (deaths.length > 32) {
        deaths.splice(0, deaths.length - 32);
    }
}

export function ageRecentDeaths(deaths: RecentDeath[], dt: number): RecentDeath[] {
    return deaths
        .map((entry) => ({ ...entry, age: entry.age + dt }))
        .filter((entry) => entry.age < RECENT_DEATH_WINDOW);
}

export function getTeamSpawn(
    ctx: SpawnSystemContext,
    team: TeamId,
    slot: number
): SpawnPoint {
    const spawns = ctx.getTeamSpawns(team);
    const spawn = spawns[slot % spawns.length];
    return { x: spawn.x, y: spawn.y, z: spawn.z };
}

export function resolveTeamSpawn(
    ctx: SpawnSystemContext,
    team: TeamId,
    preferredSlot: number
): { slot: number; spawn: SpawnPoint } {
    const spawns = ctx.getTeamSpawns(team);
    const objective = getRespawnObjectivePoint(ctx, team);
    const preferredIndex = preferredSlot % spawns.length;
    let bestIndex = preferredIndex;
    let bestScore = Number.NEGATIVE_INFINITY;

    const collisionMeshes = ctx.collisionMeshes();

    for (let index = 0; index < spawns.length; index++) {
        const spawn = spawns[index];
        let score = index === preferredIndex ? 18 : 0;
        score -= spawn.distanceTo(objective) * 0.22;

        ctx.forEachEnemyPosition(team, (enemyPosition) => {
            const distance = spawn.distanceTo(enemyPosition);
            if (distance < 42) {
                score -= 260 + (42 - distance) * 8;
            } else if (distance < 72) {
                score -= (72 - distance) * 2.4;
            }

            if (distance < 96 && hasLineOfSight(enemyPosition, spawn, collisionMeshes)) {
                score -= distance < 68 ? 180 : 96;
            }
        });

        for (const death of ctx.recentDeaths) {
            const distance = spawn.distanceTo(death.position);
            if (distance > 72) continue;
            const freshness = 1 - death.age / RECENT_DEATH_WINDOW;
            const severity = death.team === team ? 190 : 74;
            score -= freshness * severity * (1 - distance / 72);
        }

        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }

    const selected = spawns[bestIndex];
    return {
        slot: bestIndex,
        spawn: {
            x: selected.x,
            y: selected.y,
            z: selected.z
        }
    };
}

export function getSpawnYaw(spawn: NetworkPosition): number {
    _spawnDir.set(-spawn.x, 0, -spawn.z);
    if (_spawnDir.lengthSq() < 0.0001) return 0;

    if (Math.abs(_spawnDir.x) >= Math.abs(_spawnDir.z)) {
        return _spawnDir.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    return _spawnDir.z >= 0 ? Math.PI : 0;
}
