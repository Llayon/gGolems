import type {
    ProjectileProfileDefinition,
    ProjectileProfileId,
    WeaponDefinition,
    WeaponGroupId,
    WeaponId,
    WeaponSlotClass
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
    },
    pellet: {
        id: 'pellet',
        radius: 0.14,
        color: 0xffc06a,
        emissive: 0xff8a3d,
        emissiveIntensity: 2.0
    },
    rocket: {
        id: 'rocket',
        radius: 0.28,
        color: 0xff6a3d,
        emissive: 0xff5a1c,
        emissiveIntensity: 2.4
    }
};

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
    rune_bolt: {
        id: 'rune_bolt',
        nameKey: 'weapon.runeBolt',
        shortKey: 'weapon.short.runeBolt',
        role: 'precision',
        allowedSlotClasses: ['arm'],
        damage: 15,
        cooldown: 0.52,
        heatCost: 9,
        projectileSpeed: 84,
        spread: 0.0035,
        effectiveRange: 92,
        falloffStart: 62,
        minDamageScale: 0.8,
        projectileProfile: 'bolt',
        projectileCount: 1,
        fireTrauma: 0.18,
        cockpitRecoil: {
            cameraKickBack: 0.52,
            cameraPitchKick: 0.3,
            cameraYawKick: 0.15,
            frameKick: 0.52,
            recoveryTime: 0.2,
            pulseCount: 1,
            pulseInterval: 0,
            fovKick: 0.34
        },
        muzzleOffset: { x: 0, y: -1.18, z: -1.28 }
    },
    arc_emitter: {
        id: 'arc_emitter',
        nameKey: 'weapon.arcEmitter',
        shortKey: 'weapon.short.arcEmitter',
        role: 'pressure',
        allowedSlotClasses: ['arm'],
        damage: 8,
        cooldown: 0.74,
        heatCost: 15,
        projectileSpeed: 62,
        spread: 0.016,
        effectiveRange: 58,
        falloffStart: 34,
        minDamageScale: 0.62,
        projectileProfile: 'arc_pulse',
        projectileCount: 3,
        fireTrauma: 0.24,
        cockpitRecoil: {
            cameraKickBack: 0.34,
            cameraPitchKick: 0.2,
            cameraYawKick: 0.12,
            frameKick: 0.32,
            recoveryTime: 0.16,
            pulseCount: 3,
            pulseInterval: 0.05,
            fovKick: 0.24
        },
        muzzleOffset: { x: 0, y: -1.15, z: -1.2 }
    },
steam_cannon: {
        id: 'steam_cannon',
        nameKey: 'weapon.steamCannon',
        shortKey: 'weapon.short.steamCannon',
        role: 'breach',
        allowedSlotClasses: ['torso'],
        damage: 42,
        cooldown: 1.48,
        heatCost: 24,
        projectileSpeed: 38,
        spread: 0.024,
        effectiveRange: 38,
        falloffStart: 18,
        minDamageScale: 0.42,
        projectileProfile: 'steam_slug',
        projectileCount: 1,
        fireTrauma: 0.42,
        cockpitRecoil: {
            cameraKickBack: 1.35,
            cameraPitchKick: 0.78,
            cameraYawKick: 0.24,
            frameKick: 1.15,
            recoveryTime: 0.32,
            pulseCount: 1,
            pulseInterval: 0,
            fovKick: 0.85
        },
        muzzleOffset: { x: 0, y: -0.38, z: -1.55 }
    },
    scatterslug: {
        id: 'scatterslug',
        nameKey: 'weapon.scatterslug',
        shortKey: 'weapon.short.scatterslug',
        role: 'pressure',
        allowedSlotClasses: ['arm'],
        damage: 6,
        cooldown: 0.85,
        heatCost: 12,
        projectileSpeed: 46,
        spread: 0.075,
        effectiveRange: 22,
        falloffStart: 8,
        minDamageScale: 0.4,
        projectileProfile: 'pellet',
        projectileCount: 7,
        fireTrauma: 0.32,
        cockpitRecoil: {
            cameraKickBack: 0.75,
            cameraPitchKick: 0.4,
            cameraYawKick: 0.18,
            frameKick: 0.62,
            recoveryTime: 0.18,
            pulseCount: 1,
            pulseInterval: 0,
            fovKick: 0.42
        },
        muzzleOffset: { x: 0, y: -1.18, z: -1.22 }
    },
    rocket_pod: {
        id: 'rocket_pod',
        nameKey: 'weapon.rocketPod',
        shortKey: 'weapon.short.rocketPod',
        role: 'breach',
        allowedSlotClasses: ['torso'],
        damage: 28,
        cooldown: 2.1,
        heatCost: 32,
        projectileSpeed: 32,
        spread: 0.012,
        effectiveRange: 70,
        falloffStart: 30,
        minDamageScale: 0.55,
        projectileProfile: 'rocket',
        projectileCount: 1,
        fireTrauma: 0.55,
        cockpitRecoil: {
            cameraKickBack: 1.5,
            cameraPitchKick: 0.85,
            cameraYawKick: 0.26,
            frameKick: 1.25,
            recoveryTime: 0.36,
            pulseCount: 1,
            pulseInterval: 0,
            fovKick: 0.95
        },
        muzzleOffset: { x: 0, y: -0.4, z: -1.6 },
        splashRadius: 6,
        splashFalloff: 0.4
    }
};

export const WEAPON_GROUP_ORDER: WeaponGroupId[] = [1, 2, 3];

export function getWeaponDefinition(id: WeaponId) {
    return WEAPON_DEFINITIONS[id];
}

export function computeWeaponDamageAtDistance(
    weaponId: WeaponId,
    baseDamage: number,
    distance: number
) {
    const definition = getWeaponDefinition(weaponId);
    if (distance <= definition.falloffStart) {
        return Math.max(1, Math.round(baseDamage));
    }

    const falloffSpan = Math.max(0.001, definition.effectiveRange - definition.falloffStart);
    const t = clamp01((distance - definition.falloffStart) / falloffSpan);
    const scale = 1 - t * (1 - definition.minDamageScale);
    return Math.max(1, Math.round(baseDamage * scale));
}

export function isWeaponCompatibleWithSlot(weaponId: WeaponId, slotClass: WeaponSlotClass) {
    return getWeaponDefinition(weaponId).allowedSlotClasses.includes(slotClass);
}
