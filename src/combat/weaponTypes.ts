import type { TranslationKey } from '../i18n';

export type WeaponId = 'rune_bolt' | 'arc_emitter' | 'steam_cannon';
export type WeaponMountId = 'rightArmMount' | 'leftArmMount' | 'torsoMount';
export type WeaponGroupId = 1 | 2 | 3;
export type ProjectileProfileId = 'bolt' | 'arc_pulse' | 'steam_slug';
export type WeaponSection = 'leftArm' | 'rightArm' | 'leftTorso' | 'rightTorso' | 'centerTorso';
export type WeaponState = 'ready' | 'recycle' | 'offline' | 'heat';

export type WeaponDefinition = {
    id: WeaponId;
    nameKey: TranslationKey;
    shortKey: TranslationKey;
    mountId: WeaponMountId;
    section: WeaponSection;
    group: WeaponGroupId;
    damage: number;
    cooldown: number;
    heatCost: number;
    projectileSpeed: number;
    spread: number;
    effectiveRange: number;
    projectileProfile: ProjectileProfileId;
    projectileCount: number;
    fireTrauma: number;
    muzzleOffset: { x: number; y: number; z: number };
};

export type ProjectileProfileDefinition = {
    id: ProjectileProfileId;
    radius: number;
    color: number;
    emissive: number;
    emissiveIntensity: number;
};

export type WeaponMountRuntime = {
    mountId: WeaponMountId;
    weaponId: WeaponId;
    group: WeaponGroupId;
    section: WeaponSection;
    cooldownRemaining: number;
    enabled: boolean;
};

export type WeaponStatusView = {
    mountId: WeaponMountId;
    weaponId: WeaponId;
    group: WeaponGroupId;
    section: WeaponSection;
    nameKey: TranslationKey;
    shortKey: TranslationKey;
    state: WeaponState;
    cooldownRemaining: number;
    heatCost: number;
};

export type WeaponFireRequest = {
    mountId: WeaponMountId;
    weaponId: WeaponId;
    group: WeaponGroupId;
    section: WeaponSection;
    nameKey: TranslationKey;
    shortKey: TranslationKey;
    damage: number;
    heatCost: number;
    spread: number;
    projectileSpeed: number;
    effectiveRange: number;
    projectileProfile: ProjectileProfileId;
    projectileCount: number;
    fireTrauma: number;
    muzzleOffset: { x: number; y: number; z: number };
};
