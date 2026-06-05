import * as THREE from 'three';
import type { GolemController } from '../entities/GolemController';
import type { InputManager } from './InputManager';
import type { MechCamera } from '../camera/MechCamera';
import type { ParticleManager } from '../fx/ParticleManager';
import type { WeaponFireRuntimeContext } from './combat/ProjectileCombatRuntime';
import { fireWeaponRequests as fireWeaponRequestsRuntime } from './combat/ProjectileCombatRuntime';

const _aimPoint = new THREE.Vector3();

export type InputActionsContext = {
    golem: GolemController;
    input: InputManager;
    mechCamera: MechCamera;
    particles: ParticleManager;
    canControlLocal: boolean;
    getLocalUnitId: () => string;
    getAimTargetPoint: (out: THREE.Vector3) => void;
    weaponFireContext: WeaponFireRuntimeContext;
};

export function handleInputActions(ctx: InputActionsContext) {
    if (!ctx.canControlLocal) return;

    const localOwnerId = ctx.getLocalUnitId();
    ctx.getAimTargetPoint(_aimPoint);

    if (ctx.input.consumeFireGroup(1)) {
        fireWeaponRequestsRuntime(ctx.weaponFireContext, localOwnerId, ctx.golem.tryFireGroup(1), _aimPoint);
    }
    if (ctx.input.consumeFireGroup(2)) {
        fireWeaponRequestsRuntime(ctx.weaponFireContext, localOwnerId, ctx.golem.tryFireGroup(2), _aimPoint);
    }
    if (ctx.input.consumeKey('KeyQ') || ctx.input.consumeFireGroup(3)) {
        fireWeaponRequestsRuntime(ctx.weaponFireContext, localOwnerId, ctx.golem.tryFireGroup(3), _aimPoint);
    }
    if (ctx.input.consumeKey('KeyE') || ctx.input.consumeVirtualAction('alphaStrike')) {
        fireWeaponRequestsRuntime(ctx.weaponFireContext, localOwnerId, ctx.golem.tryFireAlpha(), _aimPoint);
    }
    if (ctx.input.consumeKey('ShiftLeft') || ctx.input.consumeVirtualAction('dash')) {
        if (ctx.golem.tryAction(30)) {
            ctx.golem.dash();
            ctx.mechCamera.onDash();
        }
    }
    if (ctx.input.consumeKey('Space') || ctx.input.consumeVirtualAction('vent')) {
        if (ctx.golem.tryAction(0)) {
            ctx.golem.vent(ctx.particles);
            ctx.mechCamera.addTrauma(0.5);
        }
    }
}
