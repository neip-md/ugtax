-- UGtax auth + persistence schema
-- Run this in your neip Supabase project (SQL Editor, or `supabase db push`).
--
-- Creates:
--   public.profiles  — one row per user, holds the saved company config
--   public.filings   — saved annual-statement snapshots (year + results)
-- Both are protected by row-level security so a user can only ever see and
-- mutate their own rows.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  company_config jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- filings
-- ---------------------------------------------------------------------------
create table if not exists public.filings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  fiscal_year  int not null,
  company_name text,
  results      jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists filings_user_year_idx
  on public.filings (user_id, fiscal_year desc, created_at desc);

alter table public.filings enable row level security;

drop policy if exists "filings_select_own" on public.filings;
create policy "filings_select_own" on public.filings
  for select using ((select auth.uid()) = user_id);

drop policy if exists "filings_insert_own" on public.filings;
create policy "filings_insert_own" on public.filings
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "filings_delete_own" on public.filings;
create policy "filings_delete_own" on public.filings
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- keep profiles.updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auto-create a profile row when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
