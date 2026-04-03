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
