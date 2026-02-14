-- Chat: 1:1 conversations between users (venue owners, personnel, agency owners)
-- user_id_1 < user_id_2 to keep a canonical pair and avoid duplicates

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id_1 uuid not null references auth.users(id) on delete cascade,
  user_id_2 uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self check (user_id_1 <> user_id_2),
  constraint ordered check (user_id_1 < user_id_2),
  unique(user_id_1, user_id_2)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_conversations_user_id_1 on public.conversations(user_id_1);
create index if not exists idx_conversations_user_id_2 on public.conversations(user_id_2);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(conversation_id, created_at desc);

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Conversations: user can only see and create ones they're in
create policy "Users can select own conversations"
  on public.conversations for select
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

create policy "Users can insert conversations as participant"
  on public.conversations for insert
  with check (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- Messages: user can only see messages in their conversations, and send as themselves
create policy "Users can select messages in own conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_id_1 or auth.uid() = c.user_id_2)
    )
  );

create policy "Users can insert own messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_id_1 or auth.uid() = c.user_id_2)
    )
  );

-- To enable Realtime for new messages: In Supabase Dashboard → Database → Replication,
-- add the public.messages table to the supabase_realtime publication.
