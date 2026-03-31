# Supabase bootstrap

This repo now contains a minimal Supabase integration for:

- anonymous guest sign-in
- pilot profile bootstrap
- player progress bootstrap
- lightweight match result persistence

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

## 3. Apply the SQL bootstrap

Run the SQL from [supabase-bootstrap.sql](./supabase-bootstrap.sql) in the Supabase SQL editor.

It creates:

- `public.profiles`
- `public.player_progress`
- basic RLS policies so each player can only read/write their own rows

## 4. Fill the environment variables

Add these values to `.env.local`:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

The app will silently fall back to `disabled` mode if these are missing.

## 5. Runtime behavior

When Supabase is configured:

- the lobby boots a guest session automatically
- a `profiles` row is upserted
- a `player_progress` row is upserted
- locale preference is synced to Supabase
- match completion writes a small stats/progression update

If Supabase is not configured:

- the rest of the game still works
- Firebase-backed lobby behavior remains unchanged

## Notes

- Match progression in this MVP is still client-trusted.
- For competitive progression, move final result validation to a server-side function before updating XP/currency.
- The current schema is intentionally small so it can evolve into clans, Telegram linking, loadouts, and inventory later.
