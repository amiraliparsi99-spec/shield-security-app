-- Admin Role Support
-- Adds 'admin' as a valid role and sets up admin access

-- Update profiles table to allow 'admin' role
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check 
  check (role in ('venue', 'personnel', 'agency', 'admin'));

-- Create admin_users table for tracking admin permissions (optional, for future use)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  permissions text[] default '{}', -- e.g., ['verify_users', 'manage_content', 'view_analytics']
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  notes text
);

create index idx_admin_users_user on public.admin_users (user_id);

-- RLS for admin_users
alter table public.admin_users enable row level security;

-- Only admins can view admin_users
create policy "Admins can view admin users" on public.admin_users
  for select
  using (
    exists (
      select 1 from public.profiles
      where (id = auth.uid() OR user_id = auth.uid()) and role = 'admin'
    )
  );

-- Function to check if user is admin
-- Handles both profiles table structures: id = auth.users.id OR user_id = auth.users.id
create or replace function is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where (id = is_admin.user_id OR user_id = is_admin.user_id)
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Update RLS policies to allow admins to view all verifications
drop policy if exists "Users can view own verification" on public.verifications;
create policy "Users can view own verification or admins can view all" on public.verifications
  for select
  using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid())) or
    is_admin(auth.uid())
  );

-- Update RLS policies to allow admins to view all documents
drop policy if exists "Users can view own documents" on public.verification_documents;
create policy "Users can view own documents or admins can view all" on public.verification_documents
  for select
  using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid())) or
    is_admin(auth.uid())
  );

-- Allow admins to update verifications
create policy "Admins can update verifications" on public.verifications
  for update
  using (is_admin(auth.uid()));

-- Allow admins to update verification documents
create policy "Admins can update verification documents" on public.verification_documents
  for update
  using (is_admin(auth.uid()));

-- Comments
comment on function is_admin is 'Check if a user has admin role';
comment on table public.admin_users is 'Additional admin permissions and metadata';
