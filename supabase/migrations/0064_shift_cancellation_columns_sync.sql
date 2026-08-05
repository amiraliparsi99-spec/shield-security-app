-- 0064_shift_cancellation_columns_sync.sql
-- Syncs the live database with the shift cancellation / no-show columns that
-- 0029_shift_cancellation.sql and 20240205_add_shift_workflow_columns.sql were
-- meant to add but were never applied remotely.
--
-- The two older files also disagree on the cancelled_by CHECK values
-- ('venue','guard') vs ('venue','personnel','agency'); the codebase writes
-- 'guard', 'venue' and 'agency', so the constraint here allows all four.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by         TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_penalty BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS no_show_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_notes        TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_cancelled_by_check'
    AND conrelid = 'public.shifts'::regclass
  ) THEN
    ALTER TABLE public.shifts
    ADD CONSTRAINT shifts_cancelled_by_check
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('venue', 'guard', 'personnel', 'agency'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_cancelled
ON public.shifts(cancelled_at)
WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_cancelled_by
ON public.shifts(cancelled_by)
WHERE cancelled_by IS NOT NULL;

-- shield_score_history (from 20240205) was also never applied remotely and is
-- written to by cancellation, no-show, review and dispatcher flows.
CREATE TABLE IF NOT EXISTS public.shield_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points_change INTEGER NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shield_score_history_personnel
ON public.shield_score_history(personnel_id, created_at DESC);

ALTER TABLE public.shield_score_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Personnel can view own shield history" ON public.shield_score_history
    FOR SELECT USING (personnel_id = public.get_my_personnel_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "System can insert shield events" ON public.shield_score_history
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.shifts.cancelled_at IS 'Timestamp when the shift was cancelled';
COMMENT ON COLUMN public.shifts.cancelled_by IS 'Who initiated the cancellation: venue, guard, personnel, or agency';
COMMENT ON COLUMN public.shifts.cancellation_reason IS 'Reason provided for cancellation';
COMMENT ON COLUMN public.shifts.cancellation_penalty IS 'Whether a late cancellation penalty was applied';
COMMENT ON COLUMN public.shifts.no_show_at IS 'When the no-show was recorded';
COMMENT ON TABLE public.shield_score_history IS 'Tracks all events that affect a personnel''s Shield Score';
