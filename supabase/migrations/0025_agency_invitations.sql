-- Agency Invitation System
-- Agencies send invitations to guards, guards accept/decline

CREATE TABLE IF NOT EXISTS agency_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  
  -- Invitation details
  role TEXT NOT NULL CHECK (role IN ('contractor', 'employee', 'manager')),
  hourly_rate INTEGER, -- in pence, optional override
  message TEXT, -- Personal message from agency
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  
  -- Response
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  
  -- Prevent duplicate invitations
  UNIQUE(agency_id, personnel_id, status)
);

-- Indexes
CREATE INDEX idx_agency_invitations_agency ON agency_invitations(agency_id);
CREATE INDEX idx_agency_invitations_personnel ON agency_invitations(personnel_id);
CREATE INDEX idx_agency_invitations_status ON agency_invitations(status);
CREATE INDEX idx_agency_invitations_expires ON agency_invitations(expires_at) WHERE status = 'pending';

-- RLS Policies
ALTER TABLE agency_invitations ENABLE ROW LEVEL SECURITY;

-- Agencies can view their own invitations
CREATE POLICY "Agencies can view own invitations"
  ON agency_invitations FOR SELECT
  USING (
    agency_id IN (
      SELECT id FROM agencies
      WHERE user_id = auth.uid()
    )
  );

-- Agencies can create invitations
CREATE POLICY "Agencies can create invitations"
  ON agency_invitations FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT id FROM agencies
      WHERE user_id = auth.uid()
    )
  );

-- Agencies can cancel their pending invitations
CREATE POLICY "Agencies can cancel pending invitations"
  ON agency_invitations FOR UPDATE
  USING (
    agency_id IN (
      SELECT id FROM agencies
      WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  );

-- Personnel can view invitations sent to them
CREATE POLICY "Personnel can view own invitations"
  ON agency_invitations FOR SELECT
  USING (
    personnel_id = (
      SELECT id FROM personnel
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Personnel can respond to invitations
CREATE POLICY "Personnel can respond to invitations"
  ON agency_invitations FOR UPDATE
  USING (
    personnel_id = (
      SELECT id FROM personnel
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND status = 'pending'
  );

-- Agencies can delete their pending invitations
CREATE POLICY "Agencies can delete pending invitations"
  ON agency_invitations FOR DELETE
  USING (
    agency_id IN (
      SELECT id FROM agencies
      WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  );

-- Function to auto-expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agency_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;

-- Function to handle invitation acceptance
CREATE OR REPLACE FUNCTION accept_agency_invitation(invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_agency_staff_id UUID;
BEGIN
  -- Get invitation details
  SELECT * INTO v_invitation
  FROM agency_invitations
  WHERE id = invitation_id
    AND status = 'pending'
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or expired');
  END IF;
  
  -- Check if already in agency
  IF EXISTS (
    SELECT 1 FROM agency_staff
    WHERE agency_id = v_invitation.agency_id
      AND personnel_id = v_invitation.personnel_id
      AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already in this agency');
  END IF;
  
  -- Add to agency_staff
  INSERT INTO agency_staff (
    agency_id,
    personnel_id,
    joined_at,
    is_active
  ) VALUES (
    v_invitation.agency_id,
    v_invitation.personnel_id,
    now(),
    true
  )
  RETURNING id INTO v_agency_staff_id;
  
  -- Mark invitation as accepted
  UPDATE agency_invitations
  SET status = 'accepted',
      responded_at = now()
  WHERE id = invitation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'agency_staff_id', v_agency_staff_id
  );
END;
$$;

-- Enable Realtime for invitations
ALTER PUBLICATION supabase_realtime ADD TABLE agency_invitations;

COMMENT ON TABLE agency_invitations IS 'Invitation system for agencies to invite guards to join their team';
