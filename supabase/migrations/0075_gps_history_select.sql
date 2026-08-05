-- GPS history: agencies and venues must read all points for their shifts (audit/evidence).
-- INSERT stays restricted to active shift windows (0074). Live map filters client-side.

DROP POLICY IF EXISTS "Venues can read GPS logs for their shifts" ON public.shift_gps_log;
CREATE POLICY "Venues can read GPS logs for their shifts"
  ON public.shift_gps_log
  FOR SELECT
  TO authenticated
  USING (
    shift_id IN (
      SELECT s.id
      FROM public.shifts s
      JOIN public.bookings b ON b.id = s.booking_id
      WHERE b.venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

DROP POLICY IF EXISTS "Agencies can read GPS logs for their shifts" ON public.shift_gps_log;
CREATE POLICY "Agencies can read GPS logs for their shifts"
  ON public.shift_gps_log
  FOR SELECT
  TO authenticated
  USING (
    shift_id IN (
      SELECT s.id
      FROM public.shifts s
      JOIN public.agencies a ON a.id = s.agency_id
      WHERE a.user_id = auth.uid()
    )
    OR shift_id IN (
      SELECT s.id
      FROM public.shifts s
      JOIN public.bookings b ON b.id = s.booking_id
      JOIN public.agencies a ON a.id = b.agency_id
      WHERE a.user_id = auth.uid()
    )
  );
