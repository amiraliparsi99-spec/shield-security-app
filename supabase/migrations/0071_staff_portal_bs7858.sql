-- BS7858 extensions for staff portal: 5-year history, declarations, reference chasing

CREATE TABLE IF NOT EXISTS staff_portal_employment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_portal_profiles(id) ON DELETE CASCADE,
  employer_name text NOT NULL,
  job_title text,
  start_date date NOT NULL,
  end_date date,
  contact_name text,
  contact_email text,
  contact_phone text,
  reason_for_leaving text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_portal_employment_staff_idx
  ON staff_portal_employment_history (staff_id);

CREATE TABLE IF NOT EXISTS staff_portal_address_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_portal_profiles(id) ON DELETE CASCADE,
  address_line text NOT NULL,
  postcode text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_portal_address_staff_idx
  ON staff_portal_address_history (staff_id);

CREATE TABLE IF NOT EXISTS staff_portal_gap_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_portal_profiles(id) ON DELETE CASCADE,
  gap_type text NOT NULL CHECK (gap_type IN ('employment', 'address')),
  gap_start date NOT NULL,
  gap_end date NOT NULL,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, gap_type, gap_start, gap_end)
);

CREATE INDEX IF NOT EXISTS staff_portal_gap_staff_idx
  ON staff_portal_gap_explanations (staff_id);

CREATE TABLE IF NOT EXISTS staff_portal_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_portal_profiles(id) ON DELETE CASCADE,
  form_version text NOT NULL DEFAULT '2026-07-v1',
  screening_consent boolean NOT NULL DEFAULT false,
  accuracy_declaration boolean NOT NULL DEFAULT false,
  gdpr_acknowledged boolean NOT NULL DEFAULT false,
  medical_condition_affecting_duties boolean,
  medical_details text,
  medication_affecting_alertness boolean,
  medication_details text,
  previous_injury_claim boolean,
  injury_details text,
  signature_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  UNIQUE (staff_id, form_version)
);

CREATE TABLE IF NOT EXISTS staff_portal_reference_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_portal_profiles(id) ON DELETE CASCADE,
  employment_id uuid REFERENCES staff_portal_employment_history(id) ON DELETE SET NULL,
  employer_name text NOT NULL,
  contact_name text,
  contact_email text NOT NULL,
  employment_start date,
  employment_end date,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'opened', 'completed', 'bounced')),
  sent_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  response_json jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_portal_reference_staff_idx
  ON staff_portal_reference_requests (staff_id);

CREATE INDEX IF NOT EXISTS staff_portal_reference_token_idx
  ON staff_portal_reference_requests (token)
  WHERE status IN ('pending', 'sent', 'opened');

ALTER TABLE staff_portal_employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_portal_address_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_portal_gap_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_portal_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_portal_reference_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_portal_employment_own
  ON staff_portal_employment_history FOR ALL
  USING (staff_id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_address_own
  ON staff_portal_address_history FOR ALL
  USING (staff_id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_gap_own
  ON staff_portal_gap_explanations FOR ALL
  USING (staff_id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_declarations_own
  ON staff_portal_declarations FOR ALL
  USING (staff_id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_reference_staff_select
  ON staff_portal_reference_requests FOR SELECT
  USING (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_reference_admin_write
  ON staff_portal_reference_requests FOR INSERT
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_reference_admin_update
  ON staff_portal_reference_requests FOR UPDATE
  USING (staff_id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_reference_admin_delete
  ON staff_portal_reference_requests FOR DELETE
  USING (staff_id = auth.uid() OR is_staff_portal_admin());
