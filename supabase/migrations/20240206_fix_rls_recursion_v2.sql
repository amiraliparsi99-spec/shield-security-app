-- Fix infinite recursion in bookings RLS policy
-- The previous get_my_venue_ids() function was too complex and caused recursion

-- Step 1: Drop the problematic policies first
DROP POLICY IF EXISTS "Venues can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can update their bookings" ON public.bookings;

-- Step 2: Create a simple, non-recursive function
-- This function uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.get_my_venue_ids()
RETURNS SETOF UUID AS $$
  -- Simple direct query - venues table uses user_id column
  SELECT id FROM public.venues WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Step 3: Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_my_venue_ids() TO authenticated;

-- Step 4: Create simple, non-recursive policies
-- These policies directly check venue ownership without complex subqueries

CREATE POLICY "Venues can view their bookings" ON public.bookings
  FOR SELECT USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

CREATE POLICY "Venues can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

CREATE POLICY "Venues can update their bookings" ON public.bookings
  FOR UPDATE USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

-- Step 5: Also ensure personnel and agencies can still view bookings they're assigned to
-- These should already exist but let's make sure they're not causing issues

DROP POLICY IF EXISTS "Personnel can view assigned bookings" ON public.bookings;
CREATE POLICY "Personnel can view assigned bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shifts s 
      WHERE s.booking_id = id 
      AND s.personnel_id IN (
        SELECT p.id FROM public.personnel p WHERE p.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Agencies can view provider bookings" ON public.bookings;
CREATE POLICY "Agencies can view provider bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shifts s 
      WHERE s.booking_id = id 
      AND s.agency_id IN (
        SELECT a.id FROM public.agencies a WHERE a.user_id = auth.uid()
      )
    )
  );
