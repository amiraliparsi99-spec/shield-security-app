-- ============================================================
-- Shift Offers — Uber-style job notifications
-- Tracks which guards were offered which shifts, their response,
-- and enables real-time popup delivery via Supabase Realtime.
-- ============================================================

-- 1. Create the shift_offers table
CREATE TABLE IF NOT EXISTS shift_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  hourly_rate DECIMAL(10,2) NOT NULL,
  venue_name TEXT,
  venue_address TEXT,
  venue_latitude DOUBLE PRECISION,
  venue_longitude DOUBLE PRECISION,
  shift_date TEXT,
  start_time TEXT,
  end_time TEXT,
  distance_miles DECIMAL(5,1),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shift_id, personnel_id)
);

COMMENT ON TABLE shift_offers IS
  'Tracks shift offers sent to individual guards — one row per guard per shift. Enables Uber-style accept/decline flow.';

-- 2. Indexes
-- Fast lookup for a guard's pending offers
CREATE INDEX IF NOT EXISTS idx_shift_offers_personnel_pending
  ON shift_offers (personnel_id, status)
  WHERE status = 'pending';

-- Fast lookup for all offers on a specific shift
CREATE INDEX IF NOT EXISTS idx_shift_offers_shift_status
  ON shift_offers (shift_id, status);

-- Expiry cleanup queries
CREATE INDEX IF NOT EXISTS idx_shift_offers_expires
  ON shift_offers (expires_at)
  WHERE status = 'pending';

-- 3. Enable Supabase Realtime on shift_offers
-- This allows the mobile app to subscribe to INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE shift_offers;

-- 4. Row-Level Security
ALTER TABLE shift_offers ENABLE ROW LEVEL SECURITY;

-- Guards can only see their own offers
CREATE POLICY "Guards can view their own shift offers"
  ON shift_offers FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel WHERE user_id = auth.uid()
    )
  );

-- Guards can update their own offers (accept/decline)
CREATE POLICY "Guards can respond to their own shift offers"
  ON shift_offers FOR UPDATE
  USING (
    personnel_id IN (
      SELECT id FROM personnel WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    personnel_id IN (
      SELECT id FROM personnel WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for the API routes)
CREATE POLICY "Service role full access to shift_offers"
  ON shift_offers FOR ALL
  USING (auth.role() = 'service_role');
