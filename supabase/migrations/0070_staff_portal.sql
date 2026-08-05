-- Staff portal for shieldhq.co.uk (Shield HQ internal guards)
-- Separate from the marketplace app personnel/agency flows.

CREATE TABLE IF NOT EXISTS staff_portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_portal_invitations_email_idx
  ON staff_portal_invitations (lower(email));

CREATE INDEX IF NOT EXISTS staff_portal_invitations_token_idx
  ON staff_portal_invitations (token)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS staff_portal_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  date_of_birth date,
  ni_number text,
  mobile text,
  address_line text,
  postcode text,
  sia_license_number text,
  sia_license_type text,
  sia_issued_date date,
  sia_expiry_date date,
  nationality text,
  british_irish_citizen boolean,
  visa_type text,
  passport_number text,
  passport_expiry date,
  visa_expiry date,
  rtw_share_code text,
  share_code_expiry date,
  bank_account_name text,
  bank_name text,
  sort_code text,
  account_number text,
  ref1_name text,
  ref1_company text,
  ref1_phone text,
  ref2_name text,
  ref2_company text,
  ref2_phone text,
  onboarding_status text NOT NULL DEFAULT 'draft'
    CHECK (onboarding_status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_portal_profiles_status_idx
  ON staff_portal_profiles (onboarding_status);

CREATE TABLE IF NOT EXISTS staff_portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_portal_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL
    CHECK (document_type IN ('sia_front', 'photo_id', 'visa_brp', 'proof_of_address')),
  file_path text NOT NULL,
  file_name text,
  file_size integer,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_portal_documents_staff_idx
  ON staff_portal_documents (staff_id);

CREATE OR REPLACE FUNCTION is_staff_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    lower(auth.jwt() ->> 'email') LIKE '%@shieldhq.co.uk',
    false
  );
$$;

CREATE OR REPLACE FUNCTION staff_portal_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_portal_profiles_updated_at ON staff_portal_profiles;
CREATE TRIGGER staff_portal_profiles_updated_at
  BEFORE UPDATE ON staff_portal_profiles
  FOR EACH ROW EXECUTE FUNCTION staff_portal_set_updated_at();

ALTER TABLE staff_portal_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_portal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_portal_documents ENABLE ROW LEVEL SECURITY;

-- Invitations: admins manage; invitee can read own pending invite by token (via service role in API)
CREATE POLICY staff_portal_invitations_admin_all
  ON staff_portal_invitations FOR ALL
  USING (is_staff_portal_admin())
  WITH CHECK (is_staff_portal_admin());

CREATE POLICY staff_portal_invitations_invitee_select
  ON staff_portal_invitations FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Profiles: staff own row; admins read/update all
CREATE POLICY staff_portal_profiles_own_select
  ON staff_portal_profiles FOR SELECT
  USING (id = auth.uid() OR is_staff_portal_admin());

CREATE POLICY staff_portal_profiles_own_insert
  ON staff_portal_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY staff_portal_profiles_own_update
  ON staff_portal_profiles FOR UPDATE
  USING (id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (id = auth.uid() OR is_staff_portal_admin());

-- Documents: staff own; admins read all
CREATE POLICY staff_portal_documents_own_all
  ON staff_portal_documents FOR ALL
  USING (staff_id = auth.uid() OR is_staff_portal_admin())
  WITH CHECK (staff_id = auth.uid() OR is_staff_portal_admin());

-- Storage bucket for staff uploads (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-portal-documents',
  'staff-portal-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY staff_portal_storage_select
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'staff-portal-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_staff_portal_admin()
    )
  );

CREATE POLICY staff_portal_storage_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'staff-portal-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY staff_portal_storage_update
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'staff-portal-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY staff_portal_storage_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'staff-portal-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_staff_portal_admin()
    )
  );
