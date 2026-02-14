-- Venue-Agency Connection System
-- Partnerships, security requests, and bids

-- =====================================================
-- VENUE-AGENCY PARTNERSHIPS
-- =====================================================

CREATE TABLE IF NOT EXISTS venue_agency_partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'terminated')),
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('venue', 'agency')),
  custom_commission_rate DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(venue_id, agency_id)
);

CREATE INDEX idx_venue_agency_partnerships_venue ON venue_agency_partnerships(venue_id);
CREATE INDEX idx_venue_agency_partnerships_agency ON venue_agency_partnerships(agency_id);
CREATE INDEX idx_venue_agency_partnerships_status ON venue_agency_partnerships(status);

ALTER TABLE venue_agency_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues can view own partnerships"
  ON venue_agency_partnerships FOR SELECT
  USING (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  );

CREATE POLICY "Venues can create partnership requests"
  ON venue_agency_partnerships FOR INSERT
  WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
    AND initiated_by = 'venue'
  );

CREATE POLICY "Venues can update own partnership requests"
  ON venue_agency_partnerships FOR UPDATE
  USING (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  );

CREATE POLICY "Agencies can view own partnerships"
  ON venue_agency_partnerships FOR SELECT
  USING (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
  );

CREATE POLICY "Agencies can create partnership requests"
  ON venue_agency_partnerships FOR INSERT
  WITH CHECK (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
    AND initiated_by = 'agency'
  );

CREATE POLICY "Agencies can update own partnership responses"
  ON venue_agency_partnerships FOR UPDATE
  USING (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
  );

-- =====================================================
-- SECURITY REQUESTS (open requests from venues)
-- =====================================================

CREATE TABLE IF NOT EXISTS security_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  staff_requirements JSONB,
  budget_min INTEGER,
  budget_max INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'awarded', 'cancelled')),
  awarded_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  partners_only BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_requests_venue ON security_requests(venue_id);
CREATE INDEX idx_security_requests_status ON security_requests(status);
CREATE INDEX idx_security_requests_event_date ON security_requests(event_date);
CREATE INDEX idx_security_requests_partners_only ON security_requests(partners_only) WHERE status = 'open';

ALTER TABLE security_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues can manage own requests"
  ON security_requests FOR ALL
  USING (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  )
  WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
  );

-- Agencies can select open requests (filtered in app: partners_only + active partnership, or all open)
CREATE POLICY "Agencies can view open security requests"
  ON security_requests FOR SELECT
  USING (status = 'open');

-- =====================================================
-- REQUEST BIDS (agency bids on requests)
-- =====================================================

CREATE TABLE IF NOT EXISTS request_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES security_requests(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  proposed_rate INTEGER NOT NULL,
  cover_letter TEXT,
  estimated_staff JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, agency_id)
);

CREATE INDEX idx_request_bids_request ON request_bids(request_id);
CREATE INDEX idx_request_bids_agency ON request_bids(agency_id);
CREATE INDEX idx_request_bids_status ON request_bids(status);

ALTER TABLE request_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues can view bids on own requests"
  ON request_bids FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM security_requests
      WHERE venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Venues can update bid status when awarding"
  ON request_bids FOR UPDATE
  USING (
    request_id IN (
      SELECT id FROM security_requests
      WHERE venue_id IN (SELECT id FROM venues WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Agencies can view own bids"
  ON request_bids FOR SELECT
  USING (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
  );

CREATE POLICY "Agencies can create bids"
  ON request_bids FOR INSERT
  WITH CHECK (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
  );

CREATE POLICY "Agencies can update own bids (e.g. withdraw)"
  ON request_bids FOR UPDATE
  USING (
    agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
  );
