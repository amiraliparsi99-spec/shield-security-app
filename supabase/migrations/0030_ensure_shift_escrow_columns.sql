-- Idempotent: ensure shift escrow / dispute columns exist (0027 may already have applied)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS venue_confirmed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS venue_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.shifts.venue_confirmed IS 'Venue confirmed shift completion; enables guard payout release';
