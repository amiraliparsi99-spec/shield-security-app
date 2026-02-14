-- Fix profiles.user_id references to support both table structures
-- This migration fixes the "column profiles.user_id does not exist" error
-- 
-- Handles two profiles table structures:
-- - 0001: profiles.id = auth.users.id (no user_id column)
-- - 0003: profiles.id is separate UUID, profiles.user_id = auth.users.id

-- Drop all policies that depend on is_admin function first
drop policy if exists "Users can view own verification or admins can view all" on public.verifications;
drop policy if exists "Users can view own documents or admins can view all" on public.verification_documents;
drop policy if exists "Admins can update verifications" on public.verifications;
drop policy if exists "Admins can update verification documents" on public.verification_documents;
drop policy if exists "Admins can view admin users" on public.admin_users;
drop policy if exists "Admins can view all documents" on storage.objects;

-- Now drop the function
drop function if exists is_admin(uuid);

-- Recreate is_admin function to handle both profiles table structures
-- Uses information_schema to check if user_id column exists
create or replace function is_admin(user_id uuid)
returns boolean as $$
declare
  v_has_user_id boolean;
  v_is_admin boolean;
begin
  -- Check if user_id column exists in profiles table
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  ) into v_has_user_id;
  
  -- Check by id first (works for 0001 structure where id = auth.users.id)
  select exists (
    select 1 from public.profiles
    where id = is_admin.user_id and role = 'admin'
  ) into v_is_admin;
  
  if v_is_admin then
    return true;
  end if;
  
  -- If user_id column exists (0003 structure), also check by user_id
  if v_has_user_id then
    select exists (
      select 1 from public.profiles
      where profiles.user_id = is_admin.user_id and role = 'admin'
    ) into v_is_admin;
    
    if v_is_admin then
      return true;
    end if;
  end if;
  
  return false;
end;
$$ language plpgsql security definer;

-- Recreate all the policies that depend on is_admin
create policy "Users can view own verification or admins can view all" on public.verifications
  for select
  using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid())) or
    is_admin(auth.uid())
  );

create policy "Users can view own documents or admins can view all" on public.verification_documents
  for select
  using (
    (owner_type = 'personnel' and owner_id in (select id from public.personnel where user_id = auth.uid())) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid())) or
    is_admin(auth.uid())
  );

create policy "Admins can update verifications" on public.verifications
  for update
  using (is_admin(auth.uid()));

create policy "Admins can update verification documents" on public.verification_documents
  for update
  using (is_admin(auth.uid()));

create policy "Admins can view admin users" on public.admin_users
  for select
  using (is_admin(auth.uid()));

-- Recreate storage policy (if the bucket exists)
create policy "Admins can view all documents" on storage.objects
  for select
  using (
    bucket_id = 'verification-documents' and is_admin(auth.uid())
  );
