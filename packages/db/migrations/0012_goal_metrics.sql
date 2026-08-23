-- Lets a goal optionally auto-track a live metric instead of needing manual /maal_fremgang
-- updates. metric_key names which computed value drives it (see apps/bot/src/goalsAutoUpdate.ts);
-- metric_target is that value's threshold, in the metric's own unit.
alter table goals add column if not exists metric_key text;
alter table goals add column if not exists metric_target numeric;
