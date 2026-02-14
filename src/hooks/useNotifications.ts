"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useQuery, useMutation, useSupabase } from "./useSupabase";
import * as db from "@/lib/db";
import type { Notification, NotificationType } from "@/lib/database.types";

// Get user notifications
export function useNotifications(options?: {
  unreadOnly?: boolean;
  type?: NotificationType;
  limit?: number;
}) {
  const { user } = useUser();

  return useQuery<Notification[]>(
    async (supabase) => {
      if (!user) return [];
      return db.getUserNotifications(supabase, user.id, options);
    },
    [user?.id, JSON.stringify(options)]
  );
}

// Get unread count
export function useUnreadCount() {
  const { user } = useUser();
  const supabase = useSupabase();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const c = await db.getUnreadCount(supabase, user.id);
    setCount(c);
  }, [supabase, user?.id]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.id, fetchCount]);

  return { count, refetch: fetchCount };
}

// Mark notification as read
export function useMarkAsRead() {
  const { refetch } = useNotifications();
  const { refetch: refetchCount } = useUnreadCount();

  return useMutation<boolean, string>(
    async (supabase, notificationId) => {
      const result = await db.markAsRead(supabase, notificationId);
      refetch();
      refetchCount();
      return result;
    }
  );
}

// Mark all as read
export function useMarkAllAsRead() {
  const { user } = useUser();
  const { refetch } = useNotifications();
  const { refetch: refetchCount } = useUnreadCount();

  return useMutation<boolean, void>(
    async (supabase) => {
      if (!user) return false;
      const result = await db.markAllAsRead(supabase, user.id);
      refetch();
      refetchCount();
      return result;
    }
  );
}

// Delete notification
export function useDeleteNotification() {
  const { refetch } = useNotifications();
  const { refetch: refetchCount } = useUnreadCount();

  return useMutation<boolean, string>(
    async (supabase, notificationId) => {
      const result = await db.deleteNotification(supabase, notificationId);
      refetch();
      refetchCount();
      return result;
    }
  );
}
