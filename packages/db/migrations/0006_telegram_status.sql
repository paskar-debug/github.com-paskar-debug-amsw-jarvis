-- Telegram is as critical as any other infra dependency (the whole bot runs
-- through it), so track it alongside the rest instead of leaving it invisible.

alter table integration_sync_state drop constraint integration_sync_state_source_check;
alter table integration_sync_state add constraint integration_sync_state_source_check
  check (source in ('google_calendar', 'shopify', 'supabase', 'vercel', 'railway', 'openai', 'anthropic', 'telegram'));
