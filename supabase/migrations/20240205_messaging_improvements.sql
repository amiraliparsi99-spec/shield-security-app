-- Messaging system improvements
-- Adds read_at tracking and last_message_at for conversations

-- Add read_at column to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- Add last_message_at to conversations for sorting
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for unread message queries
CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON public.messages(conversation_id, sender_id, read_at) 
WHERE read_at IS NULL;

-- Create index for conversation sorting
CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
ON public.conversations(last_message_at DESC NULLS LAST);

-- Function to automatically update last_message_at when a message is sent
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_message_at
DROP TRIGGER IF EXISTS on_message_insert_update_conversation ON public.messages;
CREATE TRIGGER on_message_insert_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Update existing conversations with last_message_at from their latest message
UPDATE public.conversations c
SET last_message_at = (
  SELECT MAX(m.created_at)
  FROM public.messages m
  WHERE m.conversation_id = c.id
)
WHERE c.last_message_at IS NULL;

COMMENT ON COLUMN public.messages.read_at IS 'Timestamp when the recipient read the message';
COMMENT ON COLUMN public.conversations.last_message_at IS 'Timestamp of the most recent message for sorting';
