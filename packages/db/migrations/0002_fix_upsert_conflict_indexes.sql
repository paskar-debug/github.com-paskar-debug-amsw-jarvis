-- The original indexes were partial (WHERE external_id IS NOT NULL), which
-- Postgres cannot use as an ON CONFLICT target for a plain upsert. A regular
-- unique index already treats NULLs as distinct, so the partial predicate
-- wasn't needed in the first place.

drop index if exists calendar_events_source_external_id_idx;
create unique index calendar_events_source_external_id_idx
  on calendar_events (owner_id, source, external_id);

drop index if exists tasks_source_external_id_idx;
create unique index tasks_source_external_id_idx
  on tasks (owner_id, source, external_id);
