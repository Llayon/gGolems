create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  callsign text not null,
  preferred_locale text not null default 'en',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_progress (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  credits integer not null default 0 check (credits >= 0),
  matches_played integer not null default 0 check (matches_played >= 0),
  matches_won integer not null default 0 check (matches_won >= 0 and matches_won <= matches_played),
  last_match_mode text,
  last_match_result text check (last_match_result in ('win', 'loss') or last_match_result is null),
  last_match_blue integer not null default 0 check (last_match_blue >= 0),
  last_match_red integer not null default 0 check (last_match_red >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  result text not null check (result in ('win', 'loss')),
  blue_score integer not null default 0 check (blue_score >= 0),
  red_score integer not null default 0 check (red_score >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists match_results_player_created_idx
on public.match_results (player_id, created_at desc);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists player_progress_touch_updated_at on public.player_progress;
create trigger player_progress_touch_updated_at
before update on public.player_progress
for each row
execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.match_results enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "player_progress_select_own" on public.player_progress;
create policy "player_progress_select_own"
on public.player_progress
for select
using (auth.uid() = player_id);

drop policy if exists "player_progress_insert_own" on public.player_progress;
create policy "player_progress_insert_own"
on public.player_progress
for insert
with check (auth.uid() = player_id);

drop policy if exists "player_progress_update_own" on public.player_progress;
create policy "player_progress_update_own"
on public.player_progress
for update
using (auth.uid() = player_id)
with check (auth.uid() = player_id);

drop policy if exists "match_results_select_own" on public.match_results;
create policy "match_results_select_own"
on public.match_results
for select
using (auth.uid() = player_id);

drop policy if exists "match_results_insert_own" on public.match_results;
create policy "match_results_insert_own"
on public.match_results
for insert
with check (auth.uid() = player_id);
