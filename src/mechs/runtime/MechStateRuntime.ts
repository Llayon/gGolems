import * as THREE from 'three';
import type {
    WeaponFireRequest,
    WeaponGroupId,
    WeaponMountId,
    WeaponMountRuntime,
    WeaponStatusView
} from '../../combat/weaponTypes';
import type { GolemState } from '../../entities/GolemControllerTypes';
import type { KWIIRuntimeVisual } from '../../entities/KWIIRuntimeAsset';
import type { GolemSection, GolemSectionState } from '../sections';
import type { MechDamageState, MechHeatState, MechWeaponState } from '../runtimeTypes';
import {
    spendSteamState,
    tickSteamState,
    triggerOverheatState
} from '../rules/steamRules';
import {
    buildWeaponCooldownPatch,
    buildWeaponFireCooldownPatch,
    buildWeaponStatusViews,
    canAnyWeaponFire,
    evaluateReadyWeaponMounts
} from '../rules/weaponRules';
import {
    applyMechSectionDamage,
    applyMechSectionStatePatch,
    resetMechDamageState,
    syncMechDamageState
} from './MechDamageRuntime';
import {
    buildWeaponFireRequests,
    resetWeaponRuntimeState,
    type WeaponRecoilState
} from './MechWeaponRuntime';
import { applyProceduralSectionVisuals } from './MechVisualDriver';

type MechHeatTarget = {
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
};

type MechDamageTarget = {
    sections: GolemSectionState;
    maxSections: GolemSectionState;
    hp: number;
    maxHp: number;
};

type MechWeaponTarget = {
    weaponMountOrder: WeaponMountId[];
    weaponMounts: Record<WeaponMountId, WeaponMountRuntime>;
};

type MechWeaponPatchTarget = MechWeaponTarget & {
    weaponRecoil: WeaponRecoilState;
};

type MechSectionVisualTarget = {
    heroVisual: KWIIRuntimeVisual | null;
    head: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    sections: GolemSectionState;
};

type MechStateSnapshotTarget = MechHeatTarget & MechDamageTarget & MechWeaponTarget & {
    legYaw: number;
    torsoYaw: number;
    throttle: number;
    currentSpeed: number;
    mass: number;
};

type MechSectionMutationTarget = MechDamageTarget & MechWeaponPatchTarget & MechSectionVisualTarget;

const _snapshotPosition = new THREE.Vector3();

export function readMechHeatState(target: MechHeatTarget): MechHeatState {
    return {
        steam: target.steam,
        maxSteam: target.maxSteam,
        isOverheated: target.isOverheated,
        overheatTimer: target.overheatTimer
    };
}

export function writeMechHeatState(target: MechHeatTarget, nextState: MechHeatState) {
    target.steam = nextState.steam;
    target.maxSteam = nextState.maxSteam;
    target.isOverheated = nextState.isOverheated;
    target.overheatTimer = nextState.overheatTimer;
}

export function readMechDamageState(target: MechDamageTarget): MechDamageState {
    return {
        sections: target.sections,
        maxSections: target.maxSections,
        hp: target.hp,
        maxHp: target.maxHp
    };
}

export function writeMechDamageState(target: MechDamageTarget, nextState: MechDamageState) {
    target.sections = nextState.sections;
    target.maxSections = nextState.maxSections;
    target.hp = nextState.hp;
    target.maxHp = nextState.maxHp;
}

export function readMechWeaponState(target: MechWeaponTarget): MechWeaponState {
    return {
        weaponMountOrder: target.weaponMountOrder,
        weaponMounts: target.weaponMounts
    };
}

export function applyWeaponCooldownPatchRuntime(
    target: MechWeaponTarget,
    patch: Partial<Record<WeaponMountId, number>>
) {
    for (const mountId of target.weaponMountOrder) {
        const nextCooldown = patch[mountId];
        if (typeof nextCooldown === 'number') {
            target.weaponMounts[mountId].cooldownRemaining = nextCooldown;
        }
    }
}

export function applyWeaponEnabledPatchRuntime(
    target: MechWeaponTarget,
    patch: Partial<Record<WeaponMountId, boolean>>
) {
    for (const mountId of target.weaponMountOrder) {
        const nextEnabled = patch[mountId];
        if (typeof nextEnabled === 'boolean') {
            target.weaponMounts[mountId].enabled = nextEnabled;
        }
    }
}

export function triggerMechOverheatRuntime(target: MechHeatTarget, duration: number) {
    writeMechHeatState(target, triggerOverheatState(readMechHeatState(target), duration));
}

export function spendMechSteamRuntime(target: MechHeatTarget, cost: number) {
    const result = spendSteamState(readMechHeatState(target), cost);
    writeMechHeatState(target, result.nextState);
    return result.success;
}

export function tickMechHeatStateRuntime(target: MechHeatTarget, dt: number) {
    writeMechHeatState(target, tickSteamState(readMechHeatState(target), dt));
}

export function tickMechWeaponCooldownsRuntime(target: MechWeaponTarget, dt: number) {
    applyWeaponCooldownPatchRuntime(
        target,
        buildWeaponCooldownPatch(target.weaponMounts, target.weaponMountOrder, dt)
    );
}

export function syncMechSectionVisualsRuntime(target: MechSectionVisualTarget) {
    applyProceduralSectionVisuals({
        heroVisual: target.heroVisual,
        head: target.head,
        leftArm: target.leftArm,
        rightArm: target.rightArm,
        leftLeg: target.leftLeg,
        rightLeg: target.rightLeg,
        sections: target.sections
    });
}

export function syncMechDamageRuntime(target: MechDamageTarget & MechWeaponTarget) {
    const result = syncMechDamageState({
        damageState: readMechDamageState(target),
        weaponState: readMechWeaponState(target)
    });
    writeMechDamageState(target, result.nextState);
    applyWeaponEnabledPatchRuntime(target, result.enabledPatch);
}

export function applyMechSectionStateRuntime(
    target: MechSectionMutationTarget,
    nextSections: Partial<GolemSectionState>
) {
    const result = applyMechSectionStatePatch({
        damageState: readMechDamageState(target),
        weaponState: readMechWeaponState(target)
    }, nextSections);
    writeMechDamageState(target, result.nextState);
    applyWeaponEnabledPatchRuntime(target, result.enabledPatch);
    syncMechSectionVisualsRuntime(target);
}

export function resetMechDamageAndWeaponsRuntime(target: MechSectionMutationTarget) {
    const result = resetMechDamageState({
        damageState: readMechDamageState(target),
        weaponState: readMechWeaponState(target)
    });
    writeMechDamageState(target, result.nextState);
    resetWeaponRuntimeState(target.weaponMounts, target.weaponRecoil, target.weaponMountOrder);
    applyWeaponEnabledPatchRuntime(target, result.enabledPatch);
    syncMechSectionVisualsRuntime(target);
}

export function applyMechSectionDamageRuntime(
    target: MechSectionMutationTarget,
    section: GolemSection,
    damage: number,
    onDamageFlash?: () => void
) {
    const result = applyMechSectionDamage({
        damageState: readMechDamageState(target),
        weaponState: readMechWeaponState(target)
    }, section, damage);
    writeMechDamageState(target, result.nextState);
    onDamageFlash?.();
    syncMechSectionVisualsRuntime(target);
    applyWeaponEnabledPatchRuntime(target, result.enabledPatch);
    return {
        section: result.section,
        remaining: result.remaining,
        destroyed: result.destroyed,
        lethal: result.lethal,
        totalHp: result.hp
    };
}

export function canMechFireRuntime(target: MechHeatTarget & MechWeaponTarget) {
    return canAnyWeaponFire(target.weaponMounts, target.weaponMountOrder, readMechHeatState(target));
}

export function buildMechWeaponStatusRuntime(target: MechHeatTarget & MechWeaponTarget): WeaponStatusView[] {
    return buildWeaponStatusViews(target.weaponMounts, target.weaponMountOrder, readMechHeatState(target));
}

export function gatherReadyWeaponMountsRuntime(
    target: MechHeatTarget & MechWeaponTarget,
    groupId: WeaponGroupId | undefined,
    overheatDuration: number
): WeaponFireRequest[] {
    const evaluation = evaluateReadyWeaponMounts(
        target.weaponMounts,
        target.weaponMountOrder,
        readMechHeatState(target),
        groupId
    );

    if (evaluation.blockedReason === 'noReadyMounts' || evaluation.blockedReason === 'overheated') {
        return [];
    }

    if (evaluation.blockedReason === 'insufficientSteam') {
        triggerMechOverheatRuntime(target, overheatDuration);
        return [];
    }

    if (!spendMechSteamRuntime(target, evaluation.totalHeat)) {
        return [];
    }

    applyWeaponCooldownPatchRuntime(
        target,
        buildWeaponFireCooldownPatch(target.weaponMounts, evaluation.mountIds)
    );

    return buildWeaponFireRequests(target.weaponMounts, evaluation.mountIds);
}

export function buildMechStateSnapshot(
    target: MechStateSnapshotTarget,
    pos: { x: number; y: number; z: number }
): GolemState {
    _snapshotPosition.set(pos.x, pos.y, pos.z);
    return {
        pos: _snapshotPosition.clone(),
        legYaw: target.legYaw,
        torsoYaw: target.torsoYaw,
        throttle: target.throttle,
        hp: target.hp,
        maxHp: target.maxHp,
        steam: target.steam,
        maxSteam: target.maxSteam,
        isOverheated: target.isOverheated,
        overheatTimer: target.overheatTimer,
        currentSpeed: target.currentSpeed,
        mass: target.mass,
        sections: { ...target.sections },
        maxSections: { ...target.maxSections },
        weaponStatus: buildMechWeaponStatusRuntime(target)
    };
}
