-- 0054_pre_shift_absence_tracking.sql
-- Adds the data model for the pre-shift absence ring engine described in
-- docs/PRE_SHIFT_ABSENCE_ESCALATION.md.
--
-- 1) shifts.attendance_confirmed_at        — server-side accountability anchor
--    shifts.attendance_confirm_location    — guard's GPS at tap time (jsonb)
-- 2) shifts.travel_risk                    — current ring (none|R3|R4|R5|R6)
--    shifts.travel_risk_evaluated_at       — when the engine last looked
-- 3) shift_travel_risk_events              — audit trail of every flip

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS attendance_confirmed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_confirm_location jsonb,
  ADD COLUMN IF NOT EXISTS travel_risk               text,
  ADD COLUMN IF NOT EXISTS travel_risk_evaluated_at  timestamptz;

-- Constrain travel_risk to known ring values. Allow NULL so legacy rows are valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shifts_travel_risk_check'
  ) THEN
    ALTER TABLE public.shifts
      ADD CONSTRAINT shifts_travel_risk_check
      CHECK (travel_risk IS NULL OR travel_risk IN ('none','R3','R4','R5','R6'));
  END IF;
END $$;

COMMENT ON COLUMN public.shifts.attendance_confirmed_at IS
  'Server-side timestamp when the guard tapped "I''m coming" at T-2h. The accountability anchor for ring R1 in the pre-shift absence engine.';
COMMENT ON COLUMN public.shifts.attendance_confirm_location IS
  'JSON snapshot { lat, lng, accuracy_m, recorded_at } captured at the moment the guard tapped to confirm. Optional.';
COMMENT ON COLUMN public.shifts.travel_risk IS
  'Latest pre-shift ring evaluation: none | R3 (status unclear) | R4 (amber) | R5 (red) | R6 (no-show).';
COMMENT ON COLUMN public.shifts.travel_risk_evaluated_at IS
  'When the pre-shift travel risk engine last evaluated this shift.';

-- Audit trail: every time the engine writes a non-none ring we record why.
CREATE TABLE IF NOT EXISTS public.shift_travel_risk_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  personnel_id    uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  ring            text NOT NULL,
  trigger_reason  text NOT NULL,
  distance_m      integer,
  last_gps_at     timestamptz,
  minutes_to_start integer,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_travel_risk_events_ring_check
    CHECK (ring IN ('R3','R4','R5','R6','cleared'))
);

CREATE INDEX IF NOT EXISTS idx_shift_travel_risk_events_shift
  ON public.shift_travel_risk_events(shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_travel_risk_events_created
  ON public.shift_travel_risk_events(created_at DESC);

ALTER TABLE public.shift_travel_risk_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access shift travel risk events"
  ON public.shift_travel_risk_events;
CREATE POLICY "Service role full access shift travel risk events"
  ON public.shift_travel_risk_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Venues can read events for their own bookings' shifts (for MC card transparency).
DROP POLICY IF EXISTS "Venue can read travel risk events for own bookings"
  ON public.shift_travel_risk_events;
CREATE POLICY "Venue can read travel risk events for own bookings"
  ON public.shift_travel_risk_events FOR SELECT
  TO authenticated
  USING (
    shift_id IN (
      SELECT s.id FROM public.shifts s
      JOIN public.bookings b ON b.id = s.booking_id
      JOIN public.venues v ON v.id = b.venue_id
      WHERE v.user_id = auth.uid()
    )
  );

-- Personnel can read their own travel risk history (for transparency / appeals).
DROP POLICY IF EXISTS "Personnel can read own travel risk events"
  ON public.shift_travel_risk_events;
CREATE POLICY "Personnel can read own travel risk events"
  ON public.shift_travel_risk_events FOR SELECT
  TO authenticated
  USING (
    personnel_id IN (
      SELECT p.id FROM public.personnel p WHERE p.user_id = auth.uid()
    )
  );
