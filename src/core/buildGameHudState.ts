import type { ControlPointView, GameMode, TeamOverview, TeamScoreState } from '../gameplay/types';
import type { GolemState } from '../entities/GolemController';
import type { GameHudState, RadarContact } from './gameHudState';

type CockpitRecoilState = {
    x: number;
    y: number;
    roll: number;
    frame: number;
    flash: number;
    reticleX: number;
    reticleY: number;
};

export type BuildGameHudStateParams = {
    alive: boolean;
    golemState: GolemState;
    maxSpeed: number;
    maxTwist: number;
    cameraMode: 'cockpit' | 'thirdPerson';
    aimOffsetX: number;
    aimOffsetY: number;
    cockpitRecoil: CockpitRecoilState;
    hitConfirm: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    radarContacts: RadarContact[];
    gameMode: GameMode;
    controlPoints: ControlPointView[];
    teamScores: TeamScoreState;
    teamOverview: TeamOverview;
    respawnTimer: number;
    terrainColliderMode: 'heightfield' | 'trimeshFallback';
    terrainColliderError: string;
};

export function buildGameHudState(params: BuildGameHudStateParams): GameHudState {
    const { golemState, cockpitRecoil } = params;
    return {
        hp: params.alive ? golemState.hp : 0,
        maxHp: golemState.maxHp,
        steam: golemState.steam,
        maxSteam: golemState.maxSteam,
        isOverheated: golemState.isOverheated,
        overheatTimer: golemState.overheatTimer,
        legYaw: golemState.legYaw,
        torsoYaw: golemState.torsoYaw,
        throttle: golemState.throttle,
        speed: golemState.currentSpeed,
        maxSpeed: params.maxSpeed,
        maxTwist: params.maxTwist,
        cameraMode: params.cameraMode,
        aimOffsetX: params.aimOffsetX,
        aimOffsetY: params.aimOffsetY,
        cockpitKickX: cockpitRecoil.x,
        cockpitKickY: cockpitRecoil.y,
        cockpitKickRoll: cockpitRecoil.roll,
        cockpitFrameKick: cockpitRecoil.frame,
        cockpitFlash: cockpitRecoil.flash,
        reticleKickX: cockpitRecoil.reticleX,
        reticleKickY: cockpitRecoil.reticleY,
        hitConfirm: params.hitConfirm,
        hitTargetHp: params.hitTargetHp,
        hitTargetMaxHp: params.hitTargetMaxHp,
        sections: { ...golemState.sections },
        maxSections: { ...golemState.maxSections },
        weaponStatus: golemState.weaponStatus,
        radarContacts: params.radarContacts,
        gameMode: params.gameMode,
        controlPoints: params.controlPoints,
        teamScores: { ...params.teamScores },
        teamOverview: params.teamOverview,
        respawnTimer: params.respawnTimer,
        terrainColliderMode: params.terrainColliderMode,
        terrainColliderError: params.terrainColliderError
    };
}
