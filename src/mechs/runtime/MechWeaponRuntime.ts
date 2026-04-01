import { getWeaponDefinition } from '../../combat/weapons';
import type {
    WeaponFireRequest,
    WeaponMountId,
    WeaponMountRuntime
} from '../../combat/weaponTypes';
import type { ChassisDefinition, LoadoutDefinition } from '../types';

export type WeaponRecoilState = Record<WeaponMountId, number>;

export function createWeaponRecoilState(): WeaponRecoilState {
    return {
        rightArmMount: 0,
        leftArmMount: 0,
        torsoMount: 0
    };
}

export function createWeaponMountRuntimeState(
    chassis: ChassisDefinition,
    loadout: LoadoutDefinition
): {
    mountOrder: WeaponMountId[];
    mounts: Record<WeaponMountId, WeaponMountRuntime>;
} {
    const mountOrder = chassis.mountLayout.map((slot) => slot.mountId);
    const mounts = {} as Record<WeaponMountId, WeaponMountRuntime>;

    for (const slot of chassis.mountLayout) {
        const assignment = loadout.assignments.find((item) => item.mountId === slot.mountId);
        if (!assignment) {
            throw new Error(`Missing loadout assignment for mount "${slot.mountId}".`);
        }

        mounts[slot.mountId] = {
            mountId: slot.mountId,
            weaponId: assignment.weaponId,
            group: slot.group,
            section: slot.section,
            cooldownRemaining: 0,
            enabled: true
        };
    }

    return {
        mountOrder,
        mounts
    };
}

export function tickWeaponRecoilState(
    recoilState: WeaponRecoilState,
    mountOrder: WeaponMountId[],
    dt: number,
    decayRate = 8.5
) {
    for (const mountId of mountOrder) {
        recoilState[mountId] = Math.max(0, recoilState[mountId] - dt * decayRate);
    }
}

export function resetWeaponRuntimeState(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    recoilState: WeaponRecoilState,
    mountOrder: WeaponMountId[]
) {
    for (const mountId of mountOrder) {
        mounts[mountId].cooldownRemaining = 0;
        recoilState[mountId] = 0;
    }
}

export function buildWeaponFireRequest(mount: WeaponMountRuntime): WeaponFireRequest {
    const definition = getWeaponDefinition(mount.weaponId);
    return {
        mountId: mount.mountId,
        weaponId: mount.weaponId,
        group: mount.group,
        section: mount.section,
        nameKey: definition.nameKey,
        shortKey: definition.shortKey,
        damage: definition.damage,
        heatCost: definition.heatCost,
        spread: definition.spread,
        projectileSpeed: definition.projectileSpeed,
        effectiveRange: definition.effectiveRange,
        projectileProfile: definition.projectileProfile,
        projectileCount: definition.projectileCount,
        fireTrauma: definition.fireTrauma,
        cockpitRecoil: definition.cockpitRecoil,
        muzzleOffset: definition.muzzleOffset
    };
}

export function buildWeaponFireRequests(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountIds: WeaponMountId[]
): WeaponFireRequest[] {
    return mountIds.map((mountId) => buildWeaponFireRequest(mounts[mountId]));
}
