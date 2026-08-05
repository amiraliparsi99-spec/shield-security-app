-- Mobile tracking treats assigned-but-not-yet-checked-in shifts as trackable
-- (status pending + personnel_id, or accepted/checked_in). Migration 0074 only
-- allowed accepted/checked_in, which blocked GPS uploads for offered shifts.

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
      WHERE s.personnel_id = shift_gps_log.personnel_id
        AND s.status IN ('pending', 'accepted', 'checked_in')
        AND now() >= s.scheduled_start - interval '60 minutes'
        AND now() <= s.scheduled_end + interval '2 minutes'
    )
  );
