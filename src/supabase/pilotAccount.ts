import type { Locale } from '../i18n/types';
import { getSupabaseStatus } from './client';
import { ensurePilotSessionUser, loadPilotAuthSnapshot } from './auth';
import { ensurePilotProfile } from './profile';
import { ensurePilotProgress, loadRecentMatchResults } from './progression';
import type { PilotAccountSnapshot } from './types';

export async function bootstrapPilotAccount(locale: Locale): Promise<PilotAccountSnapshot | null> {
    if (!getSupabaseStatus().enabled) {
        return null;
    }

    const user = await ensurePilotSessionUser();
    const auth = await loadPilotAuthSnapshot(user);
    const suggestedCallsign = typeof user.user_metadata?.callsign === 'string'
        ? user.user_metadata.callsign
        : undefined;
    const profile = await ensurePilotProfile(auth.userId, locale, suggestedCallsign);
    const progress = await ensurePilotProgress(auth.userId);
    const recentMatches = await loadRecentMatchResults(auth.userId);

    return {
        auth,
        profile,
        progress,
        recentMatches
    };
}
