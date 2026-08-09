-- Track the last sync error per integration (separate from last_synced_at,
-- which stays as "last successful sync") so the dashboard can show a health
-- box, and make the table live-updatable.

alter table integration_sync_state add column if not exists last_error text;
alter table integration_sync_state add column if not exists last_error_at timestamptz;

alter publication supabase_realtime add table integration_sync_state;
