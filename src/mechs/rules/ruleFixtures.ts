import type { WeaponMountId, WeaponMountRuntime } from '../../combat/weaponTypes';
import { getChassisDefinition, getDefaultLoadoutForChassis } from '../definitions';
import { cloneSectionState, type GolemSectionState } from '../sections';
import type { ChassisId } from '../types';
import type { MechHeatState } from '../runtimeTypes';

export function createFixtureHeatState(overrides: Partial<MechHeatState> = {}): MechHeatState {
    return {
        steam: 100,
        maxSteam: 100,
        isOverheated: false,
        overheatTimer: 0,
        ...overrides
    };
}

export function createFixtureSectionState(
    chassisId: ChassisId = 'kwii_strider',
    overrides: Partial<GolemSectionState> = {}
): GolemSectionState {
    return {
        ...cloneSectionState(getChassisDefinition(chassisId).sectionMax),
        ...overrides
    };
}

export function createFixtureWeaponMounts(
    chassisId: ChassisId = 'kwii_strider'
): Record<WeaponMountId, WeaponMountRuntime> {
    const chassis = getChassisDefinition(chassisId);
    const loadout = getDefaultLoadoutForChassis(chassisId);

    return chassis.mountLayout.reduce((acc, slot) => {
        const assignment = loadout.assignments.find((item) => item.mountId === slot.mountId);
        if (!assignment) {
            throw new Error(`Missing fixture assignment for mount "${slot.mountId}".`);
        }

        acc[slot.mountId] = {
            mountId: slot.mountId,
            weaponId: assignment.weaponId,
            group: slot.group,
            section: slot.section,
            cooldownRemaining: 0,
            enabled: true
        };

        return acc;
    }, {} as Record<WeaponMountId, WeaponMountRuntime>);
}
