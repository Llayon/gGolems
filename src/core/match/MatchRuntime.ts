import type { DummyBot } from '../../entities/DummyBot';
import type { GolemController } from '../../entities/GolemController';
import type { ControlPointManager, ControlUnitPresence } from '../../gameplay/ControlPointManager';
import type { GameMode, TeamId, TeamOverview, TeamScoreState } from '../../gameplay/types';
import type { NetworkPosition } from '../network/playerSnapshots';
import type { PlayerRespawnState, RemotePlayerState, RespawnSessionMode } from '../respawn/types';

export type MatchControlRuntimeContext = {
    controlPoints: ControlPointManager;
    teamScores: TeamScoreState;
    localPlayer: GolemController;
    localRespawnState: PlayerRespawnState;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    bots: Map<string, DummyBot>;
};

export type MatchRestartContext = {
    sessionMode: RespawnSessionMode;
    gameMode: GameMode;
    scoreToWinByMode: Record<GameMode, number>;
    projectiles: { clear: () => void };
    controlPoints: { reset: () => void };
    propManager: { reset: () => void };
    resetHitConfirm: () => void;
    setTeamScores: (scores: TeamScoreState) => void;
    setRespawnWaves: (waves: Record<TeamId, number>) => void;
    localRespawnState: PlayerRespawnState;
    localPlayer: GolemController;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    remoteSpawnSlots: Map<string, number>;
    bots: Map<string, DummyBot>;
    getTeamSpawn: (team: TeamId, slot: number) => NetworkPosition;
    placeGolemAtSpawn: (golem: GolemController, spawn: NetworkPosition) => void;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
    sendRespawn: (id: string, payload: { x: number; y: number; z: number; yaw: number; slot: number }) => void;
    getSpawnYaw: (spawn: NetworkPosition) => number;
    broadcastRestart: () => void;
    addCameraTrauma: (amount: number) => void;
};

function resetGolemForMatchRestart(
    golem: GolemController,
    spawn: NetworkPosition,
    context: Pick<MatchRestartContext, 'placeGolemAtSpawn' | 'setGolemPresence'>
) {
    context.placeGolemAtSpawn(golem, spawn);
    golem.steam = golem.maxSteam;
    golem.isOverheated = false;
    golem.overheatTimer = 0;
    golem.throttle = 0;
    context.setGolemPresence(golem, true);
}

export function createTeamScores(
    mode: GameMode,
    scoreToWinByMode: Record<GameMode, number>
): TeamScoreState {
    return {
        blue: 0,
        red: 0,
        scoreToWin: scoreToWinByMode[mode],
        winner: null
    };
}

export function applyGameModeSettings(
    controlPoints: ControlPointManager,
    teamScores: TeamScoreState,
    mode: GameMode,
    scoreToWinByMode: Record<GameMode, number>
) {
    teamScores.scoreToWin = scoreToWinByMode[mode];
    controlPoints.setVisible(mode === 'control');
}

export function buildTeamOverview(context: Pick<MatchControlRuntimeContext, 'localRespawnState' | 'remotePlayerStates' | 'bots'>): TeamOverview {
    let blueAlive = context.localRespawnState.alive ? 1 : 0;
    let blueTotal = 1;
    let blueWave = context.localRespawnState.alive ? 0 : context.localRespawnState.timer;
    let redAlive = 0;
    let redTotal = 0;
    let redWave = 0;

    for (const state of context.remotePlayerStates.values()) {
        if (state.team === 'blue') {
            blueTotal += 1;
            if (state.alive) blueAlive += 1;
            else blueWave = Math.max(blueWave, state.timer);
        } else if (state.team === 'red') {
            redTotal += 1;
            if (state.alive) redAlive += 1;
            else redWave = Math.max(redWave, state.timer);
        }
    }

    for (const bot of context.bots.values()) {
        if (bot.team === 'blue') {
            blueTotal += 1;
            if (bot.alive) blueAlive += 1;
            else blueWave = Math.max(blueWave, bot.respawnTimer);
        } else {
            redTotal += 1;
            if (bot.alive) redAlive += 1;
            else redWave = Math.max(redWave, bot.respawnTimer);
        }
    }

    return {
        blue: {
            alive: blueAlive,
            total: blueTotal,
            waveTimer: blueWave
        },
        red: {
            alive: redAlive,
            total: redTotal,
            waveTimer: redWave
        }
    };
}

export function collectControlUnits(context: MatchControlRuntimeContext): ControlUnitPresence[] {
    const units: ControlUnitPresence[] = [];
    const localPos = context.localPlayer.body.translation();
    units.push({
        team: 'blue',
        position: { x: localPos.x, y: localPos.y, z: localPos.z },
        alive: context.localRespawnState.alive
    });

    context.remotePlayers.forEach((player, id) => {
        const state = context.remotePlayerStates.get(id);
        const pos = player.body.translation();
        units.push({
            team: 'blue',
            position: { x: pos.x, y: pos.y, z: pos.z },
            alive: state ? state.alive : true
        });
    });

    for (const bot of context.bots.values()) {
        const pos = bot.body.translation();
        units.push({
            team: bot.team,
            position: { x: pos.x, y: pos.y, z: pos.z },
            alive: bot.alive
        });
    }

    return units;
}

export function updateControlMatch(context: MatchControlRuntimeContext, dt: number) {
    context.controlPoints.update(dt, collectControlUnits(context));
    if (context.teamScores.winner) return;

    const scoreDelta = context.controlPoints.tickScore(dt);
    context.teamScores.blue += scoreDelta.blue;
    context.teamScores.red += scoreDelta.red;

    if (context.teamScores.blue >= context.teamScores.scoreToWin) {
        context.teamScores.blue = context.teamScores.scoreToWin;
        context.teamScores.winner = 'blue';
    } else if (context.teamScores.red >= context.teamScores.scoreToWin) {
        context.teamScores.red = context.teamScores.scoreToWin;
        context.teamScores.winner = 'red';
    }
}

export function restartMatchSession(context: MatchRestartContext) {
    context.projectiles.clear();
    context.resetHitConfirm();
    context.setTeamScores(createTeamScores(context.gameMode, context.scoreToWinByMode));
    context.setRespawnWaves({ blue: 0, red: 0 });
    context.controlPoints.reset();
    context.propManager.reset();

    context.localRespawnState.alive = true;
    context.localRespawnState.timer = 0;
    resetGolemForMatchRestart(
        context.localPlayer,
        context.getTeamSpawn('blue', context.localRespawnState.slot),
        context
    );

    for (const [id, player] of context.remotePlayers) {
        const state = context.remotePlayerStates.get(id) ?? {
            alive: true,
            timer: 0,
            slot: context.remoteSpawnSlots.get(id) ?? 1,
            team: 'blue' as TeamId
        };
        const spawn = context.getTeamSpawn(state.team, state.slot);
        resetGolemForMatchRestart(player, spawn, context);
        context.setRemotePlayerState(id, { alive: true, timer: 0, slot: state.slot, team: state.team });

        if (context.sessionMode === 'host') {
            context.sendRespawn(id, {
                x: spawn.x,
                y: spawn.y,
                z: spawn.z,
                yaw: context.getSpawnYaw(spawn),
                slot: state.slot
            });
        }
    }

    for (const [id, bot] of context.bots) {
        const slot = Number(id.split('-').pop() ?? 0) || 0;
        const spawn = context.getTeamSpawn(bot.team, slot);
        bot.respawnAt(spawn);
    }

    context.addCameraTrauma(0.8);

    if (context.sessionMode === 'host') {
        context.broadcastRestart();
    }
}
