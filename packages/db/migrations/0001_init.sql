-- AMSW Jarvis - initial schema
-- Single-user personal system: every row belongs to owner_id (a Supabase auth user id).
-- The bot writes with the service-role key (bypasses RLS) and must set owner_id explicitly.
-- The dashboard reads with the anon key while logged in via Supabase Auth; RLS restricts
-- every row to the logged-in user.

create extension if not exists "pgcrypto";

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'p4' check (priority in ('p1', 'p2', 'p3', 'p4')),
  due_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'telegram', 'todoist')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tasks_source_external_id_idx
  on tasks (owner_id, source, external_id) where external_id is not null;

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual', 'google')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists calendar_events_source_external_id_idx
  on calendar_events (owner_id, source, external_id) where external_id is not null;

create table if not exists amsw_status (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  area text not null,
  state text not null check (state in ('green', 'yellow', 'red')),
  note text,
  metrics jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category text,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wellbeing_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  mood smallint not null check (mood between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  sleep_hours numeric(4, 1),
  note text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists integration_sync_state (
  owner_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('google_calendar', 'todoist', 'shopify')),
  last_synced_at timestamptz,
  cursor text,
  primary key (owner_id, source)
);

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger calendar_events_set_updated_at before update on calendar_events
  for each row execute function set_updated_at();
create trigger goals_set_updated_at before update on goals
  for each row execute function set_updated_at();

-- Row level security: every table is scoped to owner_id = auth.uid().
-- The service-role key used by the bot bypasses RLS entirely.
alter table tasks enable row level security;
alter table calendar_events enable row level security;
alter table amsw_status enable row level security;
alter table goals enable row level security;
alter table wellbeing_entries enable row level security;
alter table integration_sync_state enable row level security;

create policy "owner can manage tasks" on tasks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner can manage calendar_events" on calendar_events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner can manage amsw_status" on amsw_status
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner can manage goals" on goals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner can manage wellbeing_entries" on wellbeing_entries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner can manage integration_sync_state" on integration_sync_state
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Realtime: let the dashboard subscribe to changes on these tables.
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table calendar_events;
alter publication supabase_realtime add table amsw_status;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table wellbeing_entries;
