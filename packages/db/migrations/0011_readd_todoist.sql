-- Todoist is back (see 51e439c for its removal) - re-add it to integration_sync_state's
-- allowed sources, which was narrowed in 0006/0008 after Todoist was dropped.
alter table integration_sync_state drop constraint integration_sync_state_source_check;
alter table integration_sync_state add constraint integration_sync_state_source_check
  check (source in ('google_calendar', 'shopify', 'whoop', 'supabase', 'vercel', 'railway', 'openai', 'anthropic', 'telegram', 'todoist'));
