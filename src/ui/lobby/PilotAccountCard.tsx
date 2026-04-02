import type { Locale } from '../../i18n/types';
import type { TranslationKey, Translator } from '../../i18n';
import type {
    AuthUpgradeBusy,
    AuthUpgradeMessage,
    PilotAccountState
} from '../../app/pilotAccountState';

function getPilotMatchModeLabel(t: Translator, mode: string) {
    switch (mode) {
        case 'control':
            return t('lobby.mode.control');
        case 'tdm':
            return t('lobby.mode.tdm');
        default:
            return mode.toUpperCase();
    }
}

function formatPilotMatchTime(locale: Locale, timestamp: string) {
    const value = new Date(timestamp);
    if (Number.isNaN(value.getTime())) {
        return '--';
    }

    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(value);
}

type PilotAccountCardProps = {
    account: PilotAccountState;
    locale: Locale;
    authEmail: string;
    authBusy: AuthUpgradeBusy;
    authMessage: AuthUpgradeMessage | null;
    t: Translator;
    onAuthEmailChange: (value: string) => void;
    onLinkGoogle: () => void;
    onSendMagicLink: () => void;
    showTitle?: boolean;
};

export function PilotAccountCard(props: PilotAccountCardProps) {
    const statusKey: TranslationKey = props.account.status === 'ready'
        ? 'supabase.status.ready'
        : props.account.status === 'error'
            ? 'supabase.status.error'
            : props.account.status === 'disabled'
                ? 'supabase.status.disabled'
                : 'supabase.status.booting';
    const statusTone = props.account.status === 'ready'
        ? 'text-[#9de5b0]'
        : props.account.status === 'error'
            ? 'text-[#ffb09a]'
            : props.account.status === 'disabled'
                ? 'text-[#d3bc94]'
                : 'text-[#8fb8c2]';
    const shortId = props.account.userId ? props.account.userId.slice(0, 8).toUpperCase() : '--';

    return (
        <div className="rounded-xl border border-[#8f6a38]/30 bg-black/25 px-4 py-3">
            {props.showTitle !== false ? (
                <div className="text-center text-xs tracking-[0.28em] text-[#8fb8c2]">{props.t('supabase.title')}</div>
            ) : null}
            <div className={`${props.showTitle !== false ? 'mt-2 ' : ''}text-center text-[11px] tracking-[0.18em] ${statusTone}`}>
                {props.t(statusKey)}
            </div>
            {props.account.status === 'ready' ? (
                <>
                    <div className="mt-2 text-center text-[13px] font-bold tracking-[0.18em] text-[#f3deb5]">
                        {props.account.callsign}
                    </div>
                    <div className="mt-1 text-center text-[10px] tracking-[0.18em] text-[#c5b187]">
                        {props.t('supabase.profile', { idLabel: props.t('common.id'), id: shortId })}
                    </div>
                    <div className="mt-1 text-center text-[10px] tracking-[0.18em] text-[#8fb8c2]">
                        {props.t(props.account.isAnonymous ? 'supabase.guest' : 'supabase.linked')}
                    </div>
                    {props.account.email ? (
                        <div className="mt-1 text-center text-[10px] tracking-[0.14em] text-[#d7c5a1]">
                            {props.account.email}
                        </div>
                    ) : null}
                    {props.account.linkedProviders.length > 0 ? (
                        <div className="mt-1 text-center text-[10px] tracking-[0.14em] text-[#8fb8c2]">
                            {props.t('supabase.providers', {
                                providers: props.account.linkedProviders.join(' | ').toUpperCase()
                            })}
                        </div>
                    ) : null}
                    <div className="mt-2 text-center text-[10px] tracking-[0.18em] text-[#d7c5a1]">
                        {props.t('supabase.matches', {
                            played: props.account.matchesPlayed,
                            wins: props.account.matchesWon
                        })}
                    </div>
                    <div className="mt-1 text-center text-[10px] tracking-[0.18em] text-[#d7c5a1]">
                        {props.t('supabase.resources', {
                            xp: props.account.xp,
                            credits: props.account.credits
                        })}
                    </div>
                    <div className="mt-3 border-t border-[#8f6a38]/25 pt-3">
                        <div className="text-center text-[10px] tracking-[0.22em] text-[#8fb8c2]">
                            {props.t('supabase.historyTitle')}
                        </div>
                        {props.account.recentMatches.length > 0 ? (
                            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                                {props.account.recentMatches.map((match) => (
                                    <div
                                        key={match.id}
                                        className="rounded-lg border border-[#8f6a38]/25 bg-black/25 px-3 py-2 text-left"
                                    >
                                        <div className="flex items-center justify-between gap-3 text-[10px] tracking-[0.16em]">
                                            <span className="text-[#f3deb5]">
                                                {getPilotMatchModeLabel(props.t, match.mode)}
                                            </span>
                                            <span className={match.result === 'win' ? 'text-[#9de5b0]' : 'text-[#ffb09a]'}>
                                                {props.t(match.result === 'win' ? 'supabase.result.win' : 'supabase.result.loss')}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-3 text-[10px] tracking-[0.14em] text-[#b9c7c8]">
                                            <span>{match.blue_score} : {match.red_score}</span>
                                            <span>{formatPilotMatchTime(props.locale, match.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-2 text-center text-[10px] tracking-[0.14em] text-[#b9c7c8]">
                                {props.t('supabase.historyEmpty')}
                            </div>
                        )}
                    </div>
                    {props.account.isAnonymous ? (
                        <div className="mt-3 border-t border-[#8f6a38]/25 pt-3">
                            <div className="text-center text-[10px] tracking-[0.22em] text-[#8fb8c2]">
                                {props.t('supabase.upgradeTitle')}
                            </div>
                            <div className="mt-1 text-center text-[10px] tracking-[0.14em] text-[#b9c7c8]">
                                {props.t('supabase.upgradeHint')}
                            </div>
                            <button
                                type="button"
                                onClick={props.onLinkGoogle}
                                disabled={props.authBusy !== 'idle'}
                                className="mt-3 w-full rounded-full border border-[#5a7aa5]/60 bg-[#1c2a46]/45 px-4 py-2 text-[10px] font-bold tracking-[0.24em] text-[#d7e8ff] transition-colors hover:border-[#83b9ff]/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {props.authBusy === 'google' ? props.t('supabase.actions.googleBusy') : props.t('supabase.actions.google')}
                            </button>
                            <div className="mt-3 text-center text-[10px] tracking-[0.22em] text-[#8fb8c2]">
                                {props.t('supabase.actions.magic')}
                            </div>
                            <input
                                type="email"
                                value={props.authEmail}
                                onChange={(event) => props.onAuthEmailChange(event.target.value)}
                                placeholder={props.t('supabase.actions.emailPlaceholder')}
                                className="mt-2 w-full rounded border border-[#8f6a38]/40 bg-black/65 px-3 py-2 text-center text-[11px] tracking-[0.12em] text-[#f5dba8] outline-none focus:border-[#efb768]"
                            />
                            <button
                                type="button"
                                onClick={props.onSendMagicLink}
                                disabled={props.authBusy !== 'idle'}
                                className="mt-2 w-full rounded-full border border-[#8f6a38]/60 bg-black/40 px-4 py-2 text-[10px] font-bold tracking-[0.24em] text-[#f3deb5] transition-colors hover:border-[#efb768]/80 hover:text-[#fff1d4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {props.authBusy === 'magic' ? props.t('supabase.actions.magicBusy') : props.t('supabase.actions.magicSend')}
                            </button>
                        </div>
                    ) : null}
                    {props.authMessage ? (
                        <div className={`mt-3 text-center text-[10px] tracking-[0.14em] ${props.authMessage.tone === 'error' ? 'text-[#ffb09a]' : props.authMessage.tone === 'success' ? 'text-[#9de5b0]' : 'text-[#8fb8c2]'}`}>
                            {props.authMessage.text}
                        </div>
                    ) : null}
                </>
            ) : props.account.status === 'error' ? (
                <div className="mt-2 text-center text-[10px] tracking-[0.14em] text-[#ffb09a]">
                    {props.account.error}
                </div>
            ) : (
                <div className="mt-2 text-center text-[10px] tracking-[0.14em] text-[#b9c7c8]">
                    {props.t(props.account.status === 'disabled' ? 'supabase.disabledHint' : 'supabase.bootingHint')}
                </div>
            )}
        </div>
    );
}
