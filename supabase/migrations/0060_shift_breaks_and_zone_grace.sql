-- 0060_shift_breaks_and_zone_grace.sql
-- Temporary-absence handling so a guard who steps out (e.g. a food run) isn't
-- falsely flagged as abandoning the post — while still being paid.
--
-- 1) shifts.zone_left_at — when the guard was first seen outside the geofence
--    (set by the breach cron, cleared on re-entry). Drives a grace window so
--    brief absences never alert the venue.
-- 2) shift_breaks — explicit "stepped out / on break" periods the guard logs
--    from the app. An open row (ended_at IS NULL) = currently on break, which
--    suppresses breach alerts and shows the venue an "On break" status.
--
-- Pay is unaffected: breaks/absences do not change hours_worked or total_pay.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS zone_left_at timestamptz;

COMMENT ON COLUMN public.shifts.zone_left_at IS
  'When the guard was first detected outside the on-site geofence during the shift (cleared on re-entry). Used for the breach grace window.';

CREATE TABLE IF NOT EXISTS public.shift_breaks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  personnel_id  uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_breaks_shift ON public.shift_breaks(shift_id);
-- At most one open break per shift.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_breaks_open
  ON public.shift_breaks(shift_id) WHERE ended_at IS NULL;

ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shift breaks service role" ON public.shift_breaks;
DROP POLICY IF EXISTS "Shift breaks guard insert" ON public.shift_breaks;
DROP POLICY IF EXISTS "Shift breaks guard update" ON public.shift_breaks;
DROP POLICY IF EXISTS "Shift breaks guard read"   ON public.shift_breaks;
DROP POLICY IF EXISTS "Shift breaks venue read"   ON public.shift_breaks;
DROP POLICY IF EXISTS "Shift breaks agency read"  ON public.shift_breaks;

CREATE POLICY "Shift breaks service role" ON public.shift_breaks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Guard manages their own breaks.
CREATE POLICY "Shift breaks guard insert" ON public.shift_breaks
  FOR INSERT TO authenticated
  WITH CHECK (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

CREATE POLICY "Shift breaks guard update" ON public.shift_breaks
  FOR UPDATE TO authenticated
  USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

CREATE POLICY "Shift breaks guard read" ON public.shift_breaks
  FOR SELECT TO authenticated
  USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

-- Venue reads breaks for its bookings.
CREATE POLICY "Shift breaks venue read" ON public.shift_breaks
  FOR SELECT TO authenticated
  USING (
    shift_id IN (
      SELECT s.id FROM public.shifts s
      JOIN public.bookings b ON b.id = s.booking_id
      WHERE b.venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

-- Agency reads breaks for shifts it provides (via shifts.agency_id).
CREATE POLICY "Shift breaks agency read" ON public.shift_breaks
  FOR SELECT TO authenticated
  USING (
    shift_id IN (
      SELECT s.id FROM public.shifts s
      JOIN public.agencies a ON a.id = s.agency_id
      WHERE a.user_id = auth.uid()
    )
  );
