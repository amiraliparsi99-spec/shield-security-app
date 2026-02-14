/**
 * Haptics Utility
 * Centralized haptic feedback management with safe fallbacks
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Check if device supports haptics
const isHapticsSupported = Platform.OS === "ios" || Platform.OS === "android";

/**
 * Impact feedback types
 */
export type ImpactType = "light" | "medium" | "heavy" | "rigid" | "soft";

/**
 * Notification feedback types
 */
export type NotificationType = "success" | "warning" | "error";

/**
 * Trigger impact haptic feedback
 */
export async function impact(type: ImpactType = "medium"): Promise<void> {
  if (!isHapticsSupported) return;

  try {
    const style = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
      rigid: Haptics.ImpactFeedbackStyle.Rigid,
      soft: Haptics.ImpactFeedbackStyle.Soft,
    }[type];

    await Haptics.impactAsync(style);
  } catch (error) {
    console.warn("Haptic feedback failed:", error);
  }
}

/**
 * Trigger notification haptic feedback
 */
export async function notification(type: NotificationType = "success"): Promise<void> {
  if (!isHapticsSupported) return;

  try {
    const style = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    }[type];

    await Haptics.notificationAsync(style);
  } catch (error) {
    console.warn("Haptic notification failed:", error);
  }
}

/**
 * Trigger selection haptic feedback
 */
export async function selection(): Promise<void> {
  if (!isHapticsSupported) return;

  try {
    await Haptics.selectionAsync();
  } catch (error) {
    console.warn("Haptic selection failed:", error);
  }
}

/**
 * Safe haptic with string type (legacy support)
 */
export function safeHaptic(type: string): void {
  switch (type) {
    case "light":
      impact("light");
      break;
    case "medium":
      impact("medium");
      break;
    case "heavy":
      impact("heavy");
      break;
    case "success":
      notification("success");
      break;
    case "warning":
      notification("warning");
      break;
    case "error":
      notification("error");
      break;
    case "selection":
      selection();
      break;
    default:
      impact("light");
  }
}

// Named exports for common patterns
export const haptics = {
  impact,
  notification,
  selection,
  safeHaptic,

  // Quick access methods
  tap: () => impact("light"),
  press: () => impact("medium"),
  longPress: () => impact("heavy"),
  success: () => notification("success"),
  warning: () => notification("warning"),
  error: () => notification("error"),
  select: () => selection(),
};

export default haptics;
