-- Set up scheduled job for shift reminders
-- This creates a pg_cron job that runs every hour to check for shifts needing reminders

-- Note: pg_cron must be enabled in Supabase dashboard under Database > Extensions
-- The extension should already be enabled for Supabase projects

-- First, ensure the notification_log table exists for tracking sent reminders
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  notification_type TEXT NOT NULL,
  related_id UUID,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB DEFAULT '{}'
);

-- Index for checking if reminder was already sent
CREATE INDEX IF NOT EXISTS idx_notification_log_related 
ON public.notification_log(related_id, notification_type);

-- Enable RLS
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification log
CREATE POLICY "Users can view own notification log" ON public.notification_log
  FOR SELECT USING (user_id = auth.uid());

-- System can insert notification log entries
CREATE POLICY "System can insert notification log" ON public.notification_log
  FOR INSERT WITH CHECK (true);

-- Create the cron job to call the edge function
-- This runs every hour at minute 0
-- Note: The actual Edge Function URL needs to be configured in the Edge Function dashboard
-- or via environment variables

-- Alternative: Use pg_net to call the edge function directly (requires pg_net extension)
-- For now, we'll create a database function that can be called by external cron

-- Function to get shifts needing reminders (for backup/local processing)
CREATE OR REPLACE FUNCTION public.get_shifts_needing_reminders()
RETURNS TABLE (
  shift_id UUID,
  personnel_user_id UUID,
  personnel_name TEXT,
  venue_name TEXT,
  event_name TEXT,
  scheduled_start TIMESTAMPTZ,
  reminder_type TEXT
) AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  in_24h TIMESTAMPTZ := now_ts + INTERVAL '24 hours';
  in_23h TIMESTAMPTZ := now_ts + INTERVAL '23 hours';
  in_2h TIMESTAMPTZ := now_ts + INTERVAL '2 hours';
  in_1h TIMESTAMPTZ := now_ts + INTERVAL '1 hour';
BEGIN
  -- 24-hour reminders
  RETURN QUERY
  SELECT 
    s.id,
    p.user_id,
    p.display_name,
    v.name,
    b.event_name,
    s.scheduled_start,
    '24h'::TEXT
  FROM public.shifts s
  JOIN public.personnel p ON s.personnel_id = p.id
  JOIN public.bookings b ON s.booking_id = b.id
  JOIN public.venues v ON b.venue_id = v.id
  WHERE s.status = 'accepted'
    AND s.scheduled_start >= in_23h
    AND s.scheduled_start < in_24h
    AND s.personnel_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_log nl
      WHERE nl.related_id = s.id
      AND nl.notification_type = 'shift_reminder_24h'
    );

  -- 2-hour reminders
  RETURN QUERY
  SELECT 
    s.id,
    p.user_id,
    p.display_name,
    v.name,
    b.event_name,
    s.scheduled_start,
    '2h'::TEXT
  FROM public.shifts s
  JOIN public.personnel p ON s.personnel_id = p.id
  JOIN public.bookings b ON s.booking_id = b.id
  JOIN public.venues v ON b.venue_id = v.id
  WHERE s.status = 'accepted'
    AND s.scheduled_start >= in_1h
    AND s.scheduled_start < in_2h
    AND s.personnel_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_log nl
      WHERE nl.related_id = s.id
      AND nl.notification_type = 'shift_reminder_2h'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a single shift reminder
CREATE OR REPLACE FUNCTION public.send_shift_reminder(
  p_shift_id UUID,
  p_user_id UUID,
  p_venue_name TEXT,
  p_event_name TEXT,
  p_scheduled_start TIMESTAMPTZ,
  p_reminder_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  formatted_time TEXT;
  formatted_date TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Format time
  formatted_time := TO_CHAR(p_scheduled_start AT TIME ZONE 'Europe/London', 'HH24:MI');
  formatted_date := TO_CHAR(p_scheduled_start AT TIME ZONE 'Europe/London', 'Day, DD Month');

  -- Set notification content based on reminder type
  IF p_reminder_type = '24h' THEN
    notification_title := '📅 Shift Tomorrow';
    notification_body := format('Your shift at %s starts tomorrow at %s. Event: %s', 
      p_venue_name, formatted_time, COALESCE(p_event_name, 'Shift'));
  ELSE
    notification_title := '⏰ Shift Starting Soon';
    notification_body := format('Your shift at %s starts at %s', p_venue_name, formatted_time);
  END IF;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'shift',
    notification_title,
    notification_body,
    jsonb_build_object(
      'shift_id', p_shift_id,
      'type', 'shift_reminder_' || p_reminder_type,
      'venue_name', p_venue_name,
      'start_time', p_scheduled_start
    )
  );

  -- Log the reminder to prevent duplicates
  INSERT INTO public.notification_log (user_id, title, body, notification_type, related_id)
  VALUES (
    p_user_id,
    notification_title,
    notification_body,
    'shift_reminder_' || p_reminder_type,
    p_shift_id
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process all pending reminders (can be called by cron)
CREATE OR REPLACE FUNCTION public.process_shift_reminders()
RETURNS INTEGER AS $$
DECLARE
  reminder RECORD;
  sent_count INTEGER := 0;
BEGIN
  FOR reminder IN SELECT * FROM public.get_shifts_needing_reminders() LOOP
    IF public.send_shift_reminder(
      reminder.shift_id,
      reminder.personnel_user_id,
      reminder.venue_name,
      reminder.event_name,
      reminder.scheduled_start,
      reminder.reminder_type
    ) THEN
      sent_count := sent_count + 1;
    END IF;
  END LOOP;
  
  RETURN sent_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the scheduled job using pg_cron (runs every hour at minute 5)
-- This will automatically process reminders
-- Note: Uncomment below if pg_cron extension is enabled

-- SELECT cron.schedule(
--   'process-shift-reminders',
--   '5 * * * *',
--   $$SELECT public.process_shift_reminders()$$
-- );

COMMENT ON FUNCTION public.get_shifts_needing_reminders IS 'Returns shifts that need reminder notifications';
COMMENT ON FUNCTION public.send_shift_reminder IS 'Sends a single shift reminder notification';
COMMENT ON FUNCTION public.process_shift_reminders IS 'Processes all pending shift reminders - call from cron';
