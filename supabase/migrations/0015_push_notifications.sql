-- =====================================================
-- PUSH NOTIFICATIONS SCHEMA
-- Store device tokens for push notifications
-- =====================================================

-- Platform type enum
CREATE TYPE device_platform AS ENUM (
  'web',
  'ios',
  'android'
);

-- Push tokens table - stores device tokens for each user
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform device_platform NOT NULL,
  device_name TEXT, -- e.g., "iPhone 15", "Chrome on Mac"
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique token per user per platform
  UNIQUE(user_id, token)
);

-- Notification log table - track sent notifications
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional payload data
  notification_type TEXT NOT NULL, -- 'call', 'booking', 'shift', 'message', 'system'
  related_id UUID, -- ID of related entity (call_id, booking_id, etc.)
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;
CREATE INDEX idx_notification_log_user ON notification_log(user_id);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX idx_notification_log_created ON notification_log(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Push tokens: Users can only manage their own tokens
CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Notification log: Users can only view their own notifications
CREATE POLICY "Users can view own notification log"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert notifications (for backend triggers)
CREATE POLICY "Service can insert notifications"
  ON notification_log FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- =====================================================

-- Function to get active push tokens for a user
CREATE OR REPLACE FUNCTION get_user_push_tokens(target_user_id UUID)
RETURNS TABLE(token TEXT, platform device_platform) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.platform
  FROM push_tokens pt
  WHERE pt.user_id = target_user_id
    AND pt.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log a notification
CREATE OR REPLACE FUNCTION log_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT,
  p_related_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notification_log (user_id, title, body, notification_type, related_id, data)
  VALUES (p_user_id, p_title, p_body, p_type, p_related_id, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
