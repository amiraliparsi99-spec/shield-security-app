-- Direct Messages System
-- Enables 1:1 conversations between guards, venues, and agencies

-- Create direct_conversations table
CREATE TABLE IF NOT EXISTS direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique conversation between two users (order-independent)
  CONSTRAINT unique_conversation UNIQUE (
    LEAST(participant_1, participant_2),
    GREATEST(participant_1, participant_2)
  )
);

-- Create direct_messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant_1 ON direct_conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant_2 ON direct_conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_updated_at ON direct_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);

-- Enable RLS
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for direct_conversations
CREATE POLICY "Users can view their own conversations"
  ON direct_conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations"
  ON direct_conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can update their own conversations"
  ON direct_conversations FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- RLS Policies for direct_messages
CREATE POLICY "Users can view messages in their conversations"
  ON direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM direct_conversations
      WHERE id = direct_messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM direct_conversations
      WHERE id = direct_messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can update read status of messages sent to them"
  ON direct_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM direct_conversations
      WHERE id = direct_messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

-- Enable realtime for direct messages
ALTER PUBLICATION supabase_realtime ADD TABLE direct_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- Function to get or create a conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_1 UUID, user_2 UUID)
RETURNS UUID AS $$
DECLARE
  convo_id UUID;
BEGIN
  -- Try to find existing conversation
  SELECT id INTO convo_id
  FROM direct_conversations
  WHERE (participant_1 = user_1 AND participant_2 = user_2)
     OR (participant_1 = user_2 AND participant_2 = user_1);
  
  -- If not found, create new conversation
  IF convo_id IS NULL THEN
    INSERT INTO direct_conversations (participant_1, participant_2)
    VALUES (user_1, user_2)
    RETURNING id INTO convo_id;
  END IF;
  
  RETURN convo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update conversation's last_message when a new message is sent
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE direct_conversations
  SET 
    last_message = NEW.content,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_new_direct_message ON direct_messages;
CREATE TRIGGER on_new_direct_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Create notification for new direct message
CREATE OR REPLACE FUNCTION notify_new_direct_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
BEGIN
  -- Get the recipient (the other participant)
  SELECT 
    CASE 
      WHEN participant_1 = NEW.sender_id THEN participant_2
      ELSE participant_1
    END INTO recipient_id
  FROM direct_conversations
  WHERE id = NEW.conversation_id;
  
  -- Get sender name
  SELECT COALESCE(display_name, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;
  
  -- Create notification
  INSERT INTO notifications (user_id, type, title, body, data, is_read)
  VALUES (
    recipient_id,
    'message',
    'New Message',
    sender_name || ': ' || LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'type', 'direct_message'
    ),
    FALSE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_direct_message_notify ON direct_messages;
CREATE TRIGGER on_direct_message_notify
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_direct_message();
