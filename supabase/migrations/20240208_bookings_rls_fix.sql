-- Fix: Allow personnel to view bookings that have shifts they can see
-- This enables guards to see event names and booking details

-- Allow personnel to view bookings where they have assigned shifts OR there are open shifts
CREATE POLICY "Personnel can view bookings with their shifts" ON public.bookings
  FOR SELECT USING (
    -- Can see if they have a shift for this booking
    EXISTS (
      SELECT 1 FROM public.shifts 
      WHERE shifts.booking_id = bookings.id 
      AND shifts.personnel_id = (
        SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1
      )
    )
    -- OR there are open shifts for this booking
    OR EXISTS (
      SELECT 1 FROM public.shifts 
      WHERE shifts.booking_id = bookings.id 
      AND shifts.personnel_id IS NULL
    )
  );

-- Also allow personnel to view venues (needed for job board)
CREATE POLICY "Personnel can view venues" ON public.venues
  FOR SELECT USING (true);  -- All authenticated users can view venues

COMMENT ON POLICY "Personnel can view bookings with their shifts" ON public.bookings 
  IS 'Allows guards to see booking details for shifts they can view';
