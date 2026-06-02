-- Audit trail when a guard releases a shift back to the board (replacement search).

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT,
  ADD COLUMN IF NOT EXISTS withdrawal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cover_search_wave INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shifts.withdrawal_reason IS 'Reason when guard released shift for cover (shift is reopened, not cancelled).';
COMMENT ON COLUMN public.shifts.withdrawal_at IS 'When guard released shift for replacement search.';
COMMENT ON COLUMN public.shifts.cover_search_wave IS 'Which broadening wave last ran for replacement notify (1, 2, …).';
