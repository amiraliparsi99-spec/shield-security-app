/**
 * Signup-time permission helpers.
 *
 * Mobile signup needs to request push + location permissions BEFORE the user
 * is logged in (so the gate fires while we're still collecting form data).
 * The existing helpers in lib/push-notifications.ts and services/location.ts
 * try to write to Supabase as a side-effect — that fails without a session.
 *
 * These wrappers capture the permission state without writing, returning a
 * compact summary the signup screen stores in component state. After
 * supabase.auth.signUp() succeeds the screen flushes the captured token /
 * permission level into the role-specific table (personnel, venues, agencies).
 */

import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

export type LocationLevel = "always" | "while_using" | "denied";

export type NotificationsState = {
  granted: boolean;
  /** OS-level status (granted | denied | undetermined). */
  status: Notifications.PermissionStatus;
  /** Expo push token (only present on real devices when granted). */
  token: string | null;
  /** True if user previously hit "Don't Allow" — they must visit Settings. */
  blockedBySettings: boolean;
};

export type LocationState = {
  level: LocationLevel;
  /** True if user previously denied; further prompts won't work — Settings only. */
  blockedBySettings: boolean;
};

/**
 * Read the current notification permission status without prompting.
 */
export async function checkNotifications(): Promise<NotificationsState> {
  if (!Device.isDevice) {
    // Simulators can't actually receive pushes but we still want to let
    // signup complete so devs aren't blocked.
    return { granted: true, status: "granted" as const, token: null, blockedBySettings: false };
  }

  const settings = await Notifications.getPermissionsAsync();
  const status = settings.status;
  const blockedBySettings = !settings.canAskAgain && status !== "granted";

  let token: string | null = null;
  if (status === "granted") {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });
      token = tokenData.data;
    } catch {
      token = null;
    }
  }

  return { granted: status === "granted", status, token, blockedBySettings };
}

/**
 * Prompt for notification permission. Returns the (possibly-new) state.
 * If iOS already returned "denied" once, this resolves immediately without
 * prompting — caller should use Linking.openSettings() in that case.
 */
export async function requestNotifications(): Promise<NotificationsState> {
  if (!Device.isDevice) {
    return { granted: true, status: "granted" as const, token: null, blockedBySettings: false };
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") {
    return checkNotifications();
  }

  if (!existing.canAskAgain) {
    return { granted: false, status: existing.status, token: null, blockedBySettings: true };
  }

  const result = await Notifications.requestPermissionsAsync();
  if (result.status !== "granted") {
    return {
      granted: false,
      status: result.status,
      token: null,
      blockedBySettings: !result.canAskAgain,
    };
  }

  // Configure the default Android channel up-front so notifications display
  // with the right importance from day one.
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00D4AA",
      });
    } catch {
      // non-fatal
    }
  }

  return checkNotifications();
}

/**
 * Read the current location permission level without prompting.
 */
export async function checkLocation(): Promise<LocationState> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return {
      level: "denied",
      blockedBySettings: !fg.canAskAgain && fg.status !== "granted",
    };
  }

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === "granted") {
    return { level: "always", blockedBySettings: false };
  }

  return {
    level: "while_using",
    blockedBySettings: !bg.canAskAgain && bg.status !== "granted",
  };
}

/**
 * Prompt for foreground (While Using) location permission. iOS forces this
 * step before "Always" can ever be requested.
 */
export async function requestLocationForeground(): Promise<LocationState> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === "granted") {
    return checkLocation();
  }
  if (!existing.canAskAgain) {
    return { level: "denied", blockedBySettings: true };
  }

  const result = await Location.requestForegroundPermissionsAsync();
  if (result.status !== "granted") {
    return { level: "denied", blockedBySettings: !result.canAskAgain };
  }

  // After foreground granted, return — caller decides whether to upgrade
  // to "Always" via requestLocationBackground.
  return checkLocation();
}

/**
 * Prompt to upgrade to "Always" location permission. Foreground must already
 * be granted or this is a no-op.
 */
export async function requestLocationBackground(): Promise<LocationState> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { level: "denied", blockedBySettings: !fg.canAskAgain };
  }

  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === "granted") {
    return { level: "always", blockedBySettings: false };
  }
  if (!existing.canAskAgain) {
    return { level: "while_using", blockedBySettings: true };
  }

  const result = await Location.requestBackgroundPermissionsAsync();
  if (result.status === "granted") {
    return { level: "always", blockedBySettings: false };
  }
  return { level: "while_using", blockedBySettings: !result.canAskAgain };
}

/**
 * Open the OS settings page so the user can manually flip a previously
 * denied permission. Falls back to Linking.openSettings() (RN built-in)
 * which works on both iOS and Android.
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // ignore — there's no fallback we can reasonably take.
  }
}
