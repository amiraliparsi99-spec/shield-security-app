-- Live GPS uploads only while a shift is actively in progress (accepted/checked_in)
-- and within the scheduled tracking window. Once checked out or past scheduled end,
-- personnel cannot upload new points.

DROP POLICY IF EXISTS "Personnel can insert own GPS logs" ON public.shift_gps_log;
CREATE POLICY "Personnel can insert own GPS logs"
  ON public.shift_gps_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    personnel_id IN (
      SELECT p.id FROM public.personnel p WHERE p.user_id = auth.uid()
    )
    AND shift_id IN (
      SELECT s.id
      FROM public.shifts s
      WHERE s.status IN ('accepted', 'checked_in')
        AND now() >= s.scheduled_start - interval '60 minutes'
        AND now() <= s.scheduled_end + interval '2 minutes'
    )
  );

-- Venues/agencies may read GPS points recorded during the shift window (evidence),
-- but the live map only queries accepted/checked_in shifts client-side.

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
        AND shift_gps_log.recorded_at >= s.scheduled_start - interval '60 minutes'
        AND shift_gps_log.recorded_at <= s.scheduled_end + interval '2 minutes'
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
        AND shift_gps_log.recorded_at >= s.scheduled_start - interval '60 minutes'
        AND shift_gps_log.recorded_at <= s.scheduled_end + interval '2 minutes'
    )
    OR shift_id IN (
      SELECT s.id
      FROM public.shifts s
      JOIN public.bookings b ON b.id = s.booking_id
      JOIN public.agencies a ON a.id = b.agency_id
      WHERE a.user_id = auth.uid()
        AND shift_gps_log.recorded_at >= s.scheduled_start - interval '60 minutes'
        AND shift_gps_log.recorded_at <= s.scheduled_end + interval '2 minutes'
    )
  );
