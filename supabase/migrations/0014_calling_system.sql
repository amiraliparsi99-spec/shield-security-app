-- =====================================================
-- CALLING SYSTEM SCHEMA
-- In-app voice calling with WebRTC
-- =====================================================

-- Call status enum
CREATE TYPE call_status AS ENUM (
  'ringing',
  'connected',
  'ended',
  'missed',
  'declined',
  'failed'
);

-- Calls table for call history
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caller_role TEXT NOT NULL, -- venue, agency, personnel
  receiver_role TEXT NOT NULL,
  status call_status DEFAULT 'ringing',
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- optional context
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL, -- optional context
  end_reason TEXT, -- 'completed', 'caller_ended', 'receiver_ended', 'timeout', 'error'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call signaling table for WebRTC handshake
-- This is used for real-time signaling via Supabase Realtime
CREATE TABLE IF NOT EXISTS call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'offer', 'answer', 'ice_candidate', 'hangup', 'reject'
  signal_data JSONB NOT NULL, -- SDP or ICE candidate data
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_calls_caller ON calls(caller_user_id);
CREATE INDEX idx_calls_receiver ON calls(receiver_user_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created ON calls(created_at DESC);
CREATE INDEX idx_call_signals_call ON call_signals(call_id);
CREATE INDEX idx_call_signals_to_user ON call_signals(to_user_id, processed);

-- Updated at trigger for calls
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

-- Calls: Users can see their own calls (as caller or receiver)
CREATE POLICY "Users can view own calls"
  ON calls FOR SELECT
  USING (
    auth.uid() = caller_user_id OR 
    auth.uid() = receiver_user_id
  );

-- Calls: Users can create calls where they are the caller
CREATE POLICY "Users can create calls as caller"
  ON calls FOR INSERT
  WITH CHECK (auth.uid() = caller_user_id);

-- Calls: Participants can update call status
CREATE POLICY "Participants can update calls"
  ON calls FOR UPDATE
  USING (
    auth.uid() = caller_user_id OR 
    auth.uid() = receiver_user_id
  );

-- Signals: Users can see signals addressed to them
CREATE POLICY "Users can view signals to them"
  ON call_signals FOR SELECT
  USING (
    auth.uid() = to_user_id OR 
    auth.uid() = from_user_id
  );

-- Signals: Users can create signals from themselves
CREATE POLICY "Users can create signals"
  ON call_signals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Signals: Users can mark their signals as processed
CREATE POLICY "Users can update signals to them"
  ON call_signals FOR UPDATE
  USING (auth.uid() = to_user_id);

-- Signals: Auto-cleanup old signals (optional, could be a cron job)
CREATE POLICY "Users can delete own signals"
  ON call_signals FOR DELETE
  USING (
    auth.uid() = from_user_id OR 
    auth.uid() = to_user_id
  );

-- =====================================================
-- REALTIME SUBSCRIPTION
-- =====================================================

-- Enable realtime for call_signals table
-- This allows clients to subscribe to incoming calls/signals
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;
