-- Allow venues to view personnel who have claimed shifts on their bookings
-- This is needed for the venue to see guard info on their bookings page

-- First, check if policy exists and drop it
DROP POLICY IF EXISTS "Venues can view personnel assigned to their bookings" ON public.personnel;

-- Create policy: venues can see personnel who are assigned to shifts on their bookings
CREATE POLICY "Venues can view personnel assigned to their bookings"
ON public.personnel
FOR SELECT
USING (
  -- Allow if this personnel is assigned to a shift on a booking that belongs to a venue owned by the current user
  EXISTS (
    SELECT 1 
    FROM public.shifts s
    JOIN public.bookings b ON s.booking_id = b.id
    JOIN public.venues v ON b.venue_id = v.id
    WHERE s.personnel_id = personnel.id
    AND v.user_id = auth.uid()
  )
);

-- Also allow personnel to view other personnel (for team features)
DROP POLICY IF EXISTS "Personnel can view other personnel" ON public.personnel;

CREATE POLICY "Personnel can view other personnel"
ON public.personnel
FOR SELECT
USING (
  -- Allow authenticated users to view personnel profiles
  auth.role() = 'authenticated'
);
