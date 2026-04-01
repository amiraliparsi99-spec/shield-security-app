-- =====================================================
-- CALL NOTIFICATIONS
-- Trigger to send push notifications for incoming calls
-- =====================================================

-- Function to send push notification for incoming calls
-- This calls the Edge Function or API endpoint to send the notification
CREATE OR REPLACE FUNCTION notify_incoming_call()
RETURNS TRIGGER AS $$
DECLARE
  caller_name TEXT;
  receiver_token TEXT;
  api_url TEXT;
BEGIN
  -- Only trigger on new calls with 'ringing' status
  IF NEW.status = 'ringing' THEN
    -- Get caller's display name
    SELECT display_name INTO caller_name
    FROM profiles
    WHERE id = NEW.caller_user_id;

    -- Insert an in-app notification for the receiver
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      data,
      priority
    ) VALUES (
      NEW.receiver_user_id,
      'call',
      'Incoming Call',
      COALESCE(caller_name, 'Someone') || ' is calling you',
      jsonb_build_object(
        'type', 'incoming_call',
        'call_id', NEW.id,
        'caller_user_id', NEW.caller_user_id,
        'caller_name', COALESCE(caller_name, 'Unknown'),
        'caller_role', NEW.caller_role
      ),
      'high'
    );

    -- Note: Push notification is sent via Supabase Realtime subscription
    -- The mobile app listens to call_signals table for real-time incoming calls
    -- This notification is a backup for when the app is in background
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the notification function on new calls
DROP TRIGGER IF EXISTS on_new_call_notify ON calls;
CREATE TRIGGER on_new_call_notify
  AFTER INSERT ON calls
  FOR EACH ROW
  EXECUTE FUNCTION notify_incoming_call();

-- Function to handle missed calls
CREATE OR REPLACE FUNCTION notify_missed_call()
RETURNS TRIGGER AS $$
DECLARE
  caller_name TEXT;
BEGIN
  -- Only trigger when status changes to 'missed'
  IF OLD.status = 'ringing' AND NEW.status = 'missed' THEN
    -- Get caller's display name
    SELECT display_name INTO caller_name
    FROM profiles
    WHERE id = NEW.caller_user_id;

    -- Insert missed call notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      data
    ) VALUES (
      NEW.receiver_user_id,
      'call',
      'Missed Call',
      'You missed a call from ' || COALESCE(caller_name, 'Unknown'),
      jsonb_build_object(
        'type', 'missed_call',
        'call_id', NEW.id,
        'caller_user_id', NEW.caller_user_id,
        'caller_name', COALESCE(caller_name, 'Unknown')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for missed call notifications
DROP TRIGGER IF EXISTS on_missed_call_notify ON calls;
CREATE TRIGGER on_missed_call_notify
  AFTER UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION notify_missed_call();

-- Add priority column to notifications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;
END $$;

-- Create index for high priority notifications
CREATE INDEX IF NOT EXISTS idx_notifications_priority 
  ON notifications(priority) WHERE priority = 'high';
