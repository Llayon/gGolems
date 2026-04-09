import type {
    ControlOwner,
    ControlPointView,
    GameMode,
    TeamId,
    TeamOverview,
    TeamScoreState
} from '../gameplay/types';
import type { GolemState } from '../entities/GolemController';
import type { ControlHudSummary, GameHudState, RadarContact } from './gameHudState';

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

function getHeldCounts(points: ControlPointView[]) {
    return {
        blueHeld: points.filter((point) => point.owner === 'blue').length,
        redHeld: points.filter((point) => point.owner === 'red').length
    };
}

function getCapturingTeam(point: ControlPointView): TeamId | null {
    const blueCapturing = point.blueInside > 0 && point.redInside === 0 && !(point.owner === 'blue' && point.capture >= 0.99);
    if (blueCapturing) return 'blue';

    const redCapturing = point.redInside > 0 && point.blueInside === 0 && !(point.owner === 'red' && point.capture <= -0.99);
    if (redCapturing) return 'red';

    return null;
}

function getCaptureProgress(point: ControlPointView, team: TeamId) {
    return team === 'blue'
        ? Math.max(0, Math.min(1, (point.capture + 1) / 2))
        : Math.max(0, Math.min(1, (1 - point.capture) / 2));
}

function getLeadingTeam(teamScores: TeamScoreState, blueHeld: number, redHeld: number): TeamId | null {
    if (teamScores.blue > teamScores.red) return 'blue';
    if (teamScores.red > teamScores.blue) return 'red';
    if (blueHeld > redHeld) return 'blue';
    if (redHeld > blueHeld) return 'red';
    return null;
}

function buildControlHudSummary(points: ControlPointView[], teamScores: TeamScoreState): ControlHudSummary {
    const { blueHeld, redHeld } = getHeldCounts(points);
    const contestedPoints = points.filter((point) => point.contested).map((point) => point.id);
    const activeCapture = points
        .map((point) => {
            const team = getCapturingTeam(point);
            if (!team) return null;
            const unitAdvantage = team === 'blue'
                ? Math.max(0, point.blueInside - point.redInside)
                : Math.max(0, point.redInside - point.blueInside);
            return {
                point: point.id,
                team,
                progress: getCaptureProgress(point, team),
                targetOwner: point.owner as ControlOwner,
                unitAdvantage
            };
        })
        .filter((capture): capture is NonNullable<ControlHudSummary['activeCapture']> => Boolean(capture))
        .sort((left, right) => {
            const leftPressuring = left.targetOwner !== 'neutral' && left.targetOwner !== left.team ? 1 : 0;
            const rightPressuring = right.targetOwner !== 'neutral' && right.targetOwner !== right.team ? 1 : 0;
            if (leftPressuring !== rightPressuring) return rightPressuring - leftPressuring;
            if (left.unitAdvantage !== right.unitAdvantage) return right.unitAdvantage - left.unitAdvantage;
            return right.progress - left.progress;
        })[0] ?? null;

    return {
        blueHeld,
        redHeld,
        contestedPoints,
        activeCapture,
        leadingTeam: getLeadingTeam(teamScores, blueHeld, redHeld),
        scoreGap: Math.abs(teamScores.blue - teamScores.red),
        blueToWin: Math.max(0, teamScores.scoreToWin - teamScores.blue),
        redToWin: Math.max(0, teamScores.scoreToWin - teamScores.red)
    };
}

export function buildGameHudState(params: BuildGameHudStateParams): GameHudState {
    const { golemState, cockpitRecoil } = params;
    const controlSummary = buildControlHudSummary(params.controlPoints, params.teamScores);
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
        controlSummary,
        teamScores: { ...params.teamScores },
        teamOverview: params.teamOverview,
        respawnTimer: params.respawnTimer,
        terrainColliderMode: params.terrainColliderMode,
        terrainColliderError: params.terrainColliderError
    };
}
