-- Add new columns for complete shift workflow support
-- This migration adds fields for cancellation and no-show tracking

-- Add cancellation tracking columns to shifts table
ALTER TABLE public.shifts 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT NULL CHECK (cancelled_by IN ('venue', 'personnel', 'agency')),
ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS no_show_notes TEXT DEFAULT NULL;

-- Create index for efficient shift status queries
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_booking_status ON public.shifts(booking_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_personnel_status ON public.shifts(personnel_id, status) WHERE personnel_id IS NOT NULL;

-- Create shield_score_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shield_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points_change INTEGER NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for shield score history queries
CREATE INDEX IF NOT EXISTS idx_shield_score_history_personnel 
ON public.shield_score_history(personnel_id, created_at DESC);

-- Enable RLS on shield_score_history
ALTER TABLE public.shield_score_history ENABLE ROW LEVEL SECURITY;

-- Personnel can view their own shield score history
CREATE POLICY "Personnel can view own shield history" ON public.shield_score_history
  FOR SELECT USING (
    personnel_id = public.get_my_personnel_id()
  );

-- System/admin can insert shield score events
CREATE POLICY "System can insert shield events" ON public.shield_score_history
  FOR INSERT WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.shield_score_history IS 'Tracks all events that affect a personnel''s Shield Score';
COMMENT ON COLUMN public.shifts.cancelled_by IS 'Who initiated the cancellation: venue, personnel, or agency';
COMMENT ON COLUMN public.shifts.no_show_at IS 'When the no-show was recorded';
