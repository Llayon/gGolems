import { formatPercent, formatSeconds } from '../../i18n/format';
import type { Locale } from '../../i18n/types';
import type { ControlPointView, GameMode, TeamOverview, TeamScoreState } from '../../gameplay/types';
import type { Translator } from '../../i18n';

function getPointStatusText(points: ControlPointView[], t: Translator, locale: Locale) {
    const contestedPoint = points.find((point) => point.contested);
    if (contestedPoint) {
        return t('hud.point.contested', { point: contestedPoint.id });
    }

    const activePoint = points.find((point) => {
        const blueSecuring = point.blueInside > 0 && point.redInside === 0 && !(point.owner === 'blue' && point.capture >= 0.99);
        const redSecuring = point.redInside > 0 && point.blueInside === 0 && !(point.owner === 'red' && point.capture <= -0.99);
        return blueSecuring || redSecuring;
    });

    if (activePoint) {
        const blueSecuring = activePoint.blueInside > 0 && activePoint.redInside === 0;
        return t('hud.point.securing', {
            team: t(blueSecuring ? 'hud.team.blue' : 'hud.team.red'),
            point: activePoint.id,
            progress: formatPercent(locale, Math.abs(activePoint.capture) * 100)
        });
    }

    const blueOwned = points.filter((point) => point.owner === 'blue').length;
    const redOwned = points.filter((point) => point.owner === 'red').length;
    if (blueOwned === 0 && redOwned === 0) {
        return t('hud.point.neutral');
    }
    if (blueOwned === redOwned) {
        return t('hud.point.split', { blue: blueOwned, red: redOwned });
    }

    return t('hud.point.holding', {
        team: t(blueOwned > redOwned ? 'hud.team.blue' : 'hud.team.red'),
        count: Math.max(blueOwned, redOwned)
    });
}

function getHeldPoints(points: ControlPointView[], owner: 'blue' | 'red') {
    return points.filter((point) => point.owner === owner).length;
}

export function MatchStatusOverlay(props: {
    scores: TeamScoreState;
    points: ControlPointView[];
    teamOverview: TeamOverview;
    respawnTimer: number;
    isTouchDevice: boolean;
    locale: Locale;
    gameMode: GameMode;
    t: Translator;
    onRestart?: () => void;
    onReturnToLobby?: () => void;
}) {
    const pointTone = (point: ControlPointView) => point.contested
        ? 'border-[#b57d3c]/60 bg-[#f0b35c]/16 text-[#ffd489]'
        : point.owner === 'blue'
            ? 'border-[#3d8fb4]/60 bg-[#57bde8]/20 text-[#8ee6ff]'
            : point.owner === 'red'
                ? 'border-[#a24f39]/60 bg-[#f26b4a]/18 text-[#ffb49b]'
                : 'border-[#8f6a38]/55 bg-black/25 text-[#e6c78c]';
    const pointStatus = props.gameMode === 'control'
        ? getPointStatusText(props.points, props.t, props.locale)
        : props.t('hud.mode.tdm');
    const objectiveLabel = props.gameMode === 'control' ? props.t('hud.results.points') : props.t('hud.results.objective');
    const waveLabels = (['blue', 'red'] as const)
        .map((team) => {
            const waveTimer = props.teamOverview[team].waveTimer;
            if (waveTimer <= 0.05) return null;
            return props.t('hud.wave.team', {
                team: props.t(team === 'blue' ? 'hud.team.blue' : 'hud.team.red'),
                seconds: formatSeconds(props.locale, waveTimer)
            });
        })
        .filter(Boolean) as string[];
    const blueHeld = getHeldPoints(props.points, 'blue');
    const redHeld = getHeldPoints(props.points, 'red');

    return (
        <>
            <div
                className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2"
                style={{
                    top: props.isTouchDevice ? 'calc(env(safe-area-inset-top, 0px) + 72px)' : '58px'
                }}
            >
                <div className={`rounded-[26px] border border-[#8f6a38]/55 bg-[rgba(8,8,8,0.78)] px-4 py-2 shadow-[0_0_18px_rgba(0,0,0,0.32)] ${props.isTouchDevice ? 'min-w-[260px]' : 'min-w-[360px]'}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-center">
                            <div className="text-[9px] tracking-[0.28em] text-[#7ee6f0]">{props.t('hud.team.blue')}</div>
                            <div className="mt-0.5 text-2xl font-bold tracking-[0.14em] text-[#8ee6ff]">{props.scores.blue}</div>
                        </div>
                        {props.gameMode === 'control' ? (
                            <div className="flex items-center gap-1.5">
                                {props.points.map((point) => (
                                    <div key={point.id} className={`min-w-[42px] rounded-full border px-3 py-1 text-center text-xs font-bold tracking-[0.18em] ${pointTone(point)}`}>
                                        {point.id}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-full border border-[#8f6a38]/55 bg-black/25 px-4 py-1 text-center text-[10px] tracking-[0.24em] text-[#e6c78c]">
                                {props.t('hud.mode.tdm')}
                            </div>
                        )}
                        <div className="text-center">
                            <div className="text-[9px] tracking-[0.28em] text-[#f39f7a]">{props.t('hud.team.red')}</div>
                            <div className="mt-0.5 text-2xl font-bold tracking-[0.14em] text-[#ffb49b]">{props.scores.red}</div>
                        </div>
                    </div>
                    <div className="mt-1 text-center text-[9px] tracking-[0.24em] text-[#cbb48a]">
                        {props.t('hud.scoreTarget', { score: props.scores.scoreToWin })}
                    </div>
                    <div className="mt-1 text-center text-[10px] tracking-[0.18em] text-[#e7d3aa]">
                        {pointStatus}
                    </div>
                    {waveLabels.length > 0 ? (
                        <div className="mt-1 text-center text-[9px] tracking-[0.18em] text-[#c6d7d8]">
                            {waveLabels.join('  |  ')}
                        </div>
                    ) : null}
                </div>
            </div>

            {props.scores.winner ? (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(18,16,12,0.44),rgba(5,5,5,0.74))] px-4">
                    <div className={`w-full max-w-[560px] rounded-[28px] border bg-[rgba(10,10,10,0.88)] px-6 py-5 shadow-[0_0_28px_rgba(0,0,0,0.42)] ${props.scores.winner === 'blue' ? 'border-[#3d8fb4]/60 text-[#8ee6ff]' : 'border-[#a24f39]/60 text-[#ffb49b]'}`}>
                        <div className="text-center text-[10px] tracking-[0.34em] text-[#f0d8ab]">
                            {props.t('hud.results.title')}
                        </div>
                        <div className="mt-2 text-center text-[13px] tracking-[0.3em]">
                            {props.t(props.scores.winner === 'blue' ? 'hud.victory.blue' : 'hud.victory.red')}
                        </div>
                        <div className="mt-1 text-center text-[9px] tracking-[0.22em] text-[#f0d8ab]">
                            {props.t('hud.matchLocked')}
                        </div>
                        <div className="mt-4 grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 text-center text-[9px] tracking-[0.22em] text-[#bfa987]">
                            <div>{props.t('hud.results.team')}</div>
                            <div>{props.t('hud.results.score')}</div>
                            <div>{objectiveLabel}</div>
                            <div>{props.t('hud.results.active')}</div>
                            <div>{props.t('hud.results.wave')}</div>
                        </div>
                        <div className="mt-2 space-y-2">
                            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 rounded-2xl border border-[#3d8fb4]/40 bg-[rgba(20,44,52,0.34)] px-3 py-3 text-center text-[11px] tracking-[0.18em] text-[#d8f7ff]">
                                <div>{props.t('hud.team.blue')}</div>
                                <div>{props.scores.blue}</div>
                                <div>{props.gameMode === 'control' ? blueHeld : props.t('hud.results.none')}</div>
                                <div>{props.teamOverview.blue.alive}/{props.teamOverview.blue.total}</div>
                                <div>{props.teamOverview.blue.waveTimer > 0.05 ? formatSeconds(props.locale, props.teamOverview.blue.waveTimer) : props.t('hud.results.none')}</div>
                            </div>
                            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 rounded-2xl border border-[#a24f39]/40 bg-[rgba(48,22,18,0.34)] px-3 py-3 text-center text-[11px] tracking-[0.18em] text-[#ffe1d7]">
                                <div>{props.t('hud.team.red')}</div>
                                <div>{props.scores.red}</div>
                                <div>{props.gameMode === 'control' ? redHeld : props.t('hud.results.none')}</div>
                                <div>{props.teamOverview.red.alive}/{props.teamOverview.red.total}</div>
                                <div>{props.teamOverview.red.waveTimer > 0.05 ? formatSeconds(props.locale, props.teamOverview.red.waveTimer) : props.t('hud.results.none')}</div>
                            </div>
                        </div>
                        <div className="mt-5 flex flex-wrap justify-center gap-3">
                            <button
                                type="button"
                                onClick={props.onRestart}
                                className="pointer-events-auto rounded-full border border-[#8f6a38]/60 bg-black/40 px-5 py-3 text-[11px] font-bold tracking-[0.24em] text-[#f3deb5] transition-colors hover:border-[#efb768]/80 hover:text-[#fff1d4]"
                            >
                                {props.t('hud.results.restart')}
                            </button>
                            <button
                                type="button"
                                onClick={props.onReturnToLobby}
                                className="pointer-events-auto rounded-full border border-[#5b7f8f]/60 bg-black/35 px-5 py-3 text-[11px] font-bold tracking-[0.24em] text-[#cfe7ef] transition-colors hover:border-[#7ee6f0]/80 hover:text-[#f3fcff]"
                            >
                                {props.t('hud.results.returnToLobby')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {props.respawnTimer > 0 && !props.scores.winner ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
                    <div className="rounded-[30px] border border-[#8f6a38]/60 bg-[rgba(8,8,8,0.86)] px-8 py-5 text-center shadow-[0_0_24px_rgba(0,0,0,0.42)]">
                        <div className="text-[11px] tracking-[0.34em] text-[#efb768]">{props.t('hud.respawn')}</div>
                        <div className="mt-2 text-4xl font-bold tracking-[0.14em] text-[#f3deb5]">{Math.ceil(props.respawnTimer)}</div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
