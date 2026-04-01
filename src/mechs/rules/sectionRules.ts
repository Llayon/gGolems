import { cloneSectionState, GOLEM_SECTION_ORDER, type GolemSection, type GolemSectionState } from '../sections';

export type SectionTotals = {
    hp: number;
    maxHp: number;
};

export type SectionDamageResult = SectionTotals & {
    nextSections: GolemSectionState;
    section: GolemSection;
    remaining: number;
    destroyed: boolean;
    lethal: boolean;
};

export function computeSectionTotals(
    sections: GolemSectionState,
    maxSections: GolemSectionState
): SectionTotals {
    return {
        hp: GOLEM_SECTION_ORDER.reduce((sum, section) => sum + sections[section], 0),
        maxHp: GOLEM_SECTION_ORDER.reduce((sum, section) => sum + maxSections[section], 0)
    };
}

export function applySectionStatePatch(
    currentSections: GolemSectionState,
    nextSections: Partial<GolemSectionState>
): GolemSectionState {
    const merged = cloneSectionState(currentSections);
    for (const section of GOLEM_SECTION_ORDER) {
        const nextValue = nextSections[section];
        if (typeof nextValue === 'number') {
            merged[section] = nextValue;
        }
    }
    return merged;
}

export function resetSectionState(maxSections: GolemSectionState): GolemSectionState {
    return cloneSectionState(maxSections);
}

export function applySectionDamageState(
    currentSections: GolemSectionState,
    maxSections: GolemSectionState,
    section: GolemSection,
    damage: number
): SectionDamageResult {
    const nextSections = cloneSectionState(currentSections);
    const current = nextSections[section];
    const remaining = Math.max(0, current - damage);
    nextSections[section] = remaining;
    const totals = computeSectionTotals(nextSections, maxSections);

    return {
        ...totals,
        nextSections,
        section,
        remaining,
        destroyed: current > 0 && remaining <= 0,
        lethal: (section === 'head' || section === 'centerTorso') && remaining <= 0
    };
}
