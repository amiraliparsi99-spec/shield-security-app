-- Community: posts (showcase experience) and connections (connect with others, LinkedIn-style)

-- Posts: author_id is auth user; content is free text
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_posts_author on public.community_posts(author_id);
create index if not exists idx_community_posts_created_at on public.community_posts(created_at desc);

-- Connections: symmetric follow/connect (user_id and connected_user_id; we store both directions or one and derive)
-- For simplicity: (user_id, connected_user_id) means user_id connected with connected_user_id.
-- To avoid dupes: store with lower uid first, or use a single row per pair. We use one row per directed link
-- so "A connected with B" and "B connected with A" can be two rows, or we enforce one row per unordered pair.
-- We'll use one row per pair with user_id < connected_user_id (like conversations).
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_connection check (user_id <> connected_user_id),
  constraint ordered_connection check (user_id < connected_user_id),
  unique(user_id, connected_user_id)
);

create index if not exists idx_connections_user on public.connections(user_id);
create index if not exists idx_connections_connected on public.connections(connected_user_id);

-- RLS community_posts: anyone signed-in can read; only author can insert own
alter table public.community_posts enable row level security;

create policy "Anyone can select community posts"
  on public.community_posts for select
  to authenticated
  using (true);

create policy "Users can insert own posts"
  on public.community_posts for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "Users can delete own posts"
  on public.community_posts for delete
  to authenticated
  using (author_id = auth.uid());

-- RLS connections: users can see their own connections and add new ones
alter table public.connections enable row level security;

create policy "Users can select own connections"
  on public.connections for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = connected_user_id);

create policy "Users can insert connections as user_id"
  on public.connections for insert
  to authenticated
  with check (auth.uid() = user_id);
