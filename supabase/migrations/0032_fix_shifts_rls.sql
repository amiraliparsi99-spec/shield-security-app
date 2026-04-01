-- Fix RLS policies for shifts table to ensure venues can read their booking shifts

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Venues can view booking shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can view their booking shifts" ON public.shifts;
DROP POLICY IF EXISTS "Venues can manage booking shifts" ON public.shifts;

-- Create a simpler, more direct policy for venues to view shifts
CREATE POLICY "Venues can view their shifts" ON public.shifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.venues v ON b.venue_id = v.id
      WHERE b.id = shifts.booking_id
      AND v.user_id = auth.uid()
    )
  );

-- Allow venues to update shifts for their bookings
CREATE POLICY "Venues can update their shifts" ON public.shifts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.venues v ON b.venue_id = v.id
      WHERE b.id = shifts.booking_id
      AND v.user_id = auth.uid()
    )
  );

-- Ensure personnel can also read shifts they're assigned to
DROP POLICY IF EXISTS "Personnel can view own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can view available shifts" ON public.shifts;

CREATE POLICY "Personnel can view their shifts" ON public.shifts
  FOR SELECT USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
    OR personnel_id IS NULL  -- Open shifts visible to all personnel
  );

-- Personnel can update their own shifts (for check-in/out)
DROP POLICY IF EXISTS "Personnel can update their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Personnel can update own shifts" ON public.shifts;

CREATE POLICY "Personnel can update their shifts" ON public.shifts
  FOR UPDATE USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

-- Personnel can claim open shifts
DROP POLICY IF EXISTS "Personnel can claim open shifts" ON public.shifts;

CREATE POLICY "Personnel can claim open shifts" ON public.shifts
  FOR UPDATE USING (
    personnel_id IS NULL
  )
  WITH CHECK (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );
