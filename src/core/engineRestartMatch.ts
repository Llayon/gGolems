import type { GolemController } from '../entities/GolemController';
import type { ProjectileManager } from '../combat/ProjectileManager';
import type { ControlPointManager } from '../gameplay/ControlPointManager';
import type { MechCamera } from '../camera/MechCamera';
import type { NetworkManager } from '../network/NetworkManager';
import type { GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import type { PropManager } from '../world/PropManager';
import type { PlayerRespawnState, RemotePlayerState } from './respawn/types';
import type { DummyBot } from '../entities/DummyBot';
import { createTeamScores } from './match/MatchRuntime';
import { placeGolemAtSpawn } from './engineSpawn';

export type RestartMatchContext = {
    sessionMode: 'solo' | 'host' | 'client';
    gameMode: GameMode;
    projectiles: ProjectileManager;
    controlPoints: ControlPointManager;
    propManager: PropManager;
    mechCamera: MechCamera;
    golem: GolemController;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    bots: Map<string, DummyBot>;
    localRespawnState: PlayerRespawnState;
    setHitConfirmTimer: (v: number) => void;
    setHitTargetHp: (v: number) => void;
    setHitTargetMaxHp: (v: number) => void;
    setRecentDeaths: (v: any[]) => void;
    setTeamScores: (v: TeamScoreState) => void;
    setRespawnWaves: (v: Record<TeamId, number>) => void;
    getTeamSpawn: (team: TeamId, slot: number) => any;
    placeGolemAtSpawn: (golem: GolemController, spawn: any, yaw?: number) => void;
    setGolemPresence: (golem: GolemController, alive: boolean) => void;
    setRemotePlayerState: (id: string, patch: Partial<RemotePlayerState>) => void;
    network: NetworkManager;
    scoreToWin: Record<GameMode, number>;
};

export function restartMatch(ctx: RestartMatchContext, fromNetwork = false): boolean {
    if (ctx.sessionMode === 'client' && !fromNetwork) {
        ctx.network.sendToHost({ type: 'restartRequest' });
        return false;
    }

    ctx.projectiles.clear();
    ctx.controlPoints.reset();
    ctx.propManager.reset();
    ctx.setHitConfirmTimer(0);
    ctx.setHitTargetHp(0);
    ctx.setHitTargetMaxHp(100);
    ctx.setRecentDeaths([]);
    ctx.setTeamScores(createTeamScores(ctx.gameMode, ctx.scoreToWin));
    ctx.setRespawnWaves({ blue: 0, red: 0 });

    ctx.localRespawnState.alive = true;
    ctx.localRespawnState.timer = 0;
    ctx.localRespawnState.slot = 0;

    const localSpawn = ctx.getTeamSpawn('blue', 0);
    ctx.placeGolemAtSpawn(ctx.golem, localSpawn);

    ctx.remotePlayers.forEach((player, id) => {
        const state = ctx.remotePlayerStates.get(id);
        if (state) {
            const spawn = ctx.getTeamSpawn('blue', state.slot);
            ctx.placeGolemAtSpawn(player, spawn);
            ctx.setGolemPresence(player, true);
            ctx.setRemotePlayerState(id, { alive: true, timer: 0 });
        }
    });

    ctx.bots.forEach((bot) => { bot.mesh.visible = true; });

    ctx.network.broadcast({ type: 'restartMatch', mode: ctx.gameMode });
    ctx.mechCamera.addTrauma(1.5);

    return true;
}
