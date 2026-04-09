import type { WeaponStatusView } from '../combat/weaponTypes';
import type {
    ControlOwner,
    ControlPointId,
    ControlPointView,
    GameMode,
    TeamId,
    TeamOverview,
    TeamScoreState
} from '../gameplay/types';
import type { GolemSection } from '../mechs/sections';

export type SectionName = GolemSection;
export type SectionState = Record<SectionName, number>;

export type RadarContact = {
    x: number;
    y: number;
    kind: 'enemy' | 'bot';
    distance: number;
    meters: number;
};

export type ControlHudSummary = {
    blueHeld: number;
    redHeld: number;
    contestedPoints: ControlPointId[];
    activeCapture: {
        point: ControlPointId;
        team: TeamId;
        progress: number;
        targetOwner: ControlOwner;
        unitAdvantage: number;
    } | null;
    leadingTeam: TeamId | null;
    scoreGap: number;
    blueToWin: number;
    redToWin: number;
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
    cameraMode: 'cockpit' | 'thirdPerson';
    aimOffsetX: number;
    aimOffsetY: number;
    cockpitKickX: number;
    cockpitKickY: number;
    cockpitKickRoll: number;
    cockpitFrameKick: number;
    cockpitFlash: number;
    reticleKickX: number;
    reticleKickY: number;
    hitConfirm: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    sections: SectionState;
    maxSections: SectionState;
    weaponStatus: WeaponStatusView[];
    radarContacts: RadarContact[];
    gameMode: GameMode;
    controlPoints: ControlPointView[];
    controlSummary: ControlHudSummary;
    teamScores: TeamScoreState;
    teamOverview: TeamOverview;
    respawnTimer: number;
    terrainColliderMode: 'heightfield' | 'trimeshFallback';
    terrainColliderError: string;
};

export const DEFAULT_SECTION_STATE: SectionState = {
    head: 18,
    centerTorso: 48,
    leftTorso: 34,
    rightTorso: 34,
    leftArm: 24,
    rightArm: 24,
    leftLeg: 36,
    rightLeg: 36
};

export const INITIAL_GAME_HUD_STATE: GameHudState = {
    hp: 100,
    maxHp: 100,
    steam: 100,
    maxSteam: 100,
    isOverheated: false,
    overheatTimer: 0,
    legYaw: 0,
    torsoYaw: 0,
    throttle: 0,
    speed: 0,
    maxSpeed: 10,
    maxTwist: 1.75,
    cameraMode: 'cockpit',
    aimOffsetX: 0,
    aimOffsetY: 0,
    cockpitKickX: 0,
    cockpitKickY: 0,
    cockpitKickRoll: 0,
    cockpitFrameKick: 0,
    cockpitFlash: 0,
    reticleKickX: 0,
    reticleKickY: 0,
    hitConfirm: 0,
    hitTargetHp: 0,
    hitTargetMaxHp: 100,
    sections: { ...DEFAULT_SECTION_STATE },
    maxSections: { ...DEFAULT_SECTION_STATE },
    weaponStatus: [],
    radarContacts: [],
    gameMode: 'control',
    controlPoints: [],
    controlSummary: {
        blueHeld: 0,
        redHeld: 0,
        contestedPoints: [],
        activeCapture: null,
        leadingTeam: null,
        scoreGap: 0,
        blueToWin: 200,
        redToWin: 200
    },
    teamScores: { blue: 0, red: 0, scoreToWin: 200, winner: null },
    teamOverview: {
        blue: { alive: 5, total: 5, waveTimer: 0 },
        red: { alive: 5, total: 5, waveTimer: 0 }
    },
    respawnTimer: 0,
    terrainColliderMode: 'heightfield',
    terrainColliderError: ''
};
