import type { TranslationKey } from '../i18n';
import type { GolemSection } from '../mechs/sections';

export type WeaponId = 'rune_bolt' | 'arc_emitter' | 'steam_cannon';
export type WeaponMountId = 'rightArmMount' | 'leftArmMount' | 'torsoMount';
export type WeaponGroupId = 1 | 2 | 3;
export type ProjectileProfileId = 'bolt' | 'arc_pulse' | 'steam_slug';
export type WeaponSlotClass = 'arm' | 'torso';
export type WeaponSection = Extract<GolemSection, 'leftArm' | 'rightArm' | 'leftTorso' | 'rightTorso' | 'centerTorso'>;
export type WeaponState = 'ready' | 'recycle' | 'offline' | 'heat';

export type CockpitRecoilProfile = {
    cameraKickBack: number;
    cameraPitchKick: number;
    cameraYawKick: number;
    frameKick: number;
    recoveryTime: number;
    pulseCount: number;
    pulseInterval: number;
    fovKick: number;
};

export type WeaponDefinition = {
    id: WeaponId;
    nameKey: TranslationKey;
    shortKey: TranslationKey;
    allowedSlotClasses: WeaponSlotClass[];
    damage: number;
    cooldown: number;
    heatCost: number;
    projectileSpeed: number;
    spread: number;
    effectiveRange: number;
    projectileProfile: ProjectileProfileId;
    projectileCount: number;
    fireTrauma: number;
    cockpitRecoil: CockpitRecoilProfile;
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
    cockpitRecoil: CockpitRecoilProfile;
    muzzleOffset: { x: number; y: number; z: number };
};
