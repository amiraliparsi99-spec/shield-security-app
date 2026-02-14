import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import {
  registerForPushNotifications,
  getNotificationPermissions,
} from "../lib/push-notifications";

interface NotificationPrefs {
  push_new_booking: boolean;
  push_booking_confirmed: boolean;
  push_booking_cancelled: boolean;
  push_shift_reminder: boolean;
  push_payment_received: boolean;
  push_new_message: boolean;
  push_new_review: boolean;
  push_license_expiry: boolean;
  push_marketing: boolean;
  email_booking_summary: boolean;
  email_weekly_digest: boolean;
  email_payment_receipt: boolean;
  email_marketing: boolean;
  shift_reminder_hours: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  push_new_booking: true,
  push_booking_confirmed: true,
  push_booking_cancelled: true,
  push_shift_reminder: true,
  push_payment_received: true,
  push_new_message: true,
  push_new_review: true,
  push_license_expiry: true,
  push_marketing: false,
  email_booking_summary: true,
  email_weekly_digest: true,
  email_payment_receipt: true,
  email_marketing: false,
  shift_reminder_hours: 2,
};

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
    checkPermissions();
  }, []);

  const loadPreferences = async () => {
    try {
      const { profileId } = await getProfileIdAndRole(supabase);
      setUserId(profileId);

      if (profileId) {
        const { data } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", profileId)
          .single();

        if (data) {
          setPrefs(data);
        }
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    const status = await getNotificationPermissions();
    setPermissionStatus(status);
  };

  const handleEnablePush = async () => {
    const token = await registerForPushNotifications();
    if (token) {
      safeHaptic("success");
      Alert.alert("Success", "Push notifications enabled!");
      checkPermissions();
    } else {
      Alert.alert(
        "Permission Required",
        "Please enable notifications in your device settings",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleToggle = async (key: keyof NotificationPrefs, value: boolean) => {
    safeHaptic("selection");
    
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    // Save to database
    if (userId) {
      setSaving(true);
      try {
        await supabase
          .from("notification_preferences")
          .upsert({
            user_id: userId,
            ...newPrefs,
          });
      } catch (error) {
        console.error("Error saving preference:", error);
        // Revert on error
        setPrefs(prefs);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleReminderChange = async (hours: number) => {
    safeHaptic("selection");
    
    const newPrefs = { ...prefs, shift_reminder_hours: hours };
    setPrefs(newPrefs);

    if (userId) {
      await supabase
        .from("notification_preferences")
        .upsert({
          user_id: userId,
          ...newPrefs,
        });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 60 }}>
          {saving && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Permission Status */}
        {permissionStatus !== "granted" && (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>🔔</Text>
            <View style={styles.permissionContent}>
              <Text style={styles.permissionTitle}>Enable Push Notifications</Text>
              <Text style={styles.permissionText}>
                Get real-time updates about bookings, messages, and more
              </Text>
            </View>
            <TouchableOpacity style={styles.enableBtn} onPress={handleEnablePush}>
              <Text style={styles.enableBtnText}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Push Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>New Booking Available</Text>
              <Text style={styles.settingDesc}>When a new shift matches your profile</Text>
            </View>
            <Switch
              value={prefs.push_new_booking}
              onValueChange={(v) => handleToggle("push_new_booking", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Booking Confirmed</Text>
              <Text style={styles.settingDesc}>When your booking is confirmed</Text>
            </View>
            <Switch
              value={prefs.push_booking_confirmed}
              onValueChange={(v) => handleToggle("push_booking_confirmed", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Booking Cancelled</Text>
              <Text style={styles.settingDesc}>When a booking is cancelled</Text>
            </View>
            <Switch
              value={prefs.push_booking_cancelled}
              onValueChange={(v) => handleToggle("push_booking_cancelled", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Shift Reminder</Text>
              <Text style={styles.settingDesc}>Before your shift starts</Text>
            </View>
            <Switch
              value={prefs.push_shift_reminder}
              onValueChange={(v) => handleToggle("push_shift_reminder", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          {prefs.push_shift_reminder && (
            <View style={styles.reminderSelector}>
              <Text style={styles.reminderLabel}>Remind me</Text>
              <View style={styles.reminderOptions}>
                {[1, 2, 4, 24].map((hours) => (
                  <TouchableOpacity
                    key={hours}
                    style={[
                      styles.reminderOption,
                      prefs.shift_reminder_hours === hours && styles.reminderOptionActive,
                    ]}
                    onPress={() => handleReminderChange(hours)}
                  >
                    <Text
                      style={[
                        styles.reminderOptionText,
                        prefs.shift_reminder_hours === hours && styles.reminderOptionTextActive,
                      ]}
                    >
                      {hours}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Payment Received</Text>
              <Text style={styles.settingDesc}>When you receive a payment</Text>
            </View>
            <Switch
              value={prefs.push_payment_received}
              onValueChange={(v) => handleToggle("push_payment_received", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>New Message</Text>
              <Text style={styles.settingDesc}>When you receive a message</Text>
            </View>
            <Switch
              value={prefs.push_new_message}
              onValueChange={(v) => handleToggle("push_new_message", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>New Review</Text>
              <Text style={styles.settingDesc}>When someone leaves you a review</Text>
            </View>
            <Switch
              value={prefs.push_new_review}
              onValueChange={(v) => handleToggle("push_new_review", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>License Expiry Warning</Text>
              <Text style={styles.settingDesc}>When your SIA license is expiring</Text>
            </View>
            <Switch
              value={prefs.push_license_expiry}
              onValueChange={(v) => handleToggle("push_license_expiry", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* Email Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Booking Summary</Text>
              <Text style={styles.settingDesc}>Email summary of confirmed bookings</Text>
            </View>
            <Switch
              value={prefs.email_booking_summary}
              onValueChange={(v) => handleToggle("email_booking_summary", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Weekly Digest</Text>
              <Text style={styles.settingDesc}>Weekly summary of your activity</Text>
            </View>
            <Switch
              value={prefs.email_weekly_digest}
              onValueChange={(v) => handleToggle("email_weekly_digest", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Payment Receipts</Text>
              <Text style={styles.settingDesc}>Email receipts for payments</Text>
            </View>
            <Switch
              value={prefs.email_payment_receipt}
              onValueChange={(v) => handleToggle("email_payment_receipt", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* Marketing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marketing</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Marketing</Text>
              <Text style={styles.settingDesc}>Promotions and special offers</Text>
            </View>
            <Switch
              value={prefs.push_marketing}
              onValueChange={(v) => handleToggle("push_marketing", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Email Marketing</Text>
              <Text style={styles.settingDesc}>News, tips, and platform updates</Text>
            </View>
            <Switch
              value={prefs.email_marketing}
              onValueChange={(v) => handleToggle("email_marketing", v)}
              trackColor={{ false: colors.surfaceElevated, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  permissionIcon: {
    fontSize: 28,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  permissionText: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.8,
  },
  enableBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  enableBtnText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  settingDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  reminderSelector: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  reminderOptions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  reminderOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
  },
  reminderOptionActive: {
    backgroundColor: colors.accent,
  },
  reminderOptionText: {
    ...typography.body,
    color: colors.textMuted,
  },
  reminderOptionTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
});
