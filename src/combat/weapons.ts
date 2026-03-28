import type {
    ProjectileProfileDefinition,
    ProjectileProfileId,
    WeaponDefinition,
    WeaponGroupId,
    WeaponId,
    WeaponMountId
} from './weaponTypes';

export const PROJECTILE_PROFILES: Record<ProjectileProfileId, ProjectileProfileDefinition> = {
    bolt: {
        id: 'bolt',
        radius: 0.2,
        color: 0x46d4ff,
        emissive: 0x46d4ff,
        emissiveIntensity: 2.2
    },
    arc_pulse: {
        id: 'arc_pulse',
        radius: 0.16,
        color: 0x8bf7ff,
        emissive: 0x8bf7ff,
        emissiveIntensity: 2.8
    },
    steam_slug: {
        id: 'steam_slug',
        radius: 0.32,
        color: 0xffb56b,
        emissive: 0xff8a4d,
        emissiveIntensity: 1.7
    }
};

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
    rune_bolt: {
        id: 'rune_bolt',
        nameKey: 'weapon.runeBolt',
        shortKey: 'weapon.short.runeBolt',
        mountId: 'rightArmMount',
        section: 'rightArm',
        group: 1,
        damage: 16,
        cooldown: 0.45,
        heatCost: 8,
        projectileSpeed: 78,
        spread: 0.004,
        effectiveRange: 85,
        projectileProfile: 'bolt',
        projectileCount: 1,
        fireTrauma: 0.18,
        muzzleOffset: { x: 0, y: -1.18, z: -1.28 }
    },
    arc_emitter: {
        id: 'arc_emitter',
        nameKey: 'weapon.arcEmitter',
        shortKey: 'weapon.short.arcEmitter',
        mountId: 'leftArmMount',
        section: 'leftArm',
        group: 2,
        damage: 7,
        cooldown: 0.8,
        heatCost: 14,
        projectileSpeed: 65,
        spread: 0.012,
        effectiveRange: 65,
        projectileProfile: 'arc_pulse',
        projectileCount: 3,
        fireTrauma: 0.24,
        muzzleOffset: { x: 0, y: -1.15, z: -1.2 }
    },
    steam_cannon: {
        id: 'steam_cannon',
        nameKey: 'weapon.steamCannon',
        shortKey: 'weapon.short.steamCannon',
        mountId: 'torsoMount',
        section: 'rightTorso',
        group: 3,
        damage: 34,
        cooldown: 1.35,
        heatCost: 22,
        projectileSpeed: 42,
        spread: 0.03,
        effectiveRange: 35,
        projectileProfile: 'steam_slug',
        projectileCount: 1,
        fireTrauma: 0.42,
        muzzleOffset: { x: 0, y: -0.38, z: -1.55 }
    }
};

export const WEAPON_GROUP_ORDER: WeaponGroupId[] = [1, 2, 3];
export const WEAPON_MOUNT_ORDER: WeaponMountId[] = ['rightArmMount', 'leftArmMount', 'torsoMount'];

export function getWeaponDefinition(id: WeaponId) {
    return WEAPON_DEFINITIONS[id];
}

export function getDefaultMountWeaponId(mountId: WeaponMountId): WeaponId {
    switch (mountId) {
        case 'rightArmMount':
            return 'rune_bolt';
        case 'leftArmMount':
            return 'arc_emitter';
        case 'torsoMount':
        default:
            return 'steam_cannon';
    }
}
