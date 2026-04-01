-- Payment Escrow System
-- Holds venue payments until shift is confirmed, then releases to guards
-- Protects both parties: guards get paid, venues only pay for completed work

-- =====================================================
-- 0. CREATE HELPER FUNCTIONS (if not exists)
-- =====================================================

-- Helper function to get current user's personnel ID
CREATE OR REPLACE FUNCTION public.get_my_personnel_id()
RETURNS UUID AS $$
  SELECT id FROM public.personnel WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get current user's venue IDs
CREATE OR REPLACE FUNCTION public.get_my_venue_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM public.venues WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- 1. CREATE SHIFT_PAYMENTS TABLE (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shift_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  
  -- Amounts in pence/cents
  gross_amount INTEGER NOT NULL DEFAULT 0,
  platform_fee INTEGER NOT NULL DEFAULT 0,
  agency_commission INTEGER,
  personnel_net INTEGER NOT NULL DEFAULT 0,
  
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'awaiting_payment', 'processing', 'succeeded', 'failed', 'refunded'
  )),
  
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shift_payments
CREATE INDEX IF NOT EXISTS idx_shift_payments_shift ON public.shift_payments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_payments_venue_status ON public.shift_payments(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_payments_personnel ON public.shift_payments(personnel_id, created_at DESC);

-- Enable RLS on shift_payments
ALTER TABLE public.shift_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_payments (drop if exists first to avoid errors)
DROP POLICY IF EXISTS "Venues can view their shift payments" ON public.shift_payments;
CREATE POLICY "Venues can view their shift payments" ON public.shift_payments
  FOR SELECT USING (
    venue_id IN (SELECT id FROM public.venues WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Personnel can view their payments" ON public.shift_payments;
CREATE POLICY "Personnel can view their payments" ON public.shift_payments
  FOR SELECT USING (
    personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "System can manage shift payments" ON public.shift_payments;
CREATE POLICY "System can manage shift payments" ON public.shift_payments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 2. ADD ESCROW COLUMNS TO SHIFT_PAYMENTS
-- =====================================================

-- Add escrow-specific columns to shift_payments
ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending';

-- Add check constraint separately (to handle if column already exists)
DO $$
BEGIN
  ALTER TABLE public.shift_payments 
  DROP CONSTRAINT IF EXISTS shift_payments_escrow_status_check;
  
  ALTER TABLE public.shift_payments 
  ADD CONSTRAINT shift_payments_escrow_status_check 
  CHECK (escrow_status IN (
    'pending',
    'funds_held',
    'pending_confirmation',
    'confirmed',
    'disputed',
    'released',
    'refunded'
  ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS venue_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS auto_confirm_at TIMESTAMPTZ;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS payout_initiated_at TIMESTAMPTZ;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS dispute_raised_at TIMESTAMPTZ;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;

ALTER TABLE public.shift_payments 
ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

-- =====================================================
-- 2. ADD PAYMENT STATUS TO BOOKINGS
-- =====================================================

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
  CHECK (payment_status IN (
    'unpaid',            -- No payment received
    'partial',           -- Some shifts paid
    'paid',              -- All shifts paid (funds held)
    'released',          -- All funds released to guards
    'refunded'           -- Booking cancelled, refunded
  ));

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS total_paid INTEGER DEFAULT 0;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- =====================================================
-- 3. ADD CONFIRMATION STATUS TO SHIFTS
-- =====================================================

ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS venue_confirmed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS venue_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS dispute_status TEXT
  CHECK (dispute_status IS NULL OR dispute_status IN (
    'none',
    'raised',
    'under_review',
    'resolved_for_venue',
    'resolved_for_guard'
  ));

-- =====================================================
-- 4. CREATE ESCROW TRANSACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  shift_payment_id UUID REFERENCES public.shift_payments(id) ON DELETE SET NULL,
  
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'venue_payment',     -- Venue paid into escrow
    'guard_payout',      -- Released to guard
    'venue_refund',      -- Refunded to venue
    'platform_fee',      -- Platform fee taken
    'agency_commission'  -- Agency commission taken
  )),
  
  amount INTEGER NOT NULL,  -- Amount in pence
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  from_account TEXT,  -- 'venue', 'escrow', 'platform'
  to_account TEXT,    -- 'escrow', 'guard', 'venue', 'platform', 'agency'
  
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_booking ON public.escrow_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_shift ON public.escrow_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_type ON public.escrow_transactions(transaction_type, status);

-- Enable RLS
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Venues can view their escrow transactions" ON public.escrow_transactions
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings WHERE venue_id IN (SELECT public.get_my_venue_ids())
    )
  );

CREATE POLICY "Personnel can view their escrow transactions" ON public.escrow_transactions
  FOR SELECT USING (
    shift_id IN (
      SELECT id FROM public.shifts WHERE personnel_id = public.get_my_personnel_id()
    )
  );

-- =====================================================
-- 5. FUNCTION: CONFIRM SHIFT AND RELEASE PAYMENT
-- =====================================================

CREATE OR REPLACE FUNCTION public.confirm_shift_payment(
  p_shift_id UUID,
  p_confirmed_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_shift RECORD;
  v_payment RECORD;
  v_result JSONB;
BEGIN
  -- Get shift details
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
  END IF;
  
  -- Check shift is completed
  IF v_shift.status != 'checked_out' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not completed yet');
  END IF;
  
  -- Check not already confirmed
  IF v_shift.venue_confirmed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift already confirmed');
  END IF;
  
  -- Update shift
  UPDATE public.shifts
  SET 
    venue_confirmed = TRUE,
    venue_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_shift_id;
  
  -- Update shift_payment if exists
  UPDATE public.shift_payments
  SET 
    escrow_status = 'confirmed',
    venue_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE shift_id = p_shift_id
  RETURNING * INTO v_payment;
  
  -- Log the transaction
  IF v_payment.id IS NOT NULL THEN
    INSERT INTO public.escrow_transactions (
      booking_id, shift_id, shift_payment_id,
      transaction_type, amount, from_account, to_account,
      status, notes
    ) VALUES (
      v_shift.booking_id, p_shift_id, v_payment.id,
      'guard_payout', v_payment.personnel_net, 'escrow', 'guard',
      'pending', 'Venue confirmed shift completion'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'shift_id', p_shift_id,
    'confirmed_at', NOW(),
    'payment_amount', COALESCE(v_payment.personnel_net, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNCTION: RAISE DISPUTE
-- =====================================================

CREATE OR REPLACE FUNCTION public.raise_shift_dispute(
  p_shift_id UUID,
  p_reason TEXT,
  p_raised_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_shift RECORD;
BEGIN
  -- Get shift details
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
  END IF;
  
  -- Check shift is completed but not confirmed
  IF v_shift.status != 'checked_out' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only dispute completed shifts');
  END IF;
  
  IF v_shift.venue_confirmed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot dispute already confirmed shift');
  END IF;
  
  -- Update shift
  UPDATE public.shifts
  SET 
    dispute_status = 'raised',
    updated_at = NOW()
  WHERE id = p_shift_id;
  
  -- Update shift_payment
  UPDATE public.shift_payments
  SET 
    escrow_status = 'disputed',
    dispute_reason = p_reason,
    dispute_raised_at = NOW(),
    updated_at = NOW()
  WHERE shift_id = p_shift_id;
  
  -- Create notification for admin/support
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT 
    u.id,
    'alert',
    '⚠️ Shift Dispute Raised',
    'A venue has disputed a shift. Review required.',
    jsonb_build_object('shift_id', p_shift_id, 'reason', p_reason)
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE p.role = 'admin'
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'shift_id', p_shift_id,
    'dispute_status', 'raised'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNCTION: AUTO-CONFIRM EXPIRED SHIFTS
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_confirm_expired_shifts()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_shift RECORD;
BEGIN
  -- Find shifts that are:
  -- 1. Completed (checked_out)
  -- 2. Not confirmed
  -- 3. Not disputed
  -- 4. More than 48 hours since checkout
  FOR v_shift IN
    SELECT s.id, s.booking_id, sp.personnel_net
    FROM public.shifts s
    LEFT JOIN public.shift_payments sp ON sp.shift_id = s.id
    WHERE s.status = 'checked_out'
      AND s.venue_confirmed = FALSE
      AND (s.dispute_status IS NULL OR s.dispute_status = 'none')
      AND s.actual_end < NOW() - INTERVAL '48 hours'
  LOOP
    -- Auto-confirm
    UPDATE public.shifts
    SET 
      venue_confirmed = TRUE,
      venue_confirmed_at = NOW(),
      auto_confirmed = TRUE,
      updated_at = NOW()
    WHERE id = v_shift.id;
    
    UPDATE public.shift_payments
    SET 
      escrow_status = 'confirmed',
      venue_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE shift_id = v_shift.id;
    
    -- Log transaction
    INSERT INTO public.escrow_transactions (
      booking_id, shift_id,
      transaction_type, amount, from_account, to_account,
      status, notes
    ) VALUES (
      v_shift.booking_id, v_shift.id,
      'guard_payout', COALESCE(v_shift.personnel_net, 0), 'escrow', 'guard',
      'pending', 'Auto-confirmed after 48 hours'
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shifts_venue_confirmed 
  ON public.shifts(venue_confirmed, status) 
  WHERE status = 'checked_out';

CREATE INDEX IF NOT EXISTS idx_shifts_auto_confirm 
  ON public.shifts(actual_end, venue_confirmed) 
  WHERE status = 'checked_out' AND venue_confirmed = FALSE;

CREATE INDEX IF NOT EXISTS idx_shift_payments_escrow 
  ON public.shift_payments(escrow_status);

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE public.escrow_transactions IS 'Audit log of all escrow money movements';
COMMENT ON FUNCTION public.confirm_shift_payment IS 'Venue confirms shift completion, triggers payout';
COMMENT ON FUNCTION public.raise_shift_dispute IS 'Venue disputes a shift, holds funds pending review';
COMMENT ON FUNCTION public.auto_confirm_expired_shifts IS 'Auto-confirms shifts after 48 hours if no dispute';
