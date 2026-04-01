-- Migration: Add shift cancellation fields
-- Allows both venues and guards to cancel shifts with tracking

-- Add cancellation columns to shifts table
ALTER TABLE public.shifts 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('venue', 'guard')),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_penalty BOOLEAN DEFAULT FALSE;

-- Add 'cancelled' to the status check constraint if not already present
-- First, we need to drop the existing constraint and recreate it
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shifts_status_check' 
    AND conrelid = 'public.shifts'::regclass
  ) THEN
    ALTER TABLE public.shifts DROP CONSTRAINT shifts_status_check;
  END IF;
  
  -- Add the new constraint with 'cancelled' status
  ALTER TABLE public.shifts 
  ADD CONSTRAINT shifts_status_check 
  CHECK (status IN ('pending', 'accepted', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show'));
EXCEPTION
  WHEN others THEN
    -- If constraint doesn't exist or can't be modified, just continue
    RAISE NOTICE 'Could not modify status constraint: %', SQLERRM;
END $$;

-- Create index for cancelled shifts (for reporting)
CREATE INDEX IF NOT EXISTS idx_shifts_cancelled 
ON public.shifts(cancelled_at) 
WHERE cancelled_at IS NOT NULL;

-- Create index for finding shifts by cancellation type
CREATE INDEX IF NOT EXISTS idx_shifts_cancelled_by 
ON public.shifts(cancelled_by) 
WHERE cancelled_by IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN public.shifts.cancelled_at IS 'Timestamp when the shift was cancelled';
COMMENT ON COLUMN public.shifts.cancelled_by IS 'Who cancelled the shift: venue or guard';
COMMENT ON COLUMN public.shifts.cancellation_reason IS 'Reason provided for cancellation';
COMMENT ON COLUMN public.shifts.cancellation_penalty IS 'Whether a late cancellation penalty was applied';
