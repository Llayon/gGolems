import type { ControlOwner, GameMode, MatchPhase, TeamScoreState } from '../../gameplay/types';

export const PREGAME_DURATION = 5;
export const OVERTIME_DURATION = 120;

export const MATCH_DURATION: Record<GameMode, number> = {
    control: 600,
    tdm: 480
};

export function createInitialMatchPhaseState(mode: GameMode): {
    phase: MatchPhase;
    phaseTimer: number;
    matchClock: number;
    matchDuration: number;
} {
    const duration = MATCH_DURATION[mode] ?? 600;
    return {
        phase: 'pregame',
        phaseTimer: PREGAME_DURATION,
        matchClock: duration,
        matchDuration: duration
    };
}

export function resetMatchPhaseState(
    scores: TeamScoreState,
    mode: GameMode
): void {
    scores.winner = null;
    scores.blue = 0;
    scores.red = 0;
    const initial = createInitialMatchPhaseState(mode);
    scores.phase = initial.phase;
    scores.phaseTimer = initial.phaseTimer;
    scores.matchClock = initial.matchClock;
    scores.matchDuration = initial.matchDuration;
}

function declareWinner(scores: TeamScoreState): ControlOwner | null {
    if (scores.blue > scores.red) return 'blue';
    if (scores.red > scores.blue) return 'red';
    return null;
}

export function tickMatchPhase(scores: TeamScoreState, dt: number): void {
    if (scores.phase === 'ended') return;

    if (scores.phase === 'pregame') {
        scores.phaseTimer = Math.max(0, scores.phaseTimer - dt);
        if (scores.phaseTimer <= 0) {
            scores.phase = 'active';
        }
        return;
    }

    if (scores.phase === 'active') {
        scores.matchClock = Math.max(0, scores.matchClock - dt);

        if (scores.winner) {
            scores.phase = 'ended';
            return;
        }

        if (scores.matchClock <= 0) {
            const winner = declareWinner(scores);
            if (winner) {
                scores.winner = winner;
                scores.phase = 'ended';
            } else {
                scores.phase = 'overtime';
                scores.matchClock = OVERTIME_DURATION;
            }
        }
        return;
    }

    if (scores.phase === 'overtime') {
        scores.matchClock = Math.max(0, scores.matchClock - dt);
        if (scores.winner) {
            scores.phase = 'ended';
            return;
        }
        if (scores.matchClock <= 0) {
            const winner = declareWinner(scores);
            scores.winner = winner;
            scores.phase = 'ended';
        }
    }
}

export function isMatchFrozenForInput(scores: TeamScoreState): boolean {
    return scores.phase === 'pregame' || scores.phase === 'ended';
}

export function isMatchScoringActive(scores: TeamScoreState): boolean {
    return scores.phase === 'active' || scores.phase === 'overtime';
}