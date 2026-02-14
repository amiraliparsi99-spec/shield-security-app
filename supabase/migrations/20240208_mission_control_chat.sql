-- Mission Control: Auto-created group chats for bookings
-- Creates a group chat when booking is confirmed connecting venue + all assigned personnel

-- Group Chats table
CREATE TABLE IF NOT EXISTS public.group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  chat_type TEXT NOT NULL DEFAULT 'mission_control', -- 'mission_control', 'agency_team', 'custom'
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  event_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Group Chat Members
CREATE TABLE IF NOT EXISTS public.group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'manager', 'member'
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  UNIQUE(group_chat_id, user_id)
);

-- Group Chat Messages
CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'location', 'image', 'system', 'checkin'
  metadata JSONB DEFAULT '{}', -- For location pins, images, etc.
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_chats_booking ON public.group_chats(booking_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_venue ON public.group_chats(venue_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_active ON public.group_chats(is_active, event_date);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user ON public.group_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_chat ON public.group_chat_members(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_chat ON public.group_chat_messages(group_chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_sender ON public.group_chat_messages(sender_id);

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check membership WITHOUT triggering RLS recursion
-- SECURITY DEFINER bypasses RLS, so no infinite loop
CREATE OR REPLACE FUNCTION public.is_group_chat_member(p_chat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_chat_members
    WHERE group_chat_id = p_chat_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_group_chat_member(UUID) TO authenticated;

-- RLS Policies for group_chats (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view group chats they are members of" ON public.group_chats;
CREATE POLICY "Users can view group chats they are members of"
  ON public.group_chats FOR SELECT
  USING (public.is_group_chat_member(id));

DROP POLICY IF EXISTS "Venue owners can create group chats" ON public.group_chats;
CREATE POLICY "Venue owners can create group chats"
  ON public.group_chats FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Chat owners can update group chats" ON public.group_chats;
CREATE POLICY "Chat owners can update group chats"
  ON public.group_chats FOR UPDATE
  USING (public.is_group_chat_member(id));

-- RLS Policies for group_chat_members (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view members of their group chats" ON public.group_chat_members;
CREATE POLICY "Users can view members of their group chats"
  ON public.group_chat_members FOR SELECT
  USING (public.is_group_chat_member(group_chat_id));

DROP POLICY IF EXISTS "Chat owners can add members" ON public.group_chat_members;
CREATE POLICY "Chat owners can add members"
  ON public.group_chat_members FOR INSERT
  WITH CHECK (true); -- Insertion handled by SECURITY DEFINER functions

DROP POLICY IF EXISTS "Users can update their own membership" ON public.group_chat_members;
CREATE POLICY "Users can update their own membership"
  ON public.group_chat_members FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for group_chat_messages (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Members can view messages in their group chats" ON public.group_chat_messages;
CREATE POLICY "Members can view messages in their group chats"
  ON public.group_chat_messages FOR SELECT
  USING (public.is_group_chat_member(group_chat_id));

DROP POLICY IF EXISTS "Members can send messages to their group chats" ON public.group_chat_messages;
CREATE POLICY "Members can send messages to their group chats"
  ON public.group_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_group_chat_member(group_chat_id)
  );

-- Function to create Mission Control chat for a booking
CREATE OR REPLACE FUNCTION public.create_mission_control_chat(
  p_booking_id UUID
) RETURNS UUID AS $$
DECLARE
  v_chat_id UUID;
  v_booking RECORD;
  v_venue RECORD;
  v_shift RECORD;
  v_personnel RECORD;
BEGIN
  -- Get booking details
  SELECT b.*, v.name as venue_name, v.id as v_id, v.user_id as venue_owner_id
  INTO v_booking
  FROM public.bookings b
  JOIN public.venues v ON b.venue_id = v.id
  WHERE b.id = p_booking_id;
  
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Check if chat already exists for this booking
  SELECT id INTO v_chat_id 
  FROM public.group_chats 
  WHERE booking_id = p_booking_id AND chat_type = 'mission_control';
  
  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;
  
  -- Create the group chat
  INSERT INTO public.group_chats (
    name,
    booking_id,
    venue_id,
    chat_type,
    created_by,
    event_date,
    metadata
  ) VALUES (
    v_booking.event_name || ' - Security Team',
    p_booking_id,
    v_booking.v_id,
    'mission_control',
    v_booking.venue_owner_id,
    v_booking.event_date::date,
    jsonb_build_object(
      'event_name', v_booking.event_name,
      'venue_name', v_booking.venue_name,
      'start_time', v_booking.start_time,
      'end_time', v_booking.end_time
    )
  ) RETURNING id INTO v_chat_id;
  
  -- Add venue owner as chat owner
  INSERT INTO public.group_chat_members (group_chat_id, user_id, role, display_name)
  VALUES (v_chat_id, v_booking.venue_owner_id, 'owner', v_booking.venue_name);
  
  -- Add all assigned personnel as members
  FOR v_shift IN 
    SELECT s.personnel_id 
    FROM public.shifts s 
    WHERE s.booking_id = p_booking_id 
    AND s.personnel_id IS NOT NULL
  LOOP
    -- Get personnel details
    SELECT p.user_id, p.display_name 
    INTO v_personnel
    FROM public.personnel p 
    WHERE p.id = v_shift.personnel_id;
    
    IF v_personnel.user_id IS NOT NULL THEN
      INSERT INTO public.group_chat_members (group_chat_id, user_id, role, display_name)
      VALUES (v_chat_id, v_personnel.user_id, 'member', v_personnel.display_name)
      ON CONFLICT (group_chat_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
  
  -- Send welcome system message
  INSERT INTO public.group_chat_messages (group_chat_id, sender_id, content, message_type)
  VALUES (
    v_chat_id, 
    v_booking.venue_owner_id, 
    '🛡️ Mission Control activated for ' || v_booking.event_name || '. All team members are connected. Share updates, locations, and coordinate here.',
    'system'
  );
  
  RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_mission_control_chat(UUID) TO authenticated;

-- Function to add a new member when shift is assigned
-- Also creates the Mission Control chat if it doesn't exist yet
CREATE OR REPLACE FUNCTION public.add_to_mission_control_on_shift_assign()
RETURNS TRIGGER AS $$
DECLARE
  v_chat_id UUID;
  v_personnel RECORD;
BEGIN
  -- Only trigger when personnel_id is set (not null) and wasn't set before
  IF NEW.personnel_id IS NOT NULL AND (OLD.personnel_id IS NULL OR OLD.personnel_id != NEW.personnel_id) THEN
    -- Find the mission control chat for this booking
    SELECT id INTO v_chat_id 
    FROM public.group_chats 
    WHERE booking_id = NEW.booking_id AND chat_type = 'mission_control';
    
    -- If chat doesn't exist yet, create it automatically
    IF v_chat_id IS NULL THEN
      v_chat_id := public.create_mission_control_chat(NEW.booking_id);
    END IF;
    
    -- If chat exists (or was just created), add the new personnel
    IF v_chat_id IS NOT NULL THEN
      SELECT p.user_id, p.display_name 
      INTO v_personnel
      FROM public.personnel p 
      WHERE p.id = NEW.personnel_id;
      
      IF v_personnel.user_id IS NOT NULL THEN
        INSERT INTO public.group_chat_members (group_chat_id, user_id, role, display_name)
        VALUES (v_chat_id, v_personnel.user_id, 'member', v_personnel.display_name)
        ON CONFLICT (group_chat_id, user_id) DO NOTHING;
        
        -- Send system message about new member
        INSERT INTO public.group_chat_messages (group_chat_id, sender_id, content, message_type)
        VALUES (
          v_chat_id, 
          v_personnel.user_id, 
          v_personnel.display_name || ' has joined the security team',
          'system'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_add_to_mission_control ON public.shifts;
CREATE TRIGGER trigger_add_to_mission_control
  AFTER UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.add_to_mission_control_on_shift_assign();

-- Enable realtime for group chat messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'group_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE public.group_chats IS 'Group chat rooms, including Mission Control chats auto-created for bookings';
COMMENT ON TABLE public.group_chat_members IS 'Members of group chats with their roles';
COMMENT ON TABLE public.group_chat_messages IS 'Messages in group chats';
COMMENT ON FUNCTION public.create_mission_control_chat IS 'Creates a Mission Control group chat for a booking, adding venue owner and all assigned personnel';
