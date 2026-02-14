-- Fix RLS Policies to Allow Users to Create Their Own Personnel/Agency Records
-- Run this in Supabase SQL Editor

-- Allow users to insert their own personnel record
DROP POLICY IF EXISTS "Users can insert own personnel" ON public.personnel;
CREATE POLICY "Users can insert own personnel"
ON public.personnel
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT id FROM public.profiles WHERE (profiles.user_id)::text = auth.uid()::text
  )
);

-- Allow users to view their own personnel record
DROP POLICY IF EXISTS "Users can view own personnel" ON public.personnel;
CREATE POLICY "Users can view own personnel"
ON public.personnel
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT id FROM public.profiles WHERE (profiles.user_id)::text = auth.uid()::text
  )
);

-- Allow users to update their own personnel record
DROP POLICY IF EXISTS "Users can update own personnel" ON public.personnel;
CREATE POLICY "Users can update own personnel"
ON public.personnel
FOR UPDATE
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT id FROM public.profiles WHERE (profiles.user_id)::text = auth.uid()::text
  )
);

-- Allow users to insert their own agency record (agencies use owner_id, not user_id)
DROP POLICY IF EXISTS "Users can insert own agency" ON public.agencies;
CREATE POLICY "Users can insert own agency"
ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT id FROM public.profiles WHERE (profiles.user_id)::text = auth.uid()::text
  )
);

-- Allow users to view their own agency record
DROP POLICY IF EXISTS "Users can view own agency" ON public.agencies;
CREATE POLICY "Users can view own agency"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT id FROM public.profiles WHERE (profiles.user_id)::text = auth.uid()::text
  )
);

-- Allow users to update their own agency record
DROP POLICY IF EXISTS "Users can update own agency" ON public.agencies;
CREATE POLICY "Users can update own agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  owner_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT id FROM public.profiles WHERE (profiles.user_id)::text = auth.uid()::text
  )
);
