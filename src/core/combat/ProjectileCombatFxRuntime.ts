import * as THREE from 'three';
import type { ProjectileProfileId } from '../../combat/weaponTypes';
import type { ProjectileManager } from '../../combat/ProjectileManager';
import type { MechCamera } from '../../camera/MechCamera';
import type { ParticleManager } from '../../fx/ParticleManager';
import type { AudioManager } from '../AudioManager';
import type { FireShotPayload } from './ProjectileCombatRuntime';

const _impactListener = new THREE.Vector3();
const _impactPos = new THREE.Vector3();

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

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
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
