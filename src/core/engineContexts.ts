import * as THREE from 'three';
import type { GolemController } from '../entities/GolemController';
import type { Arena, ArenaLaneNodeKind, ArenaLaneNodeSide } from '../world/Arena';
import type { ControlPointManager } from '../gameplay/ControlPointManager';
import type { GameMode, TeamId, TeamScoreState } from '../gameplay/types';
import type { UnitLocatorContext } from './combat/UnitLocator';
import type { BotObjectiveContext } from './bots/BotObjectiveSystem';
import type { SpawnSystemContext } from './respawn/SpawnSystem';
import type { PlayerRespawnState, RemotePlayerState } from './respawn/types';

export type ContextSources = {
    golem: GolemController;
    bots: Map<string, any>;
    remotePlayers: Map<string, GolemController>;
    remotePlayerStates: Map<string, RemotePlayerState>;
    localRespawnState: PlayerRespawnState;
    world: Arena;
    controlPoints: ControlPointManager;
    recentDeaths: any[];
    gameMode: GameMode;
    teamScores: TeamScoreState;
    getLocalUnitId: () => string;
    getNearestEnemyTarget: (team: TeamId, from: THREE.Vector3, maxDistance?: number) => THREE.Vector3 | null;
    getNearestLaneId: (pos: THREE.Vector3) => 'A' | 'B' | 'C';
};

export function getUnitLocatorContext(s: ContextSources): UnitLocatorContext {
    return {
        localPlayer: {
            id: s.getLocalUnitId(),
            body: s.golem.body,
            team: 'blue',
            alive: s.localRespawnState.alive
        },
        remotePlayers: new Map([...s.remotePlayers.entries()].map(([id, p]) => [id, {
            id,
            body: p.body,
            team: 'blue' as TeamId,
            alive: s.remotePlayerStates.get(id)?.alive ?? true
        }])),
        remotePlayerStates: s.remotePlayerStates,
        bots: new Map([...s.bots.entries()].map(([id, b]) => [id, {
            id,
            body: b.body,
            team: b.team,
            alive: b.alive
        }])),
        localUnitId: s.getLocalUnitId()
    };
}

export function getBotObjectiveContext(s: ContextSources): BotObjectiveContext {
    return {
        gameMode: s.gameMode,
        teamScores: s.teamScores,
        controlPoints: s.controlPoints.points,
        getLaneNode: (pointId: string, kind: ArenaLaneNodeKind, team: TeamId, side: ArenaLaneNodeSide | 'center') =>
            s.world.getLaneNode(pointId as 'A' | 'B' | 'C', kind, team, side as ArenaLaneNodeSide),
        getNearestLaneId: (pos: THREE.Vector3) => s.getNearestLaneId(pos),
        getNearestEnemyTarget: (team: TeamId, from: THREE.Vector3, maxDist?: number) => s.getNearestEnemyTarget(team, from, maxDist)
    };
}
