-- Agency Shifts Integration
-- Links booking_assignments to the main shifts table

-- Add shift_id to booking_assignments to link agency assignments to shifts
ALTER TABLE public.booking_assignments 
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_booking_assignments_shift 
ON public.booking_assignments(shift_id) WHERE shift_id IS NOT NULL;

-- Add agency_id to shifts if not exists (for tracking which agency assigned the shift)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shifts' 
    AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE public.shifts ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add agency_commission to shifts if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shifts' 
    AND column_name = 'agency_commission'
  ) THEN
    ALTER TABLE public.shifts ADD COLUMN agency_commission NUMERIC(10,2);
  END IF;
END $$;

-- Create index for agency shift queries
CREATE INDEX IF NOT EXISTS idx_shifts_agency 
ON public.shifts(agency_id) WHERE agency_id IS NOT NULL;

-- Function to sync shift status to booking_assignment status
CREATE OR REPLACE FUNCTION public.sync_shift_to_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the corresponding booking_assignment status when shift status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.booking_assignments
    SET status = CASE
      WHEN NEW.status = 'accepted' THEN 'confirmed'
      WHEN NEW.status IN ('cancelled', 'declined') THEN 'declined'
      WHEN NEW.status = 'checked_out' THEN 'completed'
      WHEN NEW.status = 'no_show' THEN 'no_show'
      ELSE status
    END
    WHERE shift_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync statuses
DROP TRIGGER IF EXISTS sync_shift_assignment_status ON public.shifts;
CREATE TRIGGER sync_shift_assignment_status
  AFTER UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shift_to_assignment();

-- View for agency dashboard showing their staff's shifts
CREATE OR REPLACE VIEW public.agency_staff_shifts AS
SELECT 
  s.id as shift_id,
  s.booking_id,
  s.personnel_id,
  s.agency_id,
  s.role,
  s.hourly_rate,
  s.scheduled_start,
  s.scheduled_end,
  s.actual_start,
  s.actual_end,
  s.status,
  s.hours_worked,
  s.total_pay,
  s.agency_commission,
  p.display_name as personnel_name,
  p.shield_score,
  b.event_name,
  v.name as venue_name,
  v.city as venue_city,
  ba.id as assignment_id,
  ba.status as assignment_status
FROM public.shifts s
JOIN public.personnel p ON s.personnel_id = p.id
JOIN public.bookings b ON s.booking_id = b.id
JOIN public.venues v ON b.venue_id = v.id
LEFT JOIN public.booking_assignments ba ON ba.shift_id = s.id
WHERE s.agency_id IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.agency_staff_shifts TO authenticated;

COMMENT ON VIEW public.agency_staff_shifts IS 'Combined view of agency staff shifts with assignment info';
COMMENT ON COLUMN public.shifts.agency_id IS 'The agency that assigned this shift (if applicable)';
COMMENT ON COLUMN public.booking_assignments.shift_id IS 'Links to the shift created for this assignment';
