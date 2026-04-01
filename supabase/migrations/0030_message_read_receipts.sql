-- Message Read Receipts System
-- Tracks delivery and read status for messages (like Telegram)

-- =============================================
-- GROUP CHAT MESSAGES READ RECEIPTS
-- =============================================

-- Add read_by array to group_chat_messages to track who has read each message
ALTER TABLE group_chat_messages 
ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';

-- Add delivered_at timestamp (when message was saved to DB = delivered)
ALTER TABLE group_chat_messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster read status queries
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_read_by 
ON group_chat_messages USING GIN (read_by);

-- Function to mark a message as read by a user
CREATE OR REPLACE FUNCTION mark_message_read(
  p_message_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE group_chat_messages
  SET read_by = array_append(
    CASE 
      WHEN read_by IS NULL THEN '{}'::UUID[]
      ELSE read_by
    END,
    p_user_id
  )
  WHERE id = p_message_id
  AND NOT (p_user_id = ANY(COALESCE(read_by, '{}'::UUID[])));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all messages in a chat as read by a user
CREATE OR REPLACE FUNCTION mark_chat_messages_read(
  p_chat_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE group_chat_messages
    SET read_by = array_append(
      CASE 
        WHEN read_by IS NULL THEN '{}'::UUID[]
        ELSE read_by
      END,
      p_user_id
    )
    WHERE group_chat_id = p_chat_id
    AND sender_id != p_user_id
    AND NOT (p_user_id = ANY(COALESCE(read_by, '{}'::UUID[])))
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DIRECT MESSAGES READ RECEIPTS
-- =============================================

-- Add read_at timestamp to direct_messages (when message was read)
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Add delivered_at timestamp to direct_messages
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster read status queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_is_read ON direct_messages(is_read);

-- Function to mark direct messages as read
CREATE OR REPLACE FUNCTION mark_direct_messages_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE direct_messages
    SET is_read = TRUE,
        read_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = FALSE
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REALTIME CONFIGURATION
-- =============================================

-- Enable realtime for group_chat_messages updates (for read receipts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'group_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages;
  END IF;
END $$;

-- Also ensure group_chats is in realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'group_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
  END IF;
END $$;

-- Ensure direct_messages is in realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END $$;

-- Set replica identity to full for group_chat_messages so we get old values in realtime
ALTER TABLE group_chat_messages REPLICA IDENTITY FULL;

-- Set replica identity to full for direct_messages so we get old values in realtime
ALTER TABLE direct_messages REPLICA IDENTITY FULL;
