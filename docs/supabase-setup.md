# Supabase bootstrap

> Status: Operational guide  
> Scope: Setup for the optional Supabase pilot account and progression layer.

This repo now contains a minimal Supabase integration for:

- anonymous guest sign-in
- pilot profile bootstrap
- player progress bootstrap
- lightweight match result persistence
- optional Edge Function path for server-side match updates

Firebase still handles the public room browser. Supabase is intended to become the long-lived account/progression/social layer.

## 1. Create a Supabase project

In the Supabase dashboard:

1. Create a new project.
2. Open `Project Settings -> API`.
3. Copy:
   - `Project URL`
   - `anon public key`

## 2. Enable anonymous sign-ins

Open `Authentication -> Providers` and enable `Anonymous`.

This integration uses anonymous auth for the MVP flow, so the game can create a durable guest account on first launch without blocking the user behind a full registration screen.

## 3. Configure upgrade providers

If you want guest pilots to upgrade into permanent accounts:

1. Open `Authentication -> Sign In / Providers`.
2. Enable `Google`.
3. Fill the Google OAuth client ID / secret in Supabase.
4. Enable `Manual Linking`.

Manual linking is required because the game upgrades the current anonymous pilot by linking Google to the existing user instead of creating a second account.

Email Magic Link is enabled by default in Supabase Auth, so no extra provider toggle is usually needed for that path.

## 4. Configure redirect URLs

Open `Authentication -> URL Configuration`.

Set:

- `Site URL` to your primary app URL
- allowed redirect URLs for every environment that should complete auth flows

For this repo that usually means:

- local dev: `http://localhost:3000/**`
- GitHub Pages: `https://llayon.github.io/gGolems/**`

Both Google linking and Magic Link upgrades redirect the user back into the game after the auth step completes.

## 5. Apply the SQL bootstrap

Run the SQL from [supabase-bootstrap.sql](./supabase-bootstrap.sql) in the Supabase SQL editor.

It creates:

- `public.profiles`
- `public.player_progress`
- `public.match_results`
- basic RLS policies so each player can only read/write their own rows

If your project was already bootstrapped before match history landed in the repo, rerun the SQL script once so `match_results` is added.

## 6. Fill the environment variables

Add these values to `.env.local`:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

The app will silently fall back to `disabled` mode if these are missing.

## 7. Deploy the `finish-match` Edge Function

The repo now includes a server-side match progression function at:

- [`supabase/functions/finish-match/index.ts`](../supabase/functions/finish-match/index.ts)

The frontend will try to invoke this function first when a match ends. If the function is not deployed yet, it falls back to the current direct client write so the game keeps working.

To deploy it:

1. Install and log into the Supabase CLI.
2. From the repo root, run:

```bash
supabase functions deploy finish-match --project-ref YOUR_PROJECT_REF
```

The function uses the built-in Supabase function environment and does not require extra custom secrets for this MVP path.

## 8. Runtime behavior

When Supabase is configured:

- the lobby boots a guest session automatically
- a `profiles` row is upserted
- a `player_progress` row is upserted
- the latest match results are stored in `match_results`
- the lobby shows a short recent battle history
- match progression first tries the `finish-match` Edge Function
- guest pilots can be upgraded with Google linking
- guest pilots can request an email Magic Link upgrade
- locale preference is synced to Supabase
- match completion writes a small stats/progression update

If Supabase is not configured:

- the rest of the game still works
- Firebase-backed lobby behavior remains unchanged

## Notes

- Until `finish-match` is deployed, match progression still falls back to client-trusted writes.
- Even with `finish-match`, the reported match result is still client-reported. This is better separation, but not a cheat-proof authoritative backend yet.
- The current schema is intentionally small so it can evolve into clans, Telegram linking, loadouts, and inventory later.
