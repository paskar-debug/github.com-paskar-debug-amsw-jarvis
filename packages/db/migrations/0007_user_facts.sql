-- Facts the user tells the assistant about themselves ("min kone hedder X",
-- "jeg foretrækker korte svar"), so drafts/analyses can be personalized
-- without needing invasive integrations like email access.

create table if not exists user_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null default 'andet' check (category in ('familie', 'forretning', 'praeference', 'andet')),
  fact text not null,
  created_at timestamptz not null default now()
);

alter table user_facts enable row level security;

create policy "owner can manage user_facts" on user_facts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter publication supabase_realtime add table user_facts;
