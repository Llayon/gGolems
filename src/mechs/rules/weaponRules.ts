import { getWeaponDefinition } from '../../combat/weapons';
import type {
    WeaponGroupId,
    WeaponMountId,
    WeaponMountRuntime,
    WeaponStatusView
} from '../../combat/weaponTypes';
import type { GolemSectionState } from '../sections';
import type { MechHeatState } from '../runtimeTypes';

export type WeaponCooldownPatch = Partial<Record<WeaponMountId, number>>;
export type WeaponEnabledPatch = Partial<Record<WeaponMountId, boolean>>;

export type ReadyWeaponEvaluation = {
    mountIds: WeaponMountId[];
    totalHeat: number;
    blockedReason: 'none' | 'noReadyMounts' | 'overheated' | 'insufficientSteam';
};

export function buildWeaponCooldownPatch(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountOrder: WeaponMountId[],
    dt: number
): WeaponCooldownPatch {
    const patch: WeaponCooldownPatch = {};

    for (const mountId of mountOrder) {
        const nextCooldown = Math.max(0, mounts[mountId].cooldownRemaining - dt);
        if (nextCooldown !== mounts[mountId].cooldownRemaining) {
            patch[mountId] = nextCooldown;
        }
    }

    return patch;
}

export function buildMountAvailabilityPatch(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountOrder: WeaponMountId[],
    sections: GolemSectionState
): WeaponEnabledPatch {
    const patch: WeaponEnabledPatch = {};

    for (const mountId of mountOrder) {
        const nextEnabled = sections[mounts[mountId].section] > 0;
        if (nextEnabled !== mounts[mountId].enabled) {
            patch[mountId] = nextEnabled;
        }
    }

    return patch;
}

export function buildWeaponStatusViews(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountOrder: WeaponMountId[],
    heatState: MechHeatState
): WeaponStatusView[] {
    return mountOrder.map((mountId) => {
        const mount = mounts[mountId];
        const definition = getWeaponDefinition(mount.weaponId);

        let state: WeaponStatusView['state'] = 'ready';
        if (!mount.enabled) {
            state = 'offline';
        } else if (mount.cooldownRemaining > 0) {
            state = 'recycle';
        } else if (heatState.isOverheated || heatState.steam < definition.heatCost) {
            state = 'heat';
        }

        return {
            mountId: mount.mountId,
            weaponId: mount.weaponId,
            group: mount.group,
            section: mount.section,
            nameKey: definition.nameKey,
            shortKey: definition.shortKey,
            state,
            cooldownRemaining: mount.cooldownRemaining,
            heatCost: definition.heatCost
        };
    });
}

export function canAnyWeaponFire(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountOrder: WeaponMountId[],
    heatState: MechHeatState
): boolean {
    return mountOrder.some((mountId) => {
        const mount = mounts[mountId];
        const definition = getWeaponDefinition(mount.weaponId);
        return mount.enabled
            && mount.cooldownRemaining <= 0
            && !heatState.isOverheated
            && heatState.steam >= definition.heatCost;
    });
}

export function evaluateReadyWeaponMounts(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountOrder: WeaponMountId[],
    heatState: MechHeatState,
    groupId?: WeaponGroupId
): ReadyWeaponEvaluation {
    const readyMountIds = mountOrder
        .filter((mountId) => groupId === undefined || mounts[mountId].group === groupId)
        .filter((mountId) => {
            const mount = mounts[mountId];
            return mount.enabled && mount.cooldownRemaining <= 0;
        });

    if (readyMountIds.length === 0) {
        return {
            mountIds: [],
            totalHeat: 0,
            blockedReason: 'noReadyMounts'
        };
    }

    if (heatState.isOverheated) {
        return {
            mountIds: [],
            totalHeat: 0,
            blockedReason: 'overheated'
        };
    }

    const totalHeat = readyMountIds.reduce(
        (sum, mountId) => sum + getWeaponDefinition(mounts[mountId].weaponId).heatCost,
        0
    );

    if (heatState.steam < totalHeat) {
        return {
            mountIds: [],
            totalHeat,
            blockedReason: 'insufficientSteam'
        };
    }

    return {
        mountIds: readyMountIds,
        totalHeat,
        blockedReason: 'none'
    };
}

export function buildWeaponFireCooldownPatch(
    mounts: Record<WeaponMountId, WeaponMountRuntime>,
    mountIds: WeaponMountId[]
): WeaponCooldownPatch {
    const patch: WeaponCooldownPatch = {};

    for (const mountId of mountIds) {
        patch[mountId] = getWeaponDefinition(mounts[mountId].weaponId).cooldown;
    }

    return patch;
}
