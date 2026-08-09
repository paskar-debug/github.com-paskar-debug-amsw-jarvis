-- Extend integration_sync_state to also track the health/plan of the
-- platforms AMSW Jarvis runs on (Supabase, Vercel, Railway, OpenAI,
-- Anthropic), alongside the existing business-data integrations
-- (Google Calendar, Shopify). `category` distinguishes the two groups
-- so the dashboard can show them together but labelled separately.

alter table integration_sync_state drop constraint integration_sync_state_source_check;
alter table integration_sync_state add constraint integration_sync_state_source_check
  check (source in ('google_calendar', 'shopify', 'supabase', 'vercel', 'railway', 'openai', 'anthropic'));

alter table integration_sync_state
  add column if not exists category text not null default 'integration' check (category in ('integration', 'infrastructure')),
  add column if not exists plan text,
  add column if not exists detail jsonb not null default '{}'::jsonb;
