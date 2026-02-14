-- ============================================
-- SHIELD PAYMENT SYSTEM
-- Stripe Connect integration for marketplace payments
-- ============================================

-- Connected Stripe accounts for agencies and personnel
CREATE TABLE IF NOT EXISTS stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('agency', 'personnel')),
  
  -- Account status
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  
  -- Business info (from Stripe)
  business_name TEXT,
  country TEXT DEFAULT 'GB',
  default_currency TEXT DEFAULT 'gbp',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet balances (synced with Stripe balance)
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Balances in pence (smallest currency unit)
  available_balance INTEGER DEFAULT 0,
  pending_balance INTEGER DEFAULT 0,
  
  -- Lifetime stats
  total_earned INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  
  currency TEXT DEFAULT 'gbp',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All financial transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  
  -- Parties involved
  payer_id UUID REFERENCES auth.users(id),      -- venue (for payments)
  payee_id UUID REFERENCES auth.users(id),      -- agency or personnel
  
  -- Related booking
  booking_id UUID REFERENCES bookings(id),
  
  -- Amounts in pence
  gross_amount INTEGER NOT NULL,
  platform_fee INTEGER DEFAULT 0,
  stripe_fee INTEGER DEFAULT 0,
  net_amount INTEGER NOT NULL,
  
  currency TEXT DEFAULT 'gbp',
  
  -- Transaction type and status
  type TEXT NOT NULL CHECK (type IN ('payment', 'payout', 'refund', 'adjustment')),
  status TEXT NOT NULL CHECK (status IN (
    'pending',      -- Awaiting processing
    'processing',   -- Being processed
    'succeeded',    -- Completed successfully
    'failed',       -- Failed
    'cancelled',    -- Cancelled by user
    'refunded',     -- Refunded
    'disputed'      -- Chargeback/dispute
  )),
  
  -- Payment method details
  payment_method_type TEXT, -- 'apple_pay', 'google_pay', 'card', 'bank_transfer'
  payment_method_brand TEXT, -- 'visa', 'mastercard', etc.
  payment_method_last4 TEXT,
  
  -- Description and metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Error handling
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout requests (withdrawals to bank)
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  stripe_payout_id TEXT,
  
  -- Amount in pence
  amount INTEGER NOT NULL,
  fee INTEGER DEFAULT 0,           -- Instant payout fee
  net_amount INTEGER NOT NULL,     -- Amount after fee
  
  currency TEXT DEFAULT 'gbp',
  
  -- Payout type and status
  payout_method TEXT NOT NULL CHECK (payout_method IN ('instant', 'standard')),
  status TEXT NOT NULL CHECK (status IN (
    'pending',      -- Awaiting processing
    'processing',   -- In transit
    'paid',         -- Successfully deposited
    'failed',       -- Failed
    'cancelled'     -- Cancelled
  )),
  
  -- Bank account info
  bank_name TEXT,
  bank_last4 TEXT,
  
  -- Timing
  estimated_arrival TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Error handling
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved payment methods (for venues)
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  
  -- Card/bank details
  type TEXT NOT NULL,              -- 'card', 'bank_account', 'apple_pay'
  brand TEXT,                      -- 'visa', 'mastercard', 'amex'
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  
  -- Bank account specific
  bank_name TEXT,
  
  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  nickname TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform settings (fees, limits, etc.)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('platform_fee_percent', '0.10', 'Platform fee as decimal (0.10 = 10%)'),
  ('minimum_payout_amount', '1000', 'Minimum payout in pence (1000 = £10)'),
  ('instant_payout_fee_percent', '0.01', 'Instant payout fee (0.01 = 1%)'),
  ('instant_payout_min_fee', '50', 'Minimum instant payout fee in pence')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user ON stripe_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_stripe_id ON stripe_accounts(stripe_account_id);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_payer ON transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created ON payout_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Stripe accounts: users can only see their own
CREATE POLICY stripe_accounts_select ON stripe_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY stripe_accounts_insert ON stripe_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY stripe_accounts_update ON stripe_accounts
  FOR UPDATE USING (auth.uid() = user_id);

-- Wallets: users can only see their own
CREATE POLICY wallets_select ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Transactions: users can see transactions they're involved in
CREATE POLICY transactions_select ON transactions
  FOR SELECT USING (
    auth.uid() = payer_id OR 
    auth.uid() = payee_id
  );

-- Payout requests: users can only see their own
CREATE POLICY payout_requests_select ON payout_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY payout_requests_insert ON payout_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payment methods: users can only see their own
CREATE POLICY payment_methods_select ON payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY payment_methods_insert ON payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY payment_methods_delete ON payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- Platform settings: readable by all authenticated users
CREATE POLICY platform_settings_select ON platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(
  p_user_id UUID,
  p_available_change INTEGER DEFAULT 0,
  p_pending_change INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO wallets (user_id, available_balance, pending_balance, updated_at)
  VALUES (p_user_id, GREATEST(0, p_available_change), GREATEST(0, p_pending_change), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    available_balance = GREATEST(0, wallets.available_balance + p_available_change),
    pending_balance = GREATEST(0, wallets.pending_balance + p_pending_change),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to move pending to available (when payment clears)
CREATE OR REPLACE FUNCTION clear_pending_balance(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE wallets SET
    pending_balance = GREATEST(0, pending_balance - p_amount),
    available_balance = available_balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process payout (deduct from available)
CREATE OR REPLACE FUNCTION process_payout(
  p_user_id UUID,
  p_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT available_balance INTO v_available
  FROM wallets WHERE user_id = p_user_id;
  
  IF v_available >= p_amount THEN
    UPDATE wallets SET
      available_balance = available_balance - p_amount,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get platform setting
CREATE OR REPLACE FUNCTION get_platform_setting(p_key TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT value FROM platform_settings WHERE key = p_key);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stripe_accounts_updated
  BEFORE UPDATE ON stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER transactions_updated
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payout_requests_updated
  BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
