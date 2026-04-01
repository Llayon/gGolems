import { isWeaponCompatibleWithSlot } from '../combat/weapons';
import type { WeaponMountId } from '../combat/weaponTypes';
import { cloneSectionState, type GolemSectionState } from './sections';
import type {
    ChassisDefinition,
    ChassisId,
    FrameFamilyDefinition,
    LoadoutDefinition,
    LoadoutId,
    SignatureAbilityDefinition
} from './types';

const KWII_SECTION_MAX: GolemSectionState = {
    head: 18,
    centerTorso: 48,
    leftTorso: 34,
    rightTorso: 34,
    leftArm: 24,
    rightArm: 24,
    leftLeg: 36,
    rightLeg: 36
};

export const FRAME_FAMILY_DEFINITIONS: Record<string, FrameFamilyDefinition> = {
    duelist: {
        id: 'duelist',
        name: 'Duelist',
        role: 'midline skirmisher',
        description: 'Balanced pressure frame built around stable torso fire and paired arm mounts.'
    },
    ranger: {
        id: 'ranger',
        name: 'Ranger',
        role: 'mobile harrier',
        description: 'Fast recon family that trades durability for rotation speed and objective pressure.'
    },
    bulwark: {
        id: 'bulwark',
        name: 'Bulwark',
        role: 'linebreaker',
        description: 'Heavy family with superior staying power, lower speed, and stronger sustained heat budgets.'
    }
};

export const SIGNATURE_ABILITY_DEFINITIONS: Record<string, SignatureAbilityDefinition> = {
    pressure_surge: {
        id: 'pressure_surge',
        name: 'Pressure Surge',
        description: 'Short overpressure burst tuned for aggressive mid-range pushes.'
    },
    vector_feint: {
        id: 'vector_feint',
        name: 'Vector Feint',
        description: 'Mobility-biased signature for fast repositioning and lane swapping.'
    },
    anchor_mode: {
        id: 'anchor_mode',
        name: 'Anchor Mode',
        description: 'Stability-biased signature that rewards holding ground and trading through pressure.'
    }
};

export const CHASSIS_DEFINITIONS: Record<ChassisId, ChassisDefinition> = {
    kwii_strider: {
        id: 'kwii_strider',
        familyId: 'duelist',
        assetId: 'kwii',
        defaultLoadoutId: 'kwii_standard',
        name: 'KWII Strider',
        description: 'Current medium baseline frame used as the reference contract for hero and remote mechs.',
        weightClass: 'medium',
        mass: 2.0,
        maxSteam: 100,
        topSpeed: 9,
        dashSpeed: 16.5,
        sectionMax: cloneSectionState(KWII_SECTION_MAX),
        mountLayout: [
            { mountId: 'rightArmMount', slotClass: 'arm', section: 'rightArm', group: 1, label: 'Right Arm' },
            { mountId: 'leftArmMount', slotClass: 'arm', section: 'leftArm', group: 2, label: 'Left Arm' },
            { mountId: 'torsoMount', slotClass: 'torso', section: 'rightTorso', group: 3, label: 'Torso' }
        ],
        signatureAbilityIds: ['pressure_surge'],
        budgets: { offense: 3, mobility: 3, durability: 3, heat: 3 }
    },
    courier_scout: {
        id: 'courier_scout',
        familyId: 'ranger',
        assetId: 'prototype',
        defaultLoadoutId: 'courier_raider',
        name: 'Courier Scout',
        description: 'Fast objective runner intended for future lighter variants built on the same runtime contract.',
        weightClass: 'light',
        mass: 1.15,
        maxSteam: 84,
        topSpeed: 12.5,
        dashSpeed: 18.4,
        sectionMax: {
            head: 16,
            centerTorso: 38,
            leftTorso: 26,
            rightTorso: 26,
            leftArm: 18,
            rightArm: 18,
            leftLeg: 28,
            rightLeg: 28
        },
        mountLayout: [
            { mountId: 'rightArmMount', slotClass: 'arm', section: 'rightArm', group: 1, label: 'Right Arm' },
            { mountId: 'leftArmMount', slotClass: 'arm', section: 'leftArm', group: 2, label: 'Left Arm' },
            { mountId: 'torsoMount', slotClass: 'torso', section: 'centerTorso', group: 3, label: 'Torso' }
        ],
        signatureAbilityIds: ['vector_feint'],
        budgets: { offense: 2, mobility: 5, durability: 2, heat: 2 }
    },
    bastion_siege: {
        id: 'bastion_siege',
        familyId: 'bulwark',
        assetId: 'prototype',
        defaultLoadoutId: 'bastion_breacher',
        name: 'Bastion Siege',
        description: 'Heavy lineholder concept for later artillery and bruiser branches.',
        weightClass: 'heavy',
        mass: 3.4,
        maxSteam: 124,
        topSpeed: 5.8,
        dashSpeed: 13.8,
        sectionMax: {
            head: 20,
            centerTorso: 62,
            leftTorso: 42,
            rightTorso: 42,
            leftArm: 28,
            rightArm: 28,
            leftLeg: 42,
            rightLeg: 42
        },
        mountLayout: [
            { mountId: 'rightArmMount', slotClass: 'arm', section: 'rightArm', group: 1, label: 'Right Arm' },
            { mountId: 'leftArmMount', slotClass: 'arm', section: 'leftArm', group: 2, label: 'Left Arm' },
            { mountId: 'torsoMount', slotClass: 'torso', section: 'centerTorso', group: 3, label: 'Torso' }
        ],
        signatureAbilityIds: ['anchor_mode'],
        budgets: { offense: 4, mobility: 1, durability: 5, heat: 4 }
    }
};

export const LOADOUT_DEFINITIONS: Record<LoadoutId, LoadoutDefinition> = {
    kwii_standard: {
        id: 'kwii_standard',
        chassisId: 'kwii_strider',
        name: 'Standard Line',
        description: 'Current live loadout: bolt on the right, arc on the left, steam cannon on the torso.',
        assignments: [
            { mountId: 'rightArmMount', weaponId: 'rune_bolt' },
            { mountId: 'leftArmMount', weaponId: 'arc_emitter' },
            { mountId: 'torsoMount', weaponId: 'steam_cannon' }
        ],
        signatureAbilityId: 'pressure_surge'
    },
    courier_raider: {
        id: 'courier_raider',
        chassisId: 'courier_scout',
        name: 'Raider Fit',
        description: 'Light harassment layout built around two arm weapons and a torso finisher.',
        assignments: [
            { mountId: 'rightArmMount', weaponId: 'rune_bolt' },
            { mountId: 'leftArmMount', weaponId: 'rune_bolt' },
            { mountId: 'torsoMount', weaponId: 'steam_cannon' }
        ],
        signatureAbilityId: 'vector_feint'
    },
    bastion_breacher: {
        id: 'bastion_breacher',
        chassisId: 'bastion_siege',
        name: 'Breacher Fit',
        description: 'Heavy loadout that keeps the current weapon trio but shifts the value proposition toward staying power.',
        assignments: [
            { mountId: 'rightArmMount', weaponId: 'arc_emitter' },
            { mountId: 'leftArmMount', weaponId: 'rune_bolt' },
            { mountId: 'torsoMount', weaponId: 'steam_cannon' }
        ],
        signatureAbilityId: 'anchor_mode'
    }
};

export const DEFAULT_CHASSIS_ID: ChassisId = 'kwii_strider';

function getMountIds(chassisId: ChassisId): WeaponMountId[] {
    return CHASSIS_DEFINITIONS[chassisId].mountLayout.map((slot) => slot.mountId);
}

export function validateLoadoutDefinition(loadout: LoadoutDefinition) {
    const chassis = CHASSIS_DEFINITIONS[loadout.chassisId];
    if (!chassis) {
        throw new Error(`Unknown chassis "${loadout.chassisId}" for loadout "${loadout.id}".`);
    }

    const slotMap = new Map(chassis.mountLayout.map((slot) => [slot.mountId, slot]));
    const seenAssignments = new Set<WeaponMountId>();

    for (const assignment of loadout.assignments) {
        const slot = slotMap.get(assignment.mountId);
        if (!slot) {
            throw new Error(`Loadout "${loadout.id}" references unknown mount "${assignment.mountId}".`);
        }
        if (seenAssignments.has(assignment.mountId)) {
            throw new Error(`Loadout "${loadout.id}" assigns mount "${assignment.mountId}" more than once.`);
        }
        if (!isWeaponCompatibleWithSlot(assignment.weaponId, slot.slotClass)) {
            throw new Error(`Weapon "${assignment.weaponId}" is not compatible with slot class "${slot.slotClass}".`);
        }
        seenAssignments.add(assignment.mountId);
    }

    for (const mountId of getMountIds(chassis.id)) {
        if (!seenAssignments.has(mountId)) {
            throw new Error(`Loadout "${loadout.id}" is missing assignment for "${mountId}".`);
        }
    }
}

for (const loadout of Object.values(LOADOUT_DEFINITIONS)) {
    validateLoadoutDefinition(loadout);
}

export function getChassisDefinition(chassisId: ChassisId) {
    return CHASSIS_DEFINITIONS[chassisId];
}

export function getLoadoutDefinition(loadoutId: LoadoutId) {
    return LOADOUT_DEFINITIONS[loadoutId];
}

export function getDefaultLoadoutForChassis(chassisId: ChassisId) {
    return LOADOUT_DEFINITIONS[CHASSIS_DEFINITIONS[chassisId].defaultLoadoutId];
}
