import * as THREE from 'three';
import { getWeaponDefinition } from '../../combat/weapons';
import type {
    WeaponFireRequest,
    WeaponId,
    WeaponMountId,
    WeaponMountRuntime
} from '../../combat/weaponTypes';
import type { KWIIRuntimeVisual } from '../../entities/KWIIRuntimeAsset';
import type { ChassisDefinition, LoadoutDefinition } from '../types';

export type WeaponRecoilState = Record<WeaponMountId, number>;

type WeaponMountVisualRoots = {
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    torso: THREE.Object3D;
};

type WeaponRuntimeVisualTarget = WeaponMountVisualRoots & {
    heroVisual: KWIIRuntimeVisual | null;
    weaponMountOrder: WeaponMountId[];
    weaponMounts: Record<WeaponMountId, WeaponMountRuntime>;
    weaponRecoil: WeaponRecoilState;
};

const _weaponMuzzleOffset = new THREE.Vector3();

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

export function getWeaponMountRoot(
    target: WeaponMountVisualRoots,
    mountId: WeaponMountId
) {
    switch (mountId) {
        case 'leftArmMount':
            return target.leftArm;
        case 'rightArmMount':
            return target.rightArm;
        case 'torsoMount':
        default:
            return target.torso;
    }
}

export function getHeroMountSocket(
    target: Pick<WeaponRuntimeVisualTarget, 'heroVisual'>,
    mountId: WeaponMountId
) {
    return target.heroVisual?.sockets[mountId] ?? null;
}

export function resolveWeaponMuzzleOrigin(
    target: WeaponRuntimeVisualTarget,
    mountId: WeaponMountId,
    out: THREE.Vector3
) {
    const heroSocket = getHeroMountSocket(target, mountId);
    if (heroSocket) {
        return heroSocket.getWorldPosition(out);
    }

    const mount = target.weaponMounts[mountId];
    const definition = getWeaponDefinition(mount.weaponId);
    _weaponMuzzleOffset.set(definition.muzzleOffset.x, definition.muzzleOffset.y, definition.muzzleOffset.z);
    getWeaponMountRoot(target, mountId).localToWorld(out.copy(_weaponMuzzleOffset));
    return out;
}

export function findWeaponMountId(
    target: Pick<WeaponRuntimeVisualTarget, 'weaponMountOrder' | 'weaponMounts'>,
    weaponId: WeaponId
): WeaponMountId {
    return target.weaponMountOrder.find((mountId) => target.weaponMounts[mountId].weaponId === weaponId) ?? 'torsoMount';
}

export function triggerWeaponRecoilRuntime(
    target: Pick<WeaponRuntimeVisualTarget, 'weaponRecoil' | 'heroVisual'>,
    mountId: WeaponMountId
) {
    target.weaponRecoil[mountId] = 1;
    const fireAction = target.heroVisual?.actions.fire;
    if (fireAction) {
        fireAction.stop();
        fireAction.reset();
        fireAction.play();
    }
}
