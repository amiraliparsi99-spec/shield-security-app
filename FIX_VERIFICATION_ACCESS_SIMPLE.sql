-- Fix RLS Policies - Simplified Version
-- Run this in Supabase SQL Editor

-- Allow users to insert their own personnel record
DROP POLICY IF EXISTS "Users can insert own personnel" ON public.personnel;
CREATE POLICY "Users can insert own personnel"
ON public.personnel
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  user_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to view their own personnel record
DROP POLICY IF EXISTS "Users can view own personnel" ON public.personnel;
CREATE POLICY "Users can view own personnel"
ON public.personnel
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  user_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to update their own personnel record
DROP POLICY IF EXISTS "Users can update own personnel" ON public.personnel;
CREATE POLICY "Users can update own personnel"
ON public.personnel
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  user_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to insert their own agency record
DROP POLICY IF EXISTS "Users can insert own agency" ON public.agencies;
CREATE POLICY "Users can insert own agency"
ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid() OR
  owner_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to view their own agency record
DROP POLICY IF EXISTS "Users can view own agency" ON public.agencies;
CREATE POLICY "Users can view own agency"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() OR
  owner_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);

-- Allow users to update their own agency record
DROP POLICY IF EXISTS "Users can update own agency" ON public.agencies;
CREATE POLICY "Users can update own agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid() OR
  owner_id IN (SELECT id FROM public.profiles WHERE id = auth.uid())
);
