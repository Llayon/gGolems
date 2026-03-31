import * as THREE from 'three';
import type { WeaponFireRequest, ProjectileProfileId, WeaponId, WeaponMountId } from '../../combat/weaponTypes';
import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { MechCamera } from '../../camera/MechCamera';
import type { ProjectileManager } from '../../combat/ProjectileManager';
import type { DecalManager } from '../../fx/DecalManager';
import type { PropManager } from '../../world/PropManager';
import type { TeamId } from '../../gameplay/types';

const _weaponOrigin = new THREE.Vector3();
const _weaponDir = new THREE.Vector3();
const _cameraAimDir = new THREE.Vector3();
const _spreadRight = new THREE.Vector3();
const _spreadUp = new THREE.Vector3();
const _spreadDir = new THREE.Vector3();
const _muzzleOrigin = new THREE.Vector3();
const _shotBaseDir = new THREE.Vector3();

export type FireShotPayload = {
    weaponId: WeaponId;
    mountId?: WeaponMountId;
    profile: ProjectileProfileId;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
    damage: number;
    speed: number;
    range: number;
};

export type WeaponFireRuntimeContext = {
    golem: Pick<GolemController, 'getWeaponMuzzleOrigin' | 'triggerWeaponRecoil'>;
    mechCamera: MechCamera;
    camera: THREE.Camera;
    projectiles: ProjectileManager;
    playWeaponVolleyFx: (shots: FireShotPayload[]) => void;
    broadcastFire?: (ownerId: string, shots: FireShotPayload[]) => void;
};

export type RemoteFireRuntimeContext = {
    projectiles: ProjectileManager;
    remotePlayers: Map<string, GolemController>;
    playWeaponVolleyFx: (shots: FireShotPayload[]) => void;
};

export type ProjectileCollisionRuntimeContext = {
    projectiles: ProjectileManager;
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    localPlayer: GolemController;
    localPlayerId: string;
    authorityMode: boolean;
    collisionMeshes: THREE.Mesh[];
    propManager: PropManager;
    decals: DecalManager;
    getUnitTeam: (id: string) => TeamId | null;
    isTargetAlive: (id: string) => boolean;
    onPlayerHit: (ownerId: string, targetId: string, damage: number, section: GolemSection | '__bot__') => void;
};

function getSpreadDirection(baseDir: THREE.Vector3, spread: number) {
    const spreadScale = Math.max(0, spread);
    if (spreadScale <= 0.00001) {
        return _spreadDir.copy(baseDir);
    }

    const referenceUp = Math.abs(baseDir.y) > 0.92 ? _spreadUp.set(1, 0, 0) : _spreadUp.set(0, 1, 0);
    _spreadRight.crossVectors(baseDir, referenceUp).normalize();
    _spreadUp.crossVectors(_spreadRight, baseDir).normalize();
    return _spreadDir
        .copy(baseDir)
        .addScaledVector(_spreadRight, (Math.random() - 0.5) * spreadScale)
        .addScaledVector(_spreadUp, (Math.random() - 0.5) * spreadScale)
        .normalize();
}

export function readFireShotPayloads(data: any): FireShotPayload[] {
    if (Array.isArray(data.shots)) {
        return data.shots as FireShotPayload[];
    }

    return [{
        weaponId: 'rune_bolt',
        mountId: undefined,
        profile: 'bolt',
        ox: data.ox,
        oy: data.oy,
        oz: data.oz,
        dx: data.dx,
        dy: data.dy,
        dz: data.dz,
        damage: 15,
        speed: 60,
        range: 85
    }];
}

export function spawnShot(projectiles: ProjectileManager, shot: FireShotPayload, ownerId: string) {
    projectiles.fire({
        origin: _weaponOrigin.set(shot.ox, shot.oy, shot.oz).clone(),
        dir: _weaponDir.set(shot.dx, shot.dy, shot.dz).clone(),
        ownerId,
        weaponId: shot.weaponId,
        profile: shot.profile,
        damage: shot.damage,
        speed: shot.speed,
        range: shot.range
    });
}

export function fireWeaponRequests(
    context: WeaponFireRuntimeContext,
    ownerId: string,
    requests: WeaponFireRequest[],
    aimTarget: THREE.Vector3
) {
    if (requests.length === 0) return;

    context.camera.getWorldDirection(_cameraAimDir).normalize();
    const shots: FireShotPayload[] = [];
    let trauma = 0;

    for (const request of requests) {
        context.golem.getWeaponMuzzleOrigin(request.mountId, _muzzleOrigin);
        context.golem.triggerWeaponRecoil(request.mountId);
        context.mechCamera.onWeaponFire(request.mountId, request.cockpitRecoil, request.fireTrauma);
        trauma = Math.max(trauma, request.fireTrauma);
        _shotBaseDir.copy(aimTarget).sub(_muzzleOrigin);
        if (_shotBaseDir.lengthSq() <= 0.0001) {
            _shotBaseDir.copy(_cameraAimDir);
        } else {
            _shotBaseDir.normalize();
        }

        for (let index = 0; index < request.projectileCount; index++) {
            const dir = getSpreadDirection(_shotBaseDir, request.spread).clone();
            const shot: FireShotPayload = {
                weaponId: request.weaponId,
                mountId: request.mountId,
                profile: request.projectileProfile,
                ox: _muzzleOrigin.x,
                oy: _muzzleOrigin.y,
                oz: _muzzleOrigin.z,
                dx: dir.x,
                dy: dir.y,
                dz: dir.z,
                damage: request.damage,
                speed: request.projectileSpeed,
                range: request.effectiveRange
            };
            shots.push(shot);
            spawnShot(context.projectiles, shot, ownerId);
        }
    }

    context.playWeaponVolleyFx(shots);
    context.mechCamera.onFire(trauma);
    context.broadcastFire?.(ownerId, shots);
}

export function applyRemoteFire(
    context: RemoteFireRuntimeContext,
    ownerId: string,
    shots: FireShotPayload[]
) {
    for (const shot of shots) {
        spawnShot(context.projectiles, shot, ownerId);
    }

    const remotePlayer = context.remotePlayers.get(ownerId);
    if (remotePlayer) {
        for (const shot of shots) {
            remotePlayer.triggerWeaponRecoil(shot.mountId ?? remotePlayer.getMountIdForWeapon(shot.weaponId));
        }
    }

    context.playWeaponVolleyFx(shots);
}

export function updateProjectileCombat(context: ProjectileCollisionRuntimeContext) {
    context.projectiles.checkCollisions(
        context.bots,
        context.remotePlayers,
        context.localPlayer,
        context.localPlayerId,
        context.authorityMode,
        context.collisionMeshes,
        context.propManager,
        context.decals,
        context.getUnitTeam,
        context.isTargetAlive,
        context.onPlayerHit
    );
}
