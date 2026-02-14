-- Fix RLS Infinite Recursion on Bookings Table
-- The issue: policies on bookings reference venues, which reference profiles, creating a loop

-- Step 1: Create helper functions that bypass RLS to check ownership
-- These use SECURITY DEFINER to run with the function owner's privileges

-- Check if current user owns a venue
CREATE OR REPLACE FUNCTION public.is_venue_owner(venue_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venues 
    WHERE id = venue_uuid 
    AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is personnel assigned to a booking
CREATE OR REPLACE FUNCTION public.is_booking_personnel(booking_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shifts s
    JOIN public.personnel p ON s.personnel_id = p.id
    WHERE s.booking_id = booking_uuid 
    AND p.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is the agency provider for a booking
CREATE OR REPLACE FUNCTION public.is_booking_agency(booking_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.agencies a ON b.provider_id = a.id
    WHERE b.id = booking_uuid 
    AND b.provider_type = 'agency'
    AND a.owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's profile ID
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's venue IDs
CREATE OR REPLACE FUNCTION public.get_my_venue_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM public.venues WHERE owner_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's personnel ID
CREATE OR REPLACE FUNCTION public.get_my_personnel_id()
RETURNS UUID AS $$
  SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's agency ID
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS UUID AS $$
  SELECT id FROM public.agencies WHERE owner_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Drop existing problematic policies on bookings
DROP POLICY IF EXISTS "Venues can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Venues can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Personnel can view assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agencies can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can manage bookings" ON public.bookings;

-- Step 3: Create new non-recursive policies using the helper functions

-- Venues can view their own bookings
CREATE POLICY "Venues can view their bookings" ON public.bookings
  FOR SELECT USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

-- Venues can create bookings for their venues
CREATE POLICY "Venues can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

-- Venues can update their bookings
CREATE POLICY "Venues can update their bookings" ON public.bookings
  FOR UPDATE USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

-- Personnel can view bookings they're assigned to
CREATE POLICY "Personnel can view assigned bookings" ON public.bookings
  FOR SELECT USING (
    public.is_booking_personnel(id)
  );

-- Agencies can view bookings where they're the provider
CREATE POLICY "Agencies can view provider bookings" ON public.bookings
  FOR SELECT USING (
    provider_type = 'agency' AND provider_id = public.get_my_agency_id()
  );

-- Agencies can update bookings where they're the provider
CREATE POLICY "Agencies can update provider bookings" ON public.bookings
  FOR UPDATE USING (
    provider_type = 'agency' AND provider_id = public.get_my_agency_id()
  );

-- Step 4: Fix shifts table policies similarly
DROP POLICY IF EXISTS "Users can view shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can manage shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can manage shifts" ON public.shifts;

-- Personnel can view shifts assigned to them or unassigned shifts
CREATE POLICY "Personnel can view available shifts" ON public.shifts
  FOR SELECT USING (
    personnel_id IS NULL 
    OR personnel_id = public.get_my_personnel_id()
  );

-- Personnel can accept/update their shifts
CREATE POLICY "Personnel can update their shifts" ON public.shifts
  FOR UPDATE USING (
    personnel_id = public.get_my_personnel_id()
  );

-- Venues can view and manage shifts for their bookings
CREATE POLICY "Venues can view booking shifts" ON public.shifts
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings WHERE venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

CREATE POLICY "Venues can manage booking shifts" ON public.shifts
  FOR ALL USING (
    booking_id IN (
      SELECT id FROM public.bookings WHERE venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

-- Step 5: Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_venue_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_personnel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_agency(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_venue_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_personnel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_id() TO authenticated;

-- Step 6: Enable RLS on tables (if not already enabled)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

COMMENT ON FUNCTION public.is_venue_owner IS 'Check if current user owns a venue - bypasses RLS to prevent recursion';
COMMENT ON FUNCTION public.get_my_venue_ids IS 'Get venue IDs owned by current user - bypasses RLS to prevent recursion';
