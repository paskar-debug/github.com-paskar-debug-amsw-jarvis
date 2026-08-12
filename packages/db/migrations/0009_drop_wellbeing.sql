-- Manual wellbeing logging (mood/energy/sleep via /velvaere) is superseded by
-- the Whoop integration for objective recovery/sleep/strain tracking. No rows
-- existed in this table at removal time.

alter publication supabase_realtime drop table wellbeing_entries;
drop table if exists wellbeing_entries;
