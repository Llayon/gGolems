import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import type { PilotAuthSnapshot } from './types';
import { describeError } from './utils';

function getAnonymousFlag(user: User) {
    return Boolean(
        (user as User & { is_anonymous?: boolean }).is_anonymous
        || user.app_metadata?.provider === 'anonymous'
    );
}

function getAuthRedirectUrl() {
    if (typeof window === 'undefined') {
        return undefined;
    }
    return `${window.location.origin}${window.location.pathname}`;
}

export async function ensurePilotSessionUser() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
        throw new Error(describeError(sessionError, 'Failed to load Supabase session.'));
    }

    if (sessionData.session?.user) {
        return sessionData.session.user;
    }

    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
        throw new Error(describeError(error, 'Failed to create Supabase guest session.'));
    }

    return data.user;
}

export async function loadPilotAuthSnapshot(user: User): Promise<PilotAuthSnapshot> {
    const client = getSupabaseClient();
    if (!client) {
        return {
            userId: user.id,
            isAnonymous: getAnonymousFlag(user),
            email: user.email ?? null,
            linkedProviders: []
        };
    }

    const { data } = await client.auth.getUserIdentities();
    const identities = data?.identities ?? user.identities ?? [];
    const emailIdentity = identities.find((identity) => identity.provider === 'email');
    const email = typeof emailIdentity?.identity_data?.email === 'string'
        ? emailIdentity.identity_data.email
        : user.email ?? null;
    const linkedProviders = Array.from(new Set(
        identities
            .map((identity) => identity.provider)
            .filter((provider): provider is string => typeof provider === 'string' && provider !== 'anonymous')
    ));

    return {
        userId: user.id,
        isAnonymous: getAnonymousFlag(user),
        email,
        linkedProviders
    };
}

export async function linkPilotGoogleIdentity() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const { error } = await client.auth.linkIdentity({
        provider: 'google',
        options: {
            redirectTo: getAuthRedirectUrl()
        }
    });

    if (error) {
        throw new Error(describeError(error, 'Failed to start Google account linking.'));
    }
}

export async function sendPilotMagicLinkUpgrade(email: string) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
        throw new Error('Email is required.');
    }

    const { error } = await client.auth.updateUser({
        email: normalizedEmail
    }, {
        emailRedirectTo: getAuthRedirectUrl()
    });

    if (error) {
        throw new Error(describeError(error, 'Failed to send Magic Link upgrade email.'));
    }
}

export function subscribePilotAuthChanges(onChange: () => void) {
    const client = getSupabaseClient();
    if (!client) {
        return () => {};
    }

    const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED') {
            return;
        }
        onChange();
    });

    return () => {
        data.subscription.unsubscribe();
    };
}
