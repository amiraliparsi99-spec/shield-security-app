-- Agencies could not see live guard GPS on /d/agency/live — only venues had SELECT on shift_gps_log.

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
