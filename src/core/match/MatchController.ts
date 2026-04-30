import type { GameMode, TeamScoreState } from '../../gameplay/types';

export function applyGameModeSettings(
    controlPoints: { setVisible: (visible: boolean) => void },
    teamScores: TeamScoreState,
    mode: GameMode,
    scoreToWin: Record<GameMode, number>
) {
    controlPoints.setVisible(mode === 'control');
    teamScores.scoreToWin = scoreToWin[mode];
    teamScores.winner = null;
    teamScores.blue = 0;
    teamScores.red = 0;
}
