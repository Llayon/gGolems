import type RAPIER from '@dimforge/rapier3d-compat';
import { GOLEM } from '../../utils/constants';
import { SIGNATURE_ABILITY_DEFINITIONS } from '../definitions';
import type { SignatureAbilityId } from '../types';
import type { MechSignatureState } from '../runtimeTypes';
import type { MechCamera } from '../../camera/MechCamera';
import type { ParticleManager } from '../../fx/ParticleManager';
import {
    activateSignatureRuntime,
    canActivateSignatureRuntime,
    deactivateSignatureRuntime,
    tickSignatureRuntime,
    triggerPostSlowdownRuntime
} from './MechSignatureRuntime';

export type SignatureControllerTarget = {
    isLocal: boolean;
    body: RAPIER.RigidBody;
    gameCamera?: MechCamera;
    torsoYaw: number;
    steam: number;
    isOverheated: boolean;
    signatureState: MechSignatureState;
    loadout: { signatureAbilityId?: SignatureAbilityId };
    tryAction: (cost: number) => boolean;
    triggerOverheat: (duration?: number) => void;
    spendSteam: (cost: number) => boolean;
};

export function getSignatureAbilityIdForTarget(
    target: SignatureControllerTarget
): SignatureAbilityId | null {
    return target.loadout.signatureAbilityId ?? null;
}

export function useSignatureForTarget(
    target: SignatureControllerTarget,
    particles?: ParticleManager
): boolean {
    const abilityId = getSignatureAbilityIdForTarget(target);
    if (!abilityId) return false;
    const definition = SIGNATURE_ABILITY_DEFINITIONS[abilityId];
    if (!definition) return false;
    if (!canActivateSignatureRuntime(target, definition)) return false;
    if (!target.tryAction(definition.steamCost)) return false;

    const result = activateSignatureRuntime(target, definition, abilityId);
    if (!result.success) return false;

    if (definition.blinkDistance > 0 && target.isLocal) {
        applySignatureBlinkForTarget(target, definition.blinkDistance);
    }
    if (definition.heatlockAfterActivation > 0) {
        target.triggerOverheat(definition.heatlockAfterActivation);
    }
    if (particles) {
        const pos = target.body.translation();
        for (let i = 0; i < 24; i++) {
            particles.emit(
                pos.x + (Math.random() - 0.5) * 3.5,
                pos.y + Math.random() * 3,
                pos.z + (Math.random() - 0.5) * 3.5
            );
        }
    }
    return true;
}

function applySignatureBlinkForTarget(
    target: SignatureControllerTarget,
    distance: number
) {
    const yaw = target.gameCamera?.aimYaw ?? target.torsoYaw;
    const dx = -Math.sin(yaw) * distance;
    const dz = -Math.cos(yaw) * distance;
    const pos = target.body.translation();
    target.body.setTranslation(
        { x: pos.x + dx, y: pos.y, z: pos.z + dz },
        true
    );
}

export function cancelSignatureOnMoveForTarget(
    target: SignatureControllerTarget
): boolean {
    const abilityId = target.signatureState.abilityId;
    if (!abilityId || !target.signatureState.isActive) return false;
    const definition = SIGNATURE_ABILITY_DEFINITIONS[abilityId];
    if (!definition || definition.activation !== 'toggle') return false;
    deactivateSignatureRuntime(target);
    if (definition.overheatOnCancel) {
        target.triggerOverheat(GOLEM.overheatDuration);
    }
    if (definition.postSlowdownDuration > 0) {
        triggerPostSlowdownRuntime(target, definition.postSlowdownDuration);
    }
    return true;
}

export function tickSignatureForTarget(target: SignatureControllerTarget, dt: number) {
    const wasActive = target.signatureState.isActive;
    const abilityId = target.signatureState.abilityId;
    tickSignatureRuntime(target, dt);
    if (wasActive && !target.signatureState.isActive && abilityId) {
        const definition = SIGNATURE_ABILITY_DEFINITIONS[abilityId];
        if (definition && definition.postSlowdownDuration > 0) {
            triggerPostSlowdownRuntime(target, definition.postSlowdownDuration);
        }
    }
}

export function getEffectiveMoveSpeedMultiplierForTarget(
    target: SignatureControllerTarget
): number {
    const sig = target.signatureState;
    let multiplier = 1;
    if (sig.isActive && sig.abilityId) {
        const def = SIGNATURE_ABILITY_DEFINITIONS[sig.abilityId];
        if (def) multiplier *= def.moveSpeedMultiplier;
    }
    if (sig.postSlowdownTimer > 0 && sig.abilityId) {
        const def = SIGNATURE_ABILITY_DEFINITIONS[sig.abilityId];
        if (def) multiplier *= def.postSlowdownMultiplier;
    }
    return multiplier;
}

export function getEffectiveDamageMultiplierForTarget(
    target: Pick<SignatureControllerTarget, 'signatureState'>
): number {
    const sig = target.signatureState;
    if (!sig.isActive || !sig.abilityId) return 1;
    const def = SIGNATURE_ABILITY_DEFINITIONS[sig.abilityId];
    return def ? def.damageMultiplier : 1;
}

export function getEffectiveIncomingDamageMultiplierForTarget(
    target: Pick<SignatureControllerTarget, 'signatureState'>
): number {
    const sig = target.signatureState;
    if (!sig.isActive || !sig.abilityId) return 1;
    const def = SIGNATURE_ABILITY_DEFINITIONS[sig.abilityId];
    return def ? def.incomingDamageMultiplier : 1;
}