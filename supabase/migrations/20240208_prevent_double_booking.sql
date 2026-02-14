-- Prevent Double Booking: Database-level protection
-- This ensures only ONE guard can claim a shift, even if two click at the exact same time

-- Create a function that safely claims a shift (atomic operation)
CREATE OR REPLACE FUNCTION public.claim_shift(
  p_shift_id UUID,
  p_personnel_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_current_personnel_id UUID;
  v_booking_id UUID;
BEGIN
  -- Lock the row and check if it's still available
  SELECT personnel_id, booking_id INTO v_current_personnel_id, v_booking_id
  FROM public.shifts
  WHERE id = p_shift_id
  FOR UPDATE;  -- This locks the row!
  
  -- If already claimed, return error
  IF v_current_personnel_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CLAIMED',
      'message', 'Sorry, this shift was just claimed by someone else!'
    );
  END IF;
  
  -- Claim the shift
  UPDATE public.shifts
  SET 
    personnel_id = p_personnel_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = p_shift_id;
  
  -- Update booking status to confirmed
  UPDATE public.bookings
  SET status = 'confirmed'
  WHERE id = v_booking_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Shift claimed successfully!',
    'booking_id', v_booking_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_shift(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.claim_shift IS 'Atomically claim a shift - prevents double booking';
