/**
 * UnreadMessagesContext
 * Tracks unread message counts across the app for badge display
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface UnreadMessagesContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
});

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!supabase || !userId) return;

    try {
      let totalUnread = 0;

      // Count unread group chat messages (Mission Control)
      // First get user's group chat memberships
      const { data: memberships } = await supabase
        .from("group_chat_members")
        .select("group_chat_id, last_read_at")
        .eq("user_id", userId);

      if (memberships && memberships.length > 0) {
        // For each membership, count messages after last_read_at
        for (const membership of memberships) {
          const { count } = await supabase
            .from("group_chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("group_chat_id", membership.group_chat_id)
            .neq("sender_id", userId)
            .gt("created_at", membership.last_read_at || "1970-01-01");

          totalUnread += count || 0;
        }
      }

      // Also try to count direct messages if the table exists
      try {
        const { data: conversations } = await supabase
          .from("direct_conversations")
          .select("id")
          .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

        if (conversations && conversations.length > 0) {
          const conversationIds = conversations.map((c) => c.id);

          const { count: dmCount } = await supabase
            .from("direct_messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", conversationIds)
            .neq("sender_id", userId)
            .eq("is_read", false);

          totalUnread += dmCount || 0;
        }
      } catch {
        // Direct messages table might not exist yet - that's okay
      }

      setUnreadCount(totalUnread);
    } catch (e) {
      console.error("Error fetching unread count:", e);
    }
  }, [userId]);

  // Initialize user
  useEffect(() => {
    if (!supabase) return;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
        setUnreadCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch unread count when userId changes
  useEffect(() => {
    if (userId) {
      refreshUnreadCount();
    }
  }, [userId, refreshUnreadCount]);

  // Subscribe to new messages for real-time updates
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_chat_messages",
        },
        (payload) => {
          const msg = payload.new as any;
          // If message is not from us, increment count
          if (msg.sender_id !== userId) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const msg = payload.new as any;
          // If message is not from us, increment count
          if (msg.sender_id !== userId) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
