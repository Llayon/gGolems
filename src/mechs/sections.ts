export type GolemSection =
    | 'head'
    | 'centerTorso'
    | 'leftTorso'
    | 'rightTorso'
    | 'leftArm'
    | 'rightArm'
    | 'leftLeg'
    | 'rightLeg';

export type GolemSectionState = Record<GolemSection, number>;

export const GOLEM_SECTION_ORDER: GolemSection[] = [
    'head',
    'centerTorso',
    'leftTorso',
    'rightTorso',
    'leftArm',
    'rightArm',
    'leftLeg',
    'rightLeg'
];

export function cloneSectionState(state: GolemSectionState): GolemSectionState {
    return { ...state };
}
