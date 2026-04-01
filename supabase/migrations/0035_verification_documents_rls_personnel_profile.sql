-- Fix verification_documents RLS so personnel can insert/update when
-- personnel.user_id is either auth.uid() (legacy) or profiles.id (profile-linked).
-- The app sets personnel.user_id to the profile id, so auth.uid() check alone fails.

-- Helper: personnel id the current user owns (personnel.user_id = auth.uid() or personnel.user_id = profile.id with profile.user_id = auth.uid())
create or replace function public.get_my_personnel_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.id from public.personnel p
  left join public.profiles pr on pr.id = p.user_id and pr.user_id = auth.uid()
  where p.user_id = auth.uid() or pr.id is not null
  limit 1;
$$;

-- Drop existing user-facing policies
drop policy if exists "Users can insert own documents" on public.verification_documents;
drop policy if exists "Users can update own documents" on public.verification_documents;
drop policy if exists "Users can view own documents or admins can view all" on public.verification_documents;

-- Insert: allow when owner_id is current user's personnel (via get_my_personnel_id) or agency
create policy "Users can insert own documents" on public.verification_documents
  for insert with check (
    (owner_type = 'personnel' and owner_id = public.get_my_personnel_id()) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid()))
  );

-- Update: same
create policy "Users can update own documents" on public.verification_documents
  for update using (
    (owner_type = 'personnel' and owner_id = public.get_my_personnel_id()) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid()))
  );

-- Select: allow own personnel docs (via helper) or agency or admin
create policy "Users can view own documents or admins can view all" on public.verification_documents
  for select using (
    (owner_type = 'personnel' and owner_id = public.get_my_personnel_id()) or
    (owner_type = 'agency' and owner_id in (select id from public.agencies where owner_id = auth.uid())) or
    is_admin()
  );
