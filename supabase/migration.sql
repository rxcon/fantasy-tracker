-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- for your project before starting the app.

create table if not exists public.user_leagues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('sleeper', 'espn')),
  league_id text not null,
  league_name text,
  sleeper_username text,
  sleeper_user_id text,
  espn_swid text,
  espn_s2 text,
  season text not null default '2026',
  created_at timestamptz not null default now()
);

-- One row per person per league per season, so re-adding the same
-- league doesn't create duplicate cards.
create unique index if not exists user_leagues_unique_entry
  on public.user_leagues (user_id, platform, league_id, season);

alter table public.user_leagues enable row level security;

drop policy if exists "Users can view their own leagues" on public.user_leagues;
create policy "Users can view their own leagues"
  on public.user_leagues for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own leagues" on public.user_leagues;
create policy "Users can insert their own leagues"
  on public.user_leagues for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own leagues" on public.user_leagues;
create policy "Users can update their own leagues"
  on public.user_leagues for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own leagues" on public.user_leagues;
create policy "Users can delete their own leagues"
  on public.user_leagues for delete
  using (auth.uid() = user_id);
