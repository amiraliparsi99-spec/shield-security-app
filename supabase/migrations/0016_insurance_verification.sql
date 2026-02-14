-- =====================================================
-- INSURANCE VERIFICATION SCHEMA
-- Public liability insurance tracking for personnel/agencies
-- =====================================================

-- Insurance type enum
CREATE TYPE insurance_type AS ENUM (
  'public_liability',
  'employers_liability',
  'professional_indemnity',
  'personal_accident'
);

-- Insurance status enum
CREATE TYPE insurance_status AS ENUM (
  'pending',
  'verified',
  'rejected',
  'expired'
);

-- Insurance records table
CREATE TABLE IF NOT EXISTS insurance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL, -- 'personnel' or 'agency'
  insurance_type insurance_type NOT NULL,
  provider_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  coverage_amount DECIMAL(12, 2), -- Amount in GBP
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  document_url TEXT, -- Uploaded certificate
  status insurance_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_insurance_user ON insurance_records(user_id);
CREATE INDEX idx_insurance_status ON insurance_records(status);
CREATE INDEX idx_insurance_expiry ON insurance_records(expiry_date);
CREATE INDEX idx_insurance_type ON insurance_records(insurance_type);

-- Updated at trigger
CREATE TRIGGER update_insurance_records_updated_at
  BEFORE UPDATE ON insurance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE insurance_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own insurance records
CREATE POLICY "Users can view own insurance"
  ON insurance_records FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own insurance records
CREATE POLICY "Users can insert own insurance"
  ON insurance_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending insurance records
CREATE POLICY "Users can update own pending insurance"
  ON insurance_records FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all insurance records
CREATE POLICY "Admins can view all insurance"
  ON insurance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can update any insurance record (for verification)
CREATE POLICY "Admins can update all insurance"
  ON insurance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Check if user has valid insurance
CREATE OR REPLACE FUNCTION has_valid_insurance(
  p_user_id UUID,
  p_insurance_type insurance_type DEFAULT 'public_liability'
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM insurance_records
    WHERE user_id = p_user_id
      AND insurance_type = p_insurance_type
      AND status = 'verified'
      AND expiry_date >= CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get expiring insurance records (for notifications)
CREATE OR REPLACE FUNCTION get_expiring_insurance(days_until_expiry INTEGER DEFAULT 30)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  insurance_type insurance_type,
  expiry_date DATE,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ir.id,
    ir.user_id,
    ir.insurance_type,
    ir.expiry_date,
    (ir.expiry_date - CURRENT_DATE)::INTEGER as days_remaining
  FROM insurance_records ir
  WHERE ir.status = 'verified'
    AND ir.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_until_expiry)
  ORDER BY ir.expiry_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
