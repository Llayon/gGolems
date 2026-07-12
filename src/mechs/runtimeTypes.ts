import type {
    WeaponMountId,
    WeaponMountRuntime
} from '../combat/weaponTypes';
import type { SignatureAbilityId } from './types';
import type { GolemSectionState } from './sections';

export type MechHeatState = {
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
};

export type MechDamageState = {
    sections: GolemSectionState;
    maxSections: GolemSectionState;
    hp: number;
    maxHp: number;
};

export type MechWeaponState = {
    weaponMountOrder: WeaponMountId[];
    weaponMounts: Record<WeaponMountId, WeaponMountRuntime>;
};

export type MechSignatureState = {
    abilityId: SignatureAbilityId | null;
    cooldownRemaining: number;
    activeTimer: number;
    isActive: boolean;
    heatlockTimer: number;
    postSlowdownTimer: number;
};

export function createInitialMechSignatureState(): MechSignatureState {
    return {
        abilityId: null,
        cooldownRemaining: 0,
        activeTimer: 0,
        isActive: false,
        heatlockTimer: 0,
        postSlowdownTimer: 0
    };
}
