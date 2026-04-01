import type {
    WeaponMountId,
    WeaponMountRuntime
} from '../combat/weaponTypes';
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
