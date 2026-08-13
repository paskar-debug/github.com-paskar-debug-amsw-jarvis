-- Conversation memory for the dashboard assistant. Stored so the assistant's replies can be
-- continuous across sessions - deliberately never read back into the dashboard UI itself
-- (someone glancing at an already-logged-in screen should not be able to browse past chats).

create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_owner_created_idx
  on assistant_messages (owner_id, created_at);

alter table assistant_messages enable row level security;

create policy "owner can manage assistant_messages" on assistant_messages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
