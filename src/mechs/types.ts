import type {
    WeaponGroupId,
    WeaponId,
    WeaponMountId,
    WeaponSection,
    WeaponSlotClass
} from '../combat/weaponTypes';
import type { GolemSectionState } from './sections';

export type WeightClass = 'light' | 'medium' | 'heavy';
export type FrameFamilyId = 'duelist' | 'ranger' | 'bulwark';
export type ChassisId = 'kwii_strider' | 'courier_scout' | 'bastion_siege';
export type LoadoutId = 'kwii_standard' | 'courier_raider' | 'bastion_breacher';
export type SignatureAbilityId = 'pressure_surge' | 'vector_feint' | 'anchor_mode';
export type AssetId = 'kwii' | 'marceline' | 'prototype';

export type ResourceBudget = {
    offense: number;
    mobility: number;
    durability: number;
    heat: number;
};

export type FrameFamilyDefinition = {
    id: FrameFamilyId;
    name: string;
    role: string;
    description: string;
};

export type SignatureAbilityDefinition = {
    id: SignatureAbilityId;
    name: string;
    description: string;
};

export type MountSlotDefinition = {
    mountId: WeaponMountId;
    slotClass: WeaponSlotClass;
    section: WeaponSection;
    group: WeaponGroupId;
    label: string;
};

export type ChassisDefinition = {
    id: ChassisId;
    familyId: FrameFamilyId;
    assetId: AssetId;
    defaultLoadoutId: LoadoutId;
    name: string;
    description: string;
    weightClass: WeightClass;
    mass: number;
    maxSteam: number;
    topSpeed: number;
    dashSpeed: number;
    sectionMax: GolemSectionState;
    mountLayout: MountSlotDefinition[];
    signatureAbilityIds: SignatureAbilityId[];
    budgets: ResourceBudget;
};

export type LoadoutMountDefinition = {
    mountId: WeaponMountId;
    weaponId: WeaponId;
};

export type LoadoutDefinition = {
    id: LoadoutId;
    chassisId: ChassisId;
    name: string;
    description: string;
    assignments: LoadoutMountDefinition[];
    signatureAbilityId?: SignatureAbilityId;
};
