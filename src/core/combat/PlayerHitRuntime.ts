import type { MechCamera } from '../../camera/MechCamera';
import type { GolemController, GolemSection } from '../../entities/GolemController';
import type { DummyBot } from '../../entities/DummyBot';
import type { GameMode, TeamId, TeamScoreState } from '../../gameplay/types';

export type PlayerHitRuntimeContext = {
    bots: Map<string, DummyBot>;
    remotePlayers: Map<string, GolemController>;
    localPlayer: GolemController;
    mechCamera: MechCamera;
    gameMode: GameMode;
    teamScores: TeamScoreState;
    localPlayerId: string;
    getUnitTeam: (id: string) => TeamId | null;
    queueLocalRespawn: () => void;
    queueRemoteRespawn: (id: string) => void;
    scheduleRespawnWave: (team: TeamId) => void;
    confirmHitForOwner: (ownerId: string, targetHp: number, targetMaxHp: number) => void;
    registerDeath?: (team: TeamId, position: { x: number; y: number; z: number }) => void;
};

function awardTeamScore(teamScores: TeamScoreState, team: TeamId) {
    teamScores[team] = Math.min(teamScores.scoreToWin, teamScores[team] + 1);
    if (teamScores[team] >= teamScores.scoreToWin) {
        teamScores.winner = team;
    }
}

function readUnitPosition(unit: { body?: { translation?: () => { x: number; y: number; z: number } }; targetPos?: { x: number; y: number; z: number } }) {
    const livePosition = unit.body?.translation?.();
    if (livePosition) {
        return { x: livePosition.x, y: livePosition.y, z: livePosition.z };
    }
    if (unit.targetPos) {
        return { x: unit.targetPos.x, y: unit.targetPos.y, z: unit.targetPos.z };
    }
    return { x: 0, y: 0, z: 0 };
}

export function handlePlayerHit(
    context: PlayerHitRuntimeContext,
    ownerId: string,
    targetId: string,
    damage: number,
    section: GolemSection | '__bot__'
) {
    const ownerTeam = context.getUnitTeam(ownerId);
    if (targetId.startsWith('bot-')) {
        const bot = context.bots.get(targetId);
        if (!bot) return;
        const remainingHp = bot.takeDamage(damage);
        if (remainingHp <= 0) {
            context.registerDeath?.(bot.team, readUnitPosition(bot));
            context.scheduleRespawnWave(bot.team);
            if (context.gameMode === 'tdm' && ownerTeam && ownerTeam !== bot.team) {
                awardTeamScore(context.teamScores, ownerTeam);
            }
        }
        context.confirmHitForOwner(ownerId, remainingHp, bot.maxHp);
        return;
    }

    const hitSection = section === '__bot__' ? 'centerTorso' : section;

    if (targetId === context.localPlayerId) {
        const result = context.localPlayer.applySectionDamage(hitSection, damage);
        context.mechCamera.onHit(damage);
        if (result.lethal) {
            context.registerDeath?.('blue', readUnitPosition(context.localPlayer));
            context.queueLocalRespawn();
            if (context.gameMode === 'tdm' && ownerTeam && ownerTeam !== 'blue') {
                awardTeamScore(context.teamScores, ownerTeam);
            }
        }
        context.confirmHitForOwner(ownerId, result.totalHp, context.localPlayer.maxHp);
        return;
    }

    const player = context.remotePlayers.get(targetId);
    if (!player) return;
    const result = player.applySectionDamage(hitSection, damage);
    if (result.lethal) {
        context.registerDeath?.('blue', readUnitPosition(player));
        context.queueRemoteRespawn(targetId);
        if (context.gameMode === 'tdm' && ownerTeam && ownerTeam !== 'blue') {
            awardTeamScore(context.teamScores, ownerTeam);
        }
    }
    context.confirmHitForOwner(ownerId, result.totalHp, player.maxHp);
}
