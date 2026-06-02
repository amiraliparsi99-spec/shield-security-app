-- 0056_cover_engine_columns.sql
-- Adds columns + audit table for the auto-cover engine described in
-- docs/SHIFT_COVER_ESCALATION_PLAN.md and docs/PRE_SHIFT_ABSENCE_ESCALATION.md.
--
-- 1) venues.is_rural          — bumps distance thresholds 2.5x (env-tunable)
--    venues.is_critical       — premium tier (R5 at T-20m, R6 at T+5m)
-- 2) shifts.cover_search_started_at  — when Wave 1 first fired for this shift
--    shifts.cover_search_last_wave_at — last wave bump timestamp (for cron pacing)
--    shifts.cover_unfilled_at  — set when all waves expire with no taker
-- 3) shift_cover_waves         — audit row per wave broadening (for metrics)

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_rural    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.venues.is_rural IS
  'Multiplies travel-risk distance thresholds by TRAVEL_RISK_RURAL_MULTIPLIER (default 2.5x). Use for villages and sparse-landscape venues where a 5km radius is too tight.';
COMMENT ON COLUMN public.venues.is_critical IS
  'Premium venue tier: cover sourcing fires earlier (R5 at T-20m, R6 at T+5m). Use for paying enterprise contracts that require fastest possible fill.';

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS cover_search_started_at  timestamptz,
  ADD COLUMN IF NOT EXISTS cover_search_last_wave_at timestamptz,
  ADD COLUMN IF NOT EXISTS cover_unfilled_at        timestamptz;

COMMENT ON COLUMN public.shifts.cover_search_started_at IS
  'Timestamp when Wave 1 cover offers first fired for this shift (either via guard withdrawal or auto R5/R6 escalation).';
COMMENT ON COLUMN public.shifts.cover_search_last_wave_at IS
  'When the last wave broadening ran. Used by the wave-broadening cron to know when to fire the next wave.';
COMMENT ON COLUMN public.shifts.cover_unfilled_at IS
  'Set when all cover waves have expired without a taker. UI shows the unfilled banner from this timestamp.';

CREATE TABLE IF NOT EXISTS public.shift_cover_waves (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  wave            integer NOT NULL,
  radius_miles    integer NOT NULL,
  trigger         text NOT NULL,            -- 'guard_withdrawal' | 'ring_r5' | 'ring_r6' | 'wave_expired'
  guards_notified integer NOT NULL DEFAULT 0,
  offers_created  integer NOT NULL DEFAULT 0,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_cover_waves_shift
  ON public.shift_cover_waves(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_cover_waves_created
  ON public.shift_cover_waves(created_at DESC);

ALTER TABLE public.shift_cover_waves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access shift_cover_waves" ON public.shift_cover_waves;
CREATE POLICY "Service role full access shift_cover_waves"
  ON public.shift_cover_waves FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Venue can read cover waves for own bookings" ON public.shift_cover_waves;
CREATE POLICY "Venue can read cover waves for own bookings"
  ON public.shift_cover_waves FOR SELECT
  TO authenticated
  USING (
    shift_id IN (
      SELECT s.id FROM public.shifts s
      JOIN public.bookings b ON b.id = s.booking_id
      JOIN public.venues v   ON v.id = b.venue_id
      WHERE v.user_id = auth.uid()
    )
  );
