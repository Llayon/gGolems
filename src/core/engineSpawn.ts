import * as THREE from 'three';
import type { GolemController } from '../entities/GolemController';
import type { TeamId } from '../gameplay/types';
import {
    registerRecentDeath as registerSpawnDeath,
    type RecentDeath
} from './respawn/SpawnSystem';

const _spawnDir = new THREE.Vector3();

export function getTeamSpawns<T extends { blueSpawns: THREE.Vector3[]; redSpawns: THREE.Vector3[] }>(
    world: T,
    team: TeamId
): THREE.Vector3[] {
    return team === 'blue' ? world.blueSpawns : world.redSpawns;
}

export function getTeamSpawn(
    blueSpawns: THREE.Vector3[],
    redSpawns: THREE.Vector3[],
    team: TeamId,
    slot: number,
    teamSize = blueSpawns.length
): THREE.Vector3 {
    const spawns = team === 'blue' ? blueSpawns : redSpawns;
    const safeSlot = Math.max(0, Math.min(teamSize - 1, slot));
    return spawns[safeSlot] ?? spawns[0];
}

export function registerRecentDeath(
    recentDeaths: RecentDeath[],
    team: TeamId,
    position: { x: number; y: number; z: number }
) {
    registerSpawnDeath(recentDeaths, team, position);
}

export function getSpawnYaw(spawn: { x: number; y: number; z: number }): number {
    _spawnDir.set(-spawn.x, 0, -spawn.z);
    if (_spawnDir.lengthSq() < 0.0001) return 0;

    if (Math.abs(_spawnDir.x) >= Math.abs(_spawnDir.z)) {
        return _spawnDir.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    return _spawnDir.z >= 0 ? Math.PI : 0;
}

export function placeGolemAtSpawn(golem: GolemController, spawn: { x: number; y: number; z: number }, yaw?: number) {
    const resolvedYaw = yaw ?? getSpawnYaw(spawn);
    golem.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
    golem.targetPos.set(spawn.x, spawn.y, spawn.z);
    golem.legYaw = resolvedYaw;
    golem.torsoYaw = resolvedYaw;
    golem.targetLegYaw = resolvedYaw;
    golem.targetTorsoYaw = resolvedYaw;
    golem.model.position.set(spawn.x, spawn.y - 1.5, spawn.z);
    golem.legs.rotation.y = -resolvedYaw;
    golem.torso.rotation.y = -resolvedYaw;
    golem.resetSections();

    if (golem.isLocal && golem.gameCamera) {
        golem.gameCamera.aimYaw = resolvedYaw;
    }
}
