"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "./useSupabase";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id_1: string;
  user_id_2: string;
  last_message_at: string | null;
  created_at: string;
}

interface ConversationWithDetails extends Conversation {
  other_user: {
    id: string;
    display_name: string;
    role: string | null;
  };
  last_message?: {
    content: string;
    sender_id: string;
  };
  unread_count: number;
}

/**
 * Hook for realtime messaging in a conversation
 */
export function useRealtimeMessages(conversationId: string, initialMessages: Message[] = []) {
  const supabase = useSupabase();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  }, [supabase, conversationId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedId = (payload.old as Message).id;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to messages:', conversationId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not signed in' };

    const text = content.trim();
    if (!text) return { error: 'Message is empty' };

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
    });

    if (error) return { error: error.message };
    
    // Update conversation's last_message_at
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
    
    return {};
  }, [supabase, conversationId]);

  return {
    messages,
    loading,
    sendMessage,
    refetch: fetchMessages,
  };
}

/**
 * Hook for getting user's conversations with realtime updates
 */
export function useConversations() {
  const supabase = useSupabase();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Get conversations where user is participant
    const { data: convs, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error || !convs) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Enrich with other user info and last message
    const enriched = await Promise.all(
      convs.map(async (conv) => {
        const otherUserId = conv.user_id_1 === user.id ? conv.user_id_2 : conv.user_id_1;
        
        // Get other user's display info
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", otherUserId)
          .maybeSingle();
        
        let displayName = "User";
        const role = profile?.role || null;
        
        if (role === "personnel") {
          const { data: p } = await supabase
            .from("personnel")
            .select("display_name")
            .eq("user_id", otherUserId)
            .maybeSingle();
          displayName = p?.display_name || "Security";
        } else if (role === "venue") {
          const { data: v } = await supabase
            .from("venues")
            .select("name")
            .eq("owner_id", otherUserId)
            .maybeSingle();
          displayName = v?.name || "Venue";
        } else if (role === "agency") {
          const { data: a } = await supabase
            .from("agencies")
            .select("name")
            .eq("owner_id", otherUserId)
            .maybeSingle();
          displayName = a?.name || "Agency";
        }

        // Get last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, sender_id")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get unread count (messages from other user not yet read)
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("sender_id", otherUserId)
          .is("read_at", null);

        return {
          ...conv,
          other_user: {
            id: otherUserId,
            display_name: displayName,
            role,
          },
          last_message: lastMsg || undefined,
          unread_count: count || 0,
        } as ConversationWithDetails;
      })
    );

    setConversations(enriched);
    setLoading(false);
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to realtime conversation updates
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    };

    getUser().then(user => {
      if (!user) return;

      const channel = supabase
        .channel('conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          () => {
            // Refresh conversations list on any change
            fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          () => {
            // Refresh to update last message and unread counts
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, [supabase, fetchConversations]);

  return {
    conversations,
    loading,
    refetch: fetchConversations,
  };
}

/**
 * Hook for starting a conversation with another user
 */
export function useStartConversation() {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(false);

  const startConversation = useCallback(async (otherUserId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in" };

    if (user.id === otherUserId) return { error: "Cannot message yourself" };

    setLoading(true);
    const [u1, u2] = [user.id, otherUserId].sort();

    // Check for existing conversation
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id_1", u1)
      .eq("user_id_2", u2)
      .maybeSingle();

    if (existing?.id) {
      setLoading(false);
      return { id: existing.id };
    }

    // Create new conversation
    const { data: inserted, error } = await supabase
      .from("conversations")
      .insert({ user_id_1: u1, user_id_2: u2 })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      return { error: "Could not start conversation. This user may not have an account yet." };
    }
    
    return { id: inserted?.id };
  }, [supabase]);

  return { startConversation, loading };
}

/**
 * Hook to mark messages as read
 */
export function useMarkMessagesRead() {
  const supabase = useSupabase();

  const markRead = useCallback(async (conversationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Mark all messages from other users in this conversation as read
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .is("read_at", null);
  }, [supabase]);

  return { markRead };
}
