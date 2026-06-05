import * as THREE from 'three';
import type { GolemController } from '../entities/GolemController';
import type { MechCamera } from '../camera/MechCamera';
import type { ControlPointManager } from '../gameplay/ControlPointManager';
import type { DummyBot } from '../entities/DummyBot';
import type { Renderer } from './Renderer';
import type { PlayerRespawnState, RemotePlayerState } from './respawn/types';
import type { GameMode, TeamScoreState } from '../gameplay/types';
import type { GameHudState } from './gameHudState';
import type { TerrainBuilder } from '../world/TerrainBuilder';
import { buildGameHudState } from './buildGameHudState';
import { buildRadarContacts } from './gameHudTelemetry';
import { buildTeamOverview } from './match/MatchRuntime';
import { ROTATION } from '../utils/constants';

const _aimPoint = new THREE.Vector3();

export type HudRenderContext = {
    golem: GolemController;
    mechCamera: MechCamera;
    controlPoints: ControlPointManager;
    renderer: Renderer;
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    localRespawnState: PlayerRespawnState;
    gameMode: GameMode;
    teamScores: TeamScoreState;
    hitConfirmTimer: number;
    hitTargetHp: number;
    hitTargetMaxHp: number;
    terrain: TerrainBuilder;
    getAimTargetPoint: (out: THREE.Vector3) => void;
    onStateUpdate: (state: GameHudState) => void;
};

export function renderHud(ctx: HudRenderContext) {
    const golemState = ctx.golem.getState();
    ctx.getAimTargetPoint(_aimPoint);
    _aimPoint.project(ctx.renderer.camera);

    const aimScreenX = THREE.MathUtils.clamp(_aimPoint.x, -1.2, 1.2);
    const aimScreenY = THREE.MathUtils.clamp(_aimPoint.y, -1.2, 1.2);
    const cockpitRecoil = ctx.mechCamera.getCockpitRecoilState();

    ctx.onStateUpdate(buildGameHudState({
        alive: ctx.localRespawnState.alive,
        golemState,
        maxSpeed: ctx.golem.getMaxSpeed(),
        maxTwist: ROTATION.maxTorsoTwist,
        cameraMode: ctx.mechCamera.mode,
        aimOffsetX: aimScreenX,
        aimOffsetY: aimScreenY,
        cockpitRecoil,
        hitConfirm: ctx.hitConfirmTimer,
        hitTargetHp: ctx.hitTargetHp,
        hitTargetMaxHp: ctx.hitTargetMaxHp,
        radarContacts: buildRadarContacts({
            localPlayer: ctx.golem,
            remotePlayers: ctx.remotePlayers,
            remotePlayerStates: ctx.remotePlayerStates,
            bots: ctx.bots
        }),
        gameMode: ctx.gameMode,
        controlPoints: ctx.controlPoints.getSnapshot(),
        teamScores: ctx.teamScores,
        teamOverview: buildTeamOverview({
            localRespawnState: ctx.localRespawnState,
            remotePlayerStates: ctx.remotePlayerStates,
            bots: ctx.bots
        }),
        respawnTimer: ctx.localRespawnState.timer,
        terrainColliderMode: ctx.terrain.groundColliderMode,
        terrainColliderError: ctx.terrain.groundColliderError
    }));

    ctx.renderer.render();
}
