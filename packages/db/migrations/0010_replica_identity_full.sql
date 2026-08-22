-- Realtime's per-user filter (owner_id=eq.<uid>) is evaluated against a DELETE's OLD
-- row. Under the default replica identity, that old row only carries primary-key
-- columns, so owner_id is missing and the filter silently fails to match - deletes
-- never reach the client, and the dashboard only reflects them after a manual reload.
-- FULL includes every column, letting the filter evaluate correctly.
alter table tasks replica identity full;
alter table calendar_events replica identity full;
alter table amsw_status replica identity full;
alter table goals replica identity full;
alter table drafts replica identity full;
alter table user_facts replica identity full;
alter table integration_sync_state replica identity full;
