-- Tracks where a task originally came from, separate from `source` (which tracks Todoist
-- sync/mirroring and gets overwritten once a suggestion is approved and pushed to Todoist).
-- Without this, approving an email-suggested task and syncing it to Todoist destroyed the one
-- signal that it came from the mail-triage pipeline, making a "mail -> forslag -> godkendt ->
-- udført" pipeline view impossible to build.
alter table tasks add column if not exists origin text;
