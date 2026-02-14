-- Create shift_payments table for tracking payments for completed shifts
-- This links shifts to financial transactions

CREATE TABLE IF NOT EXISTS public.shift_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  
  -- Amounts in pence/cents
  gross_amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL DEFAULT 0,
  agency_commission INTEGER,
  personnel_net INTEGER NOT NULL,
  
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
    'pending', 'awaiting_payment', 'processing', 'succeeded', 'failed', 'refunded'
  )),
  
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_shift_payments_shift ON public.shift_payments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_payments_venue_status ON public.shift_payments(venue_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_payments_personnel ON public.shift_payments(personnel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_payments_agency ON public.shift_payments(agency_id) WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shift_payments_stripe ON public.shift_payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.shift_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Venues can view payments for their bookings
CREATE POLICY "Venues can view their shift payments" ON public.shift_payments
  FOR SELECT USING (
    venue_id IN (SELECT public.get_my_venue_ids())
  );

-- Personnel can view their own payments
CREATE POLICY "Personnel can view their payments" ON public.shift_payments
  FOR SELECT USING (
    personnel_id = public.get_my_personnel_id()
  );

-- Agencies can view payments for their personnel
CREATE POLICY "Agencies can view their staff payments" ON public.shift_payments
  FOR SELECT USING (
    agency_id IN (
      SELECT id FROM public.agencies 
      WHERE owner_id = auth.uid()
    )
  );

-- System can insert/update payments (via service role or authenticated)
CREATE POLICY "System can manage shift payments" ON public.shift_payments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create wallets table if not exists
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance INTEGER NOT NULL DEFAULT 0,
  pending_balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_withdrawn INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'gbp',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own wallet (for withdrawal requests)
CREATE POLICY "Users can update own wallet" ON public.wallets
  FOR UPDATE USING (user_id = auth.uid());

-- System can insert wallets
CREATE POLICY "System can manage wallets" ON public.wallets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Function to transfer pending balance to available
CREATE OR REPLACE FUNCTION public.transfer_pending_to_available(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE public.wallets
  SET 
    pending_balance = pending_balance - p_amount,
    available_balance = available_balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add agency_commission_rate to personnel table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'personnel' 
    AND column_name = 'agency_commission_rate'
  ) THEN
    ALTER TABLE public.personnel ADD COLUMN agency_commission_rate NUMERIC(5,4);
  END IF;
END $$;

-- Add commission_rate to agencies table if not exists  
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agencies' 
    AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE public.agencies ADD COLUMN commission_rate NUMERIC(5,4) DEFAULT 0.15;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE public.shift_payments IS 'Tracks payments for completed security shifts';
COMMENT ON TABLE public.wallets IS 'User wallet balances for earnings and payouts';
COMMENT ON FUNCTION public.transfer_pending_to_available IS 'Moves funds from pending to available balance when payment completes';
