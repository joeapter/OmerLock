-- ─── Extensions ──────────────────────────────────────────────────────────────
-- pg_cron  : schedules the hourly reminder job
-- pg_net   : lets the cron job call the Edge Function via HTTP
-- Both are available on all Supabase projects (enable in Dashboard → Database → Extensions if needed)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ─── Existing tables ──────────────────────────────────────────────────────────
create table if not exists public.omer_events (
  id text primary key,
  cycle_key text not null,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.omer_state (
  cycle_key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.omer_events enable row level security;
alter table public.omer_state enable row level security;

drop policy if exists "allow anonymous writes for demo" on public.omer_events;
create policy "allow anonymous writes for demo"
on public.omer_events
for all
to anon
using (true)
with check (true);

drop policy if exists "allow anonymous writes for demo state" on public.omer_state;
create policy "allow anonymous writes for demo state"
on public.omer_state
for all
to anon
using (true)
with check (true);

-- ─── Push tokens ─────────────────────────────────────────────────────────────
-- One row per device (keyed by Expo push token).
-- The device writes its own tzeit_utc (computed from user's location — UTC),
-- so the server never needs to know the user's timezone.
-- The server only does: tzeit_utc <= now() AND counted = false.
create table if not exists public.push_tokens (
  token       text        primary key,          -- Expo push token
  tzeit_utc   timestamptz not null,             -- tonight's nightfall, in UTC (from device)
  counted     boolean     not null default false,
  active_day  integer     not null,             -- which omer night (1–49)
  cycle_key   text        not null,
  updated_at  timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

-- Anon devices can upsert their own row and read nothing else.
-- The edge function uses the service role key and bypasses RLS entirely.
drop policy if exists "devices can upsert own token" on public.push_tokens;
create policy "devices can upsert own token"
on public.push_tokens
for all
to anon
using (true)
with check (true);

-- ─── Cron job ────────────────────────────────────────────────────────────────
-- Fires every hour at :00. Calls the Edge Function which does the actual work.
-- Replace the URL if your project ref changes.
-- The anon key is intentionally public (it's safe to commit).

-- Remove any previous version of this job before recreating.
select cron.unschedule(jobid)
from cron.job
where jobname = 'omer-hourly-push';

select cron.schedule(
  'omer-hourly-push',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://vhebjdkxiyrqpkwuczbn.supabase.co/functions/v1/send-omer-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZWJqZGt4aXlycXBrd3VjemJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDQwMzUsImV4cCI6MjA4OTQyMDAzNX0.CLVNv6Yl2avvoVijUpXo0Nn0Pxcko8r-0FaqX3fs0EY"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
