export type SessionMode = 'solo' | 'host' | 'client';
export type AimPreset = 'LOW' | 'MID' | 'HIGH';
export type SectionName = 'head' | 'centerTorso' | 'leftTorso' | 'rightTorso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
export type SectionState = Record<SectionName, number>;

export type RadarContact = {
    x: number;
    y: number;
    kind: 'enemy' | 'bot';
    distance: number;
    meters: number;
};

export type GameHudState = {
    hp: number;
    maxHp: number;
    steam: number;
    maxSteam: number;
    isOverheated: boolean;
    overheatTimer: number;
    legYaw: number;
    torsoYaw: number;
    throttle: number;
    speed: number;
    maxSpeed: number;
    maxTwist: number;
    aimOffsetX: number;
    aimOffsetY: number;
    hitConfirm: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    sections: SectionState;
    maxSections: SectionState;
    radarContacts: RadarContact[];
};
