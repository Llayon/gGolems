import * as THREE from 'three';
import type { MechCamera } from '../../camera/MechCamera';
import type { DebrisManager } from '../../fx/DebrisManager';
import type { DecalManager } from '../../fx/DecalManager';
import type { ParticleManager } from '../../fx/ParticleManager';
import type { AudioManager } from '../AudioManager';
import type { PropManager } from '../../world/PropManager';

const _listenerPos = new THREE.Vector3();
const _propFxPos = new THREE.Vector3();

export type WorldPropFxRuntimeContext = {
    propManager: PropManager;
    particles: ParticleManager;
    debris: DebrisManager;
    decals: DecalManager;
    sounds: AudioManager;
    mechCamera: MechCamera;
    listenerPosition: { x: number; y: number; z: number };
};

export function playWorldPropFx(context: WorldPropFxRuntimeContext) {
    _listenerPos.set(
        context.listenerPosition.x,
        context.listenerPosition.y,
        context.listenerPosition.z
    );

    for (const event of context.propManager.consumeFxEvents()) {
        _propFxPos.set(event.x, event.y, event.z);
        const distance = _propFxPos.distanceTo(_listenerPos);
        const proximity = THREE.MathUtils.clamp(1 - distance / 28, 0, 1);

        if (event.kind === 'tree_fall') {
            context.particles.emitBurst(event.x, event.y, event.z, 14, 1.8, 2.8, 1.15);
            context.debris.emitBurst(event.x, event.y, event.z, 'tree', event.intensity);
            context.decals.addRuinMark(_propFxPos, 2.8, 22);
            context.sounds.playStructureHit(0.7 * event.intensity);
        } else if (event.kind === 'house_damage') {
            context.particles.emitBurst(event.x, event.y, event.z, 20, 2.8, 3.1, 1.2);
            context.debris.emitBurst(event.x, event.y, event.z, 'houseDamage', event.intensity);
            context.decals.addRuinMark(_propFxPos, 3.6, 28);
            context.sounds.playStructureHit(1.0 * event.intensity);
        } else {
            context.particles.emitBurst(event.x, event.y, event.z, 34, 4.2, 4.2, 1.5);
            context.debris.emitBurst(event.x, event.y, event.z, 'houseCollapse', event.intensity);
            context.decals.addRuinMark(_propFxPos, 5.4, 34);
            context.sounds.playCollapse(1.0 * event.intensity);
        }

        if (proximity > 0) {
            context.mechCamera.addTrauma(proximity * 0.28 * event.intensity);
        }
    }
}
