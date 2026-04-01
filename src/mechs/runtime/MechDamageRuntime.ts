import type { WeaponMountId } from '../../combat/weaponTypes';
import type { MechDamageState, MechWeaponState } from '../runtimeTypes';
import type { GolemSection, GolemSectionState } from '../sections';
import {
    applySectionDamageState,
    applySectionStatePatch,
    computeSectionTotals,
    resetSectionState,
    type SectionDamageResult
} from '../rules/sectionRules';
import { buildMountAvailabilityPatch } from '../rules/weaponRules';

export type DamageSyncResult = {
    nextState: MechDamageState;
    enabledPatch: Partial<Record<WeaponMountId, boolean>>;
};

export type ApplyMechSectionDamageResult = SectionDamageResult & {
    nextState: MechDamageState;
    enabledPatch: Partial<Record<WeaponMountId, boolean>>;
};

type DamageRuntimeContext = {
    damageState: MechDamageState;
    weaponState: MechWeaponState;
};

function buildDamageState(
    sections: GolemSectionState,
    maxSections: GolemSectionState
): MechDamageState {
    const totals = computeSectionTotals(sections, maxSections);
    return {
        sections,
        maxSections,
        hp: totals.hp,
        maxHp: totals.maxHp
    };
}

function buildEnabledPatch(
    weaponState: MechWeaponState,
    sections: GolemSectionState
) {
    return buildMountAvailabilityPatch(
        weaponState.weaponMounts,
        weaponState.weaponMountOrder,
        sections
    );
}

export function syncMechDamageState(
    context: DamageRuntimeContext
): DamageSyncResult {
    return {
        nextState: buildDamageState(context.damageState.sections, context.damageState.maxSections),
        enabledPatch: buildEnabledPatch(context.weaponState, context.damageState.sections)
    };
}

export function applyMechSectionStatePatch(
    context: DamageRuntimeContext,
    nextSections: Partial<GolemSectionState>
): DamageSyncResult {
    const sections = applySectionStatePatch(context.damageState.sections, nextSections);
    return {
        nextState: buildDamageState(sections, context.damageState.maxSections),
        enabledPatch: buildEnabledPatch(context.weaponState, sections)
    };
}

export function resetMechDamageState(
    context: DamageRuntimeContext
): DamageSyncResult {
    const sections = resetSectionState(context.damageState.maxSections);
    return {
        nextState: buildDamageState(sections, context.damageState.maxSections),
        enabledPatch: buildEnabledPatch(context.weaponState, sections)
    };
}

export function applyMechSectionDamage(
    context: DamageRuntimeContext,
    section: GolemSection,
    damage: number
): ApplyMechSectionDamageResult {
    const result = applySectionDamageState(
        context.damageState.sections,
        context.damageState.maxSections,
        section,
        damage
    );

    return {
        ...result,
        nextState: {
            sections: result.nextSections,
            maxSections: context.damageState.maxSections,
            hp: result.hp,
            maxHp: result.maxHp
        },
        enabledPatch: buildEnabledPatch(context.weaponState, result.nextSections)
    };
}
