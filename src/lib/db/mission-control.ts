import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export interface GroupChat {
  id: string;
  name: string;
  booking_id: string | null;
  venue_id: string | null;
  chat_type: string;
  created_by: string;
  is_active: boolean;
  event_date: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GroupChatMember {
  id: string;
  group_chat_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'member';
  display_name: string | null;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
}

export interface GroupChatMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'location' | 'image' | 'system' | 'checkin';
  metadata: Record<string, any>;
  is_pinned: boolean;
  created_at: string;
  sender?: {
    display_name: string;
    role: string;
  };
}

/**
 * Create Mission Control chat for a booking
 * This creates a group chat with the venue owner and all assigned personnel
 */
export async function createMissionControlChat(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<{ chatId: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('create_mission_control_chat', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('Error creating Mission Control chat:', error);
      return { chatId: null, error: error.message };
    }

    return { chatId: data, error: null };
  } catch (e) {
    console.error('Exception creating Mission Control chat:', e);
    return { chatId: null, error: 'Failed to create chat' };
  }
}

/**
 * Get all group chats for the current user
 */
export async function getUserGroupChats(
  supabase: TypedSupabaseClient
): Promise<GroupChat[]> {
  try {
    // First check if the user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user authenticated for group chats');
      return [];
    }

    // Simple query - just get chats (RLS will filter to user's chats)
    const { data, error } = await supabase
      .from('group_chats')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('Group chats table not yet created. Run the mission_control_chat migration.');
        return [];
      }
      console.error('Error fetching group chats:', error.message || error.code || JSON.stringify(error));
      return [];
    }

    return data || [];
  } catch (e: any) {
    console.error('Exception fetching group chats:', e.message || e);
    return [];
  }
}

/**
 * Get a specific group chat with members
 */
export async function getGroupChat(
  supabase: TypedSupabaseClient,
  chatId: string
): Promise<{ chat: GroupChat | null; members: GroupChatMember[] }> {
  const [chatResult, membersResult] = await Promise.all([
    supabase
      .from('group_chats')
      .select('*')
      .eq('id', chatId)
      .single(),
    supabase
      .from('group_chat_members')
      .select('*')
      .eq('group_chat_id', chatId)
      .order('role', { ascending: true })
  ]);

  return {
    chat: chatResult.data,
    members: membersResult.data || []
  };
}

/**
 * Get messages for a group chat
 */
export async function getGroupChatMessages(
  supabase: TypedSupabaseClient,
  chatId: string,
  limit: number = 50
): Promise<GroupChatMessage[]> {
  const { data, error } = await supabase
    .from('group_chat_messages')
    .select('*')
    .eq('group_chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

/**
 * Send a message to a group chat
 */
export async function sendGroupMessage(
  supabase: TypedSupabaseClient,
  chatId: string,
  content: string,
  messageType: 'text' | 'location' | 'image' | 'checkin' = 'text',
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('group_chat_messages')
    .insert({
      group_chat_id: chatId,
      sender_id: user.id,
      content,
      message_type: messageType,
      metadata
    });

  if (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }

  // Update chat's updated_at
  await supabase
    .from('group_chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId);

  return { success: true, error: null };
}

/**
 * Send a location pin to the group chat
 */
export async function sendLocationPin(
  supabase: TypedSupabaseClient,
  chatId: string,
  label: string,
  latitude: number,
  longitude: number,
  notes?: string
): Promise<{ success: boolean; error: string | null }> {
  return sendGroupMessage(
    supabase,
    chatId,
    `📍 ${label}${notes ? `: ${notes}` : ''}`,
    'location',
    { latitude, longitude, label, notes }
  );
}

/**
 * Send a check-in message
 */
export async function sendCheckInMessage(
  supabase: TypedSupabaseClient,
  chatId: string,
  status: 'arriving' | 'on_site' | 'position' | 'break' | 'leaving',
  notes?: string
): Promise<{ success: boolean; error: string | null }> {
  const statusMessages = {
    arriving: "🚗 On my way, ETA 5 mins",
    on_site: "✅ Arrived on site",
    position: "📍 In position",
    break: "☕ Taking a break",
    leaving: "👋 Shift complete, leaving"
  };

  const content = notes || statusMessages[status];
  
  return sendGroupMessage(
    supabase,
    chatId,
    content,
    'checkin',
    { status, timestamp: new Date().toISOString() }
  );
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  supabase: TypedSupabaseClient,
  chatId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('group_chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('group_chat_id', chatId)
    .eq('user_id', user.id);
}

/**
 * Get Mission Control chat for a booking
 */
export async function getMissionControlForBooking(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<GroupChat | null> {
  const { data, error } = await supabase
    .from('group_chats')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('chat_type', 'mission_control')
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Subscribe to new messages in a group chat
 */
export function subscribeToGroupChat(
  supabase: TypedSupabaseClient,
  chatId: string,
  onMessage: (message: GroupChatMessage) => void
) {
  const channel = supabase
    .channel(`group_chat:${chatId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_chat_messages',
        filter: `group_chat_id=eq.${chatId}`
      },
      (payload) => {
        onMessage(payload.new as GroupChatMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
