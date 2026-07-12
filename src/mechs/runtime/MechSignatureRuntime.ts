import type { SignatureAbilityDefinition } from '../types';
import type { MechSignatureState } from '../runtimeTypes';
import {
    applySignatureActivation,
    canActivateSignature,
    deactivateSignature,
    tickSignatureState,
    triggerPostSlowdown,
    type SignatureActivationResult
} from '../rules/signatureRules';

export type MechSignatureTarget = {
    signatureState: MechSignatureState;
};

export type MechSignatureSnapshotTarget = MechSignatureTarget & {
    abilityId: MechSignatureState['abilityId'];
};

export function readMechSignatureState(target: MechSignatureTarget): MechSignatureState {
    return { ...target.signatureState };
}

export function writeMechSignatureState(target: MechSignatureTarget, next: MechSignatureState) {
    target.signatureState.abilityId = next.abilityId;
    target.signatureState.cooldownRemaining = next.cooldownRemaining;
    target.signatureState.activeTimer = next.activeTimer;
    target.signatureState.isActive = next.isActive;
    target.signatureState.heatlockTimer = next.heatlockTimer;
    target.signatureState.postSlowdownTimer = next.postSlowdownTimer;
}

export function canActivateSignatureRuntime(
    target: MechSignatureTarget,
    definition: SignatureAbilityDefinition
): boolean {
    return canActivateSignature(readMechSignatureState(target), definition);
}

export function activateSignatureRuntime(
    target: MechSignatureTarget,
    definition: SignatureAbilityDefinition,
    abilityId: string
): SignatureActivationResult {
    const result = applySignatureActivation(
        readMechSignatureState(target),
        definition,
        abilityId
    );
    writeMechSignatureState(target, result.nextState);
    return result;
}

export function deactivateSignatureRuntime(target: MechSignatureTarget) {
    writeMechSignatureState(target, deactivateSignature(readMechSignatureState(target)));
}

export function tickSignatureRuntime(target: MechSignatureTarget, dt: number) {
    const next = tickSignatureState(readMechSignatureState(target), dt);
    writeMechSignatureState(target, next);
}

export function triggerPostSlowdownRuntime(target: MechSignatureTarget, duration: number) {
    writeMechSignatureState(
        target,
        triggerPostSlowdown(readMechSignatureState(target), duration)
    );
}

export function buildMechSignatureSnapshot(target: MechSignatureSnapshotTarget): MechSignatureState {
    return readMechSignatureState(target);
}