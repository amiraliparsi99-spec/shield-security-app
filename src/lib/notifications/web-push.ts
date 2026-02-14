/**
 * Web Push Notification Utilities (Client-side)
 * For browser notifications on the web app
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    return "denied";
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

/**
 * Initialize push notifications and register service worker
 */
export async function initializePushNotifications(
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications not supported" };
  }

  try {
    // Request permission if not already granted
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return { success: false, error: "Permission denied" };
    }

    // Register service worker (if you have one)
    // For basic notifications, we don't strictly need this
    // but it's required for background notifications
    
    // Get user ID and save preference to database
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Save that user has enabled web notifications
      await supabase.from("notification_preferences").upsert({
        user_id: user.id,
        push_new_booking: true,
        push_new_message: true,
      }, {
        onConflict: "user_id"
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error initializing push notifications:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Show a local browser notification
 */
export function showLocalNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    tag?: string;
    data?: Record<string, any>;
    onClick?: () => void;
  }
): void {
  if (!isPushSupported() || Notification.permission !== "granted") {
    console.warn("Cannot show notification: not supported or permission denied");
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon || "/icon-192.png",
      tag: options?.tag,
      data: options?.data,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

/**
 * Subscribe to real-time notifications from Supabase
 */
export function subscribeToNotifications(
  supabase: SupabaseClient,
  userId: string,
  onNotification: (payload: any) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notification_log",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new);
        
        // Show browser notification
        const notification = payload.new as any;
        if (notification.title && notification.body) {
          showLocalNotification(notification.title, notification.body, {
            data: notification.data,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
