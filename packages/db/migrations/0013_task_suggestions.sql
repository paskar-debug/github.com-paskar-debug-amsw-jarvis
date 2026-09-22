-- Lets the bot propose a task from an incoming email instead of creating it outright - it sits as
-- 'suggested' (excluded from every normal task view/count) until the owner approves or rejects it
-- via Telegram. 'email' is a distinct source so approval/rejection logic and future auditing can
-- tell these apart from tasks the owner typed themselves.
alter table tasks drop constraint tasks_status_check;
alter table tasks add constraint tasks_status_check check (status in ('todo', 'in_progress', 'done', 'cancelled', 'suggested'));

alter table tasks drop constraint tasks_source_check;
alter table tasks add constraint tasks_source_check check (source in ('manual', 'telegram', 'todoist', 'email'));
