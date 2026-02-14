/**
 * Push Notification Setup for Mobile App
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save token to database
 */
export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Check if it's a physical device
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  // Get the token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Add to your env
    });
    token = tokenData.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }

  // Configure for Android
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00D4AA",
    });
  }

  // Save token to database
  if (token) {
    await savePushToken(token);
  }

  return token;
}

/**
 * Save push token to Supabase
 */
async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token: token,
        platform: Platform.OS,
        device_name: Device.deviceName || "Unknown",
        is_active: true,
      },
      {
        onConflict: "user_id,token",
      }
    );

    if (error) {
      console.error("Error saving push token:", error);
    } else {
      console.log("Push token saved successfully");
    }
  } catch (error) {
    console.error("Error saving push token:", error);
  }
}

/**
 * Remove push token (on logout)
 */
export async function removePushToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    
    await supabase
      .from("push_tokens")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("token", tokenData.data);
  } catch (error) {
    console.error("Error removing push token:", error);
  }
}

/**
 * Handle notification received while app is foregrounded
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Handle notification tapped
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Set up default deep-link handler for tapped notifications.
 * Routes shift offer notifications to the accept-shift screen.
 *
 * Call this once from the root layout after the router is ready.
 */
export function setupNotificationDeepLinks(
  navigate: (path: string) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (!data) return;

    // Shift offer — open the accept-shift screen
    if (
      data.type === "new_shift_offer" &&
      data.shift_id &&
      typeof data.shift_id === "string"
    ) {
      navigate(`/accept-shift/${data.shift_id}?source=shift_offers`);
      return;
    }

    // Urgent shift (dispatcher) — also open accept-shift
    if (
      data.type === "urgent_shift_offer" &&
      data.shift_id &&
      typeof data.shift_id === "string"
    ) {
      navigate(`/accept-shift/${data.shift_id}?source=urgent`);
      return;
    }

    // Agency invitation — open invitations page
    if (
      data.type === "agency_invitation" &&
      data.invitation_id &&
      typeof data.invitation_id === "string"
    ) {
      navigate("/d/personnel/invitations");
      return;
    }

    // Shift claimed / confirmed — go to calendar
    if (data.type === "shift_claimed" || data.type === "urgent_shift_confirmed") {
      navigate("/(tabs)/account");
      return;
    }

    // Generic booking notification — go to explore
    if (data.booking_id) {
      navigate("/(tabs)/explore");
    }
  });
}

/**
 * Get notification permissions status
 */
export async function getNotificationPermissions(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
