import * as THREE from 'three';
import type { WeaponFireRequest, ProjectileProfileId, WeaponId, WeaponMountId } from '../../combat/weaponTypes';
import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { ParticleManager } from '../../fx/ParticleManager';
import type { AudioManager } from '../AudioManager';
import type { MechCamera } from '../../camera/MechCamera';
import type { ProjectileManager } from '../../combat/ProjectileManager';
import type { DecalManager } from '../../fx/DecalManager';
import type { PropManager } from '../../world/PropManager';
import type { GameMode, TeamId, TeamScoreState } from '../../gameplay/types';

const _impactListener = new THREE.Vector3();
const _impactPos = new THREE.Vector3();
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

export type WeaponVolleyFxContext = {
    particles: ParticleManager;
    sounds: AudioManager;
};

export type ProjectileImpactFxContext = {
    particles: ParticleManager;
    sounds: AudioManager;
    mechCamera: MechCamera;
    projectiles: ProjectileManager;
    listenerPosition: { x: number; y: number; z: number };
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

export type PlayerHitRuntimeContext = {
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    localPlayer: GolemController;
    mechCamera: MechCamera;
    gameMode: GameMode;
    teamScores: TeamScoreState;
    localPlayerId: string;
    getUnitTeam: (id: string) => TeamId | null;
    queueLocalRespawn: () => void;
    queueRemoteRespawn: (id: string) => void;
    scheduleRespawnWave: (team: TeamId) => void;
    confirmHitForOwner: (ownerId: string, targetHp: number, targetMaxHp: number) => void;
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

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function awardTeamScore(teamScores: TeamScoreState, team: TeamId) {
    teamScores[team] = Math.min(teamScores.scoreToWin, teamScores[team] + 1);
    if (teamScores[team] >= teamScores.scoreToWin) {
        teamScores.winner = team;
    }
}

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

export function playWeaponVolleyFx(context: WeaponVolleyFxContext, shots: FireShotPayload[]) {
    const played = new Set<ProjectileProfileId>();
    for (const shot of shots) {
        if (played.has(shot.profile)) continue;
        played.add(shot.profile);

        if (shot.profile === 'steam_slug') {
            context.particles.emitBurst(shot.ox, shot.oy, shot.oz, 12, 0.8, 1.8, 0.28);
            context.sounds.playWeaponFire(shot.profile, 1.1);
        } else if (shot.profile === 'arc_pulse') {
            context.particles.emitBurst(shot.ox, shot.oy, shot.oz, 8, 0.45, 1.2, 0.18);
            context.sounds.playWeaponFire(shot.profile, 0.9);
        } else {
            context.particles.emitBurst(shot.ox, shot.oy, shot.oz, 6, 0.32, 0.9, 0.16);
            context.sounds.playWeaponFire(shot.profile, 0.8);
        }
    }
}

export function playProjectileImpactFx(context: ProjectileImpactFxContext) {
    _impactListener.set(
        context.listenerPosition.x,
        context.listenerPosition.y,
        context.listenerPosition.z
    );

    for (const event of context.projectiles.consumeImpactEvents()) {
        _impactPos.set(event.x, event.y, event.z);
        const proximity = clamp(1 - _impactPos.distanceTo(_impactListener) / 34, 0, 1);

        if (event.profile === 'steam_slug') {
            context.particles.emitBurst(event.x, event.y, event.z, event.kind === 'world' ? 18 : 24, 1.2, 2.3, 0.55);
        } else if (event.profile === 'arc_pulse') {
            context.particles.emitBurst(event.x, event.y, event.z, event.kind === 'world' ? 12 : 16, 0.85, 1.7, 0.4);
        } else {
            context.particles.emitBurst(event.x, event.y, event.z, event.kind === 'world' ? 8 : 12, 0.55, 1.2, 0.3);
        }

        if (proximity > 0.05) {
            context.sounds.playWeaponImpact(event.profile, 0.75 + proximity * 0.45);
            if (event.kind !== 'world') {
                context.mechCamera.addTrauma(proximity * 0.08);
            }
        }
    }
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

export function handlePlayerHit(
    context: PlayerHitRuntimeContext,
    ownerId: string,
    targetId: string,
    damage: number,
    section: GolemSection | '__bot__'
) {
    const ownerTeam = context.getUnitTeam(ownerId);
    if (targetId.startsWith('bot-')) {
        const bot = context.bots.get(targetId);
        if (!bot) return;
        const remainingHp = bot.takeDamage(damage);
        if (remainingHp <= 0) {
            context.scheduleRespawnWave(bot.team);
            if (context.gameMode === 'tdm' && ownerTeam && ownerTeam !== bot.team) {
                awardTeamScore(context.teamScores, ownerTeam);
            }
        }
        context.confirmHitForOwner(ownerId, remainingHp, bot.maxHp);
        return;
    }

    const hitSection = section === '__bot__' ? 'centerTorso' : section;

    if (targetId === context.localPlayerId) {
        const result = context.localPlayer.applySectionDamage(hitSection, damage);
        context.mechCamera.onHit(damage);
        if (result.lethal) {
            context.queueLocalRespawn();
            if (context.gameMode === 'tdm' && ownerTeam && ownerTeam !== 'blue') {
                awardTeamScore(context.teamScores, ownerTeam);
            }
        }
        context.confirmHitForOwner(ownerId, result.totalHp, context.localPlayer.maxHp);
        return;
    }

    const player = context.remotePlayers.get(targetId);
    if (!player) return;
    const result = player.applySectionDamage(hitSection, damage);
    if (result.lethal) {
        context.queueRemoteRespawn(targetId);
        if (context.gameMode === 'tdm' && ownerTeam && ownerTeam !== 'blue') {
            awardTeamScore(context.teamScores, ownerTeam);
        }
    }
    context.confirmHitForOwner(ownerId, result.totalHp, player.maxHp);
}

export function updateProjectileCombat(
    context: ProjectileCollisionRuntimeContext,
    impactFxContext: ProjectileImpactFxContext
) {
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

    playProjectileImpactFx(impactFxContext);
}
