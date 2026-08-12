-- Whoop OAuth refresh tokens rotate on every use (the old one is invalidated
-- immediately), so they need dedicated, always-current storage - unlike
-- Google's long-lived refresh token, this can't just live in .env.

create table if not exists whoop_auth (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table whoop_auth enable row level security;

create policy "owner can manage whoop_auth" on whoop_auth
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Whoop joins Google Calendar and Shopify as a business/personal-data integration.
alter table integration_sync_state drop constraint integration_sync_state_source_check;
alter table integration_sync_state add constraint integration_sync_state_source_check
  check (source in ('google_calendar', 'shopify', 'whoop', 'supabase', 'vercel', 'railway', 'openai', 'anthropic', 'telegram'));
