/**
 * Push Notification Service
 * Handles sending push notifications via Expo
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface PushNotification {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export type NotificationType =
  | "new_booking"
  | "booking_confirmed"
  | "booking_cancelled"
  | "shift_reminder"
  | "payment_received"
  | "new_message"
  | "new_review"
  | "license_expiry"
  | "referral_reward"
  | "marketing";

// Expo push notification endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send push notification to a user
 */
export async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Check if user has this notification type enabled
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", payload.userId)
      .single();

    // Map notification type to preference field
    const prefField = `push_${payload.type}` as keyof typeof prefs;
    if (prefs && prefs[prefField] === false) {
      console.log(`User ${payload.userId} has disabled ${payload.type} notifications`);
      return false;
    }

    // Get user's push tokens
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", payload.userId)
      .eq("is_active", true);

    if (!tokens || tokens.length === 0) {
      console.log(`No active push tokens for user ${payload.userId}`);
      return false;
    }

    // Prepare notifications for all devices
    const notifications: PushNotification[] = tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        ...payload.data,
      },
      sound: "default",
    }));

    // Send via Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(notifications),
    });

    const result = await response.json();

    // Log notification
    await supabase.from("notification_log").insert({
      user_id: payload.userId,
      notification_type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      status: response.ok ? "sent" : "failed",
      error_message: response.ok ? null : JSON.stringify(result),
    });

    // Handle invalid tokens
    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          // Deactivate invalid token
          await supabase
            .from("push_tokens")
            .update({ is_active: false })
            .eq("token", tokens[i].token);
        }
      }
    }

    return response.ok;
  } catch (error) {
    console.error("Push notification error:", error);
    return false;
  }
}

/**
 * Send push to multiple users
 */
export async function sendBulkPushNotifications(
  userIds: string[],
  notification: Omit<NotificationPayload, "userId">
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const success = await sendPushNotification({ ...notification, userId });
    if (success) sent++;
    else failed++;
  }

  return { sent, failed };
}

/**
 * Pre-built notification templates
 */
export const NotificationTemplates = {
  newBooking: (venueName: string, date: string, rate: number) => ({
    type: "new_booking" as NotificationType,
    title: "New Shift Available! 🎉",
    body: `${venueName} needs security on ${date}. £${(rate / 100).toFixed(0)}/hr`,
  }),

  bookingConfirmed: (venueName: string, date: string) => ({
    type: "booking_confirmed" as NotificationType,
    title: "Booking Confirmed ✓",
    body: `Your shift at ${venueName} on ${date} has been confirmed`,
  }),

  bookingCancelled: (venueName: string, date: string) => ({
    type: "booking_cancelled" as NotificationType,
    title: "Booking Cancelled",
    body: `The shift at ${venueName} on ${date} has been cancelled`,
  }),

  shiftReminder: (venueName: string, time: string) => ({
    type: "shift_reminder" as NotificationType,
    title: "Shift Starting Soon ⏰",
    body: `Your shift at ${venueName} starts at ${time}`,
  }),

  paymentReceived: (amount: number) => ({
    type: "payment_received" as NotificationType,
    title: "Payment Received 💰",
    body: `You've been paid £${(amount / 100).toFixed(2)}`,
  }),

  newMessage: (senderName: string) => ({
    type: "new_message" as NotificationType,
    title: "New Message 💬",
    body: `${senderName} sent you a message`,
  }),

  newReview: (rating: number, reviewerName: string) => ({
    type: "new_review" as NotificationType,
    title: `New ${rating}★ Review! ⭐`,
    body: `${reviewerName} left you a review`,
  }),

  licenseExpiry: (daysLeft: number) => ({
    type: "license_expiry" as NotificationType,
    title: "SIA License Expiring ⚠️",
    body: `Your SIA license expires in ${daysLeft} days. Renew now!`,
  }),

  referralReward: (amount: number) => ({
    type: "referral_reward" as NotificationType,
    title: "Referral Bonus! 🎁",
    body: `You earned £${(amount / 100).toFixed(0)} from a successful referral`,
  }),
};
