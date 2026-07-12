import type { SignatureAbilityDefinition } from '../types';
import type { MechSignatureState } from '../runtimeTypes';

export type SignatureActivationResult = {
    nextState: MechSignatureState;
    success: boolean;
};

export function getSignatureDefinition(
    defs: Record<string, SignatureAbilityDefinition>,
    abilityId: string
): SignatureAbilityDefinition | null {
    return defs[abilityId] ?? null;
}

export function canActivateSignature(
    state: MechSignatureState,
    definition: SignatureAbilityDefinition
): boolean {
    if (state.isActive) return false;
    if (state.heatlockTimer > 0) return false;
    if (state.cooldownRemaining > 0) return false;
    if (state.postSlowdownTimer > 0 && definition.activation === 'toggle') return false;
    return true;
}

export function applySignatureActivation(
    state: MechSignatureState,
    definition: SignatureAbilityDefinition,
    abilityId: string
): SignatureActivationResult {
    if (!canActivateSignature(state, definition)) {
        return { nextState: state, success: false };
    }

    const nextState: MechSignatureState = {
        ...state,
        abilityId: abilityId as MechSignatureState['abilityId'],
        isActive: definition.activation === 'burst' || definition.activation === 'toggle',
        activeTimer: definition.duration,
        heatlockTimer: definition.heatlockAfterActivation,
        cooldownRemaining: definition.cooldown
    };

    return { nextState, success: true };
}

export function deactivateSignature(state: MechSignatureState): MechSignatureState {
    if (!state.isActive) return state;
    return {
        ...state,
        isActive: false,
        activeTimer: 0,
        abilityId: null
    };
}

export function tickSignatureState(
    state: MechSignatureState,
    dt: number
): MechSignatureState {
    let nextCooldown = Math.max(0, state.cooldownRemaining - dt);
    let nextHeatlock = Math.max(0, state.heatlockTimer - dt);
    let nextPostSlowdown = Math.max(0, state.postSlowdownTimer - dt);
    let nextActiveTimer = Math.max(0, state.activeTimer - dt);
    let isActive = state.isActive;
    let abilityId = state.abilityId;

    if (isActive && nextActiveTimer <= 0) {
        isActive = false;
        nextActiveTimer = 0;
        abilityId = null;
    }

    return {
        abilityId,
        cooldownRemaining: nextCooldown,
        activeTimer: nextActiveTimer,
        isActive,
        heatlockTimer: nextHeatlock,
        postSlowdownTimer: nextPostSlowdown
    };
}

export function triggerPostSlowdown(
    state: MechSignatureState,
    duration: number
): MechSignatureState {
    if (duration <= 0) return state;
    return {
        ...state,
        postSlowdownTimer: duration
    };
}