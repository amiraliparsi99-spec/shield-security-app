-- ============================================================
-- Deploy missing RLS helper functions
-- These were defined in 0034 but never applied to the database
-- ============================================================

-- Get single venue id for current user
CREATE OR REPLACE FUNCTION public.get_my_venue_id()
RETURNS UUID AS $$
  SELECT id FROM public.venues WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Get booking IDs where current user's personnel has shifts assigned
CREATE OR REPLACE FUNCTION public.get_my_assigned_booking_ids()
RETURNS SETOF UUID AS $$
  SELECT s.booking_id FROM public.shifts s
  INNER JOIN public.personnel p ON p.id = s.personnel_id AND p.user_id = auth.uid()
  WHERE s.booking_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Get agency ID for current user
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS UUID AS $$
  SELECT id FROM public.agencies WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Booking IDs where current user's agency has shifts
CREATE OR REPLACE FUNCTION public.get_my_agency_booking_ids()
RETURNS SETOF UUID AS $$
  SELECT s.booking_id FROM public.shifts s
  INNER JOIN public.agencies a ON a.id = s.agency_id AND a.user_id = auth.uid()
  WHERE s.booking_id IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Bookings that have open/unclaimed shifts (for job board)
CREATE OR REPLACE FUNCTION public.get_bookings_with_open_shifts()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT booking_id
  FROM public.shifts
  WHERE personnel_id IS NULL
    AND status = 'pending';
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_my_venue_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_booking_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_booking_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bookings_with_open_shifts() TO authenticated;

-- Ensure bookings RLS policies reference these functions
DROP POLICY IF EXISTS "Bookings select personnel" ON public.bookings;
CREATE POLICY "Bookings select personnel" ON public.bookings FOR SELECT
  USING (id IN (SELECT public.get_my_assigned_booking_ids()));

DROP POLICY IF EXISTS "Bookings select open shifts" ON public.bookings;
CREATE POLICY "Bookings select open shifts" ON public.bookings FOR SELECT
  USING (id IN (SELECT public.get_bookings_with_open_shifts()));
