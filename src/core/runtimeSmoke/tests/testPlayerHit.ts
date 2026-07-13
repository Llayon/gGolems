import type { GolemController } from '../../../entities/GolemController';
import type { TeamScoreState } from '../../../gameplay/types';
import { handlePlayerHit, type PlayerHitRuntimeContext } from '../../combat/PlayerHitRuntime';
import { assert, createFakeGolem, runTest } from '../smokeHelpers';

export function runPlayerHitTest() {
    runTest('player hit runtime applies lethal remote damage and awards TDM score', () => {
        const remote = createFakeGolem({ maxHp: 40, hp: 20 });
        const scores: TeamScoreState = { blue: 0, red: 0, scoreToWin: 10, winner: null, phase: 'active', phaseTimer: 0, matchClock: 480, matchDuration: 480 };
        const queued: string[] = [];
        const confirms: Array<{ ownerId: string; hp: number; maxHp: number }> = [];

        const context: PlayerHitRuntimeContext = {
            bots: new Map(),
            remotePlayers: new Map([['remote-blue', remote as unknown as GolemController]]),
            localPlayer: createFakeGolem() as unknown as GolemController,
            mechCamera: { onHit: () => undefined } as any,
            gameMode: 'tdm',
            teamScores: scores,
            localPlayerId: 'local-player',
            getUnitTeam: (id) => id === 'enemy-red' ? 'red' : 'blue',
            queueLocalRespawn: () => queued.push('local'),
            queueRemoteRespawn: (id) => queued.push(id),
            scheduleRespawnWave: () => undefined,
            confirmHitForOwner: (ownerId, hp, maxHp) => confirms.push({ ownerId, hp, maxHp })
        };

        handlePlayerHit(context, 'enemy-red', 'remote-blue', 25, 'centerTorso');

        assert(queued.includes('remote-blue'), 'lethal remote hit should queue remote respawn');
        assert(scores.red === 1 && scores.winner === null, 'enemy team should gain one TDM score');
        assert(confirms.length === 1 && confirms[0].hp === 0, 'owner should receive lethal hit confirm');
    });
}
