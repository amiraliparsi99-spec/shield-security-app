import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../../lib/auth";
import { useCall } from "../../contexts/CallContext";
import { useTheme, ThemeMode } from "../../contexts/ThemeContext";
import { safeHaptic } from "../../lib/haptics";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { initiateCall, callState } = useCall();
  const { mode, setThemeMode, isDark, colors: themeColors } = useTheme();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({
    shifts: true,
    messages: true,
    payments: true,
    marketing: false,
  });

  const handleThemeChange = (newTheme: ThemeMode) => {
    safeHaptic('selection');
    setThemeMode(newTheme);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            if (supabase) {
              await supabase.auth.signOut();
            }
            await AsyncStorage.removeItem('shield_guest_role');
            router.replace('/');
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!supabase) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          const profile = await getProfileIdAndRole(supabase, session.user.id);
          if (!profile || profile.role !== "personnel") return;
          const pid = await getPersonnelId(supabase, profile.profileId);
          if (!pid) return;
          const { data: v } = await supabase
            .from("verifications")
            .select("status")
            .eq("owner_type", "personnel")
            .eq("owner_id", pid)
            .maybeSingle();
          setVerificationStatus(v?.status || null);
        } catch {}
      })();
    }, [])
  );

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contact Support', 'Please contact support@shield-security.app to delete your account.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Manage your app preferences</Text>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Theme</Text>
          <Text style={styles.cardSubtitle}>
            {isDark ? '🌙 Currently using dark mode' : '☀️ Currently using light mode'}
          </Text>
          <View style={styles.themeOptions}>
            {[
              { value: 'dark' as ThemeMode, label: 'Dark', icon: '🌙' },
              { value: 'light' as ThemeMode, label: 'Light', icon: '☀️' },
              { value: 'system' as ThemeMode, label: 'System', icon: '📱' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.themeOption,
                  mode === option.value && styles.themeOptionActive,
                ]}
                onPress={() => handleThemeChange(option.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.themeIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.themeLabel,
                    mode === option.value && styles.themeLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          {[
            { key: 'shifts', label: 'Shift Reminders', description: 'Get notified about upcoming shifts' },
            { key: 'messages', label: 'Messages', description: 'New message notifications' },
            { key: 'payments', label: 'Payments', description: 'Payment confirmations and updates' },
            { key: 'marketing', label: 'Marketing', description: 'Tips, news, and promotions' },
          ].map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.notificationRow,
                index < 3 && styles.notificationRowBorder,
              ]}
            >
              <View style={styles.notificationInfo}>
                <Text style={styles.notificationLabel}>{item.label}</Text>
                <Text style={styles.notificationDescription}>{item.description}</Text>
              </View>
              <Switch
                value={notifications[item.key as keyof typeof notifications]}
                onValueChange={(value) =>
                  setNotifications((prev) => ({ ...prev, [item.key]: value }))
                }
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.text}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              if (verificationStatus === "verified") {
                Alert.alert("Already Verified", "Your account has been verified. No further action is needed.");
              } else {
                router.push('/verification');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>{verificationStatus === "verified" ? "✅" : "📄"}</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Documents & Verification</Text>
              <Text style={styles.menuDescription}>
                {verificationStatus === "verified"
                  ? "Your account is verified"
                  : "Manage your SIA license and documents"}
              </Text>
            </View>
            {verificationStatus === "verified" ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            ) : (
              <Text style={styles.menuArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Coming Soon', 'Insurance management will be available soon.')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🛡️</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Insurance</Text>
              <Text style={styles.menuDescription}>Upload and verify insurance certificates</Text>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Coming Soon', 'Call history will be available soon.')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>📞</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Call History</Text>
              <Text style={styles.menuDescription}>View your past calls</Text>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Growth Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Growth</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/referrals")}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🎁</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Refer & Earn</Text>
              <Text style={styles.menuDescription}>Get £10 for each referral</Text>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/notification-settings")}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🔔</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Notifications</Text>
              <Text style={styles.menuDescription}>Manage push and email notifications</Text>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Help Center', 'Visit help.shield-security.app for FAQs and guides.')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>❓</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Help Center</Text>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Contact Support', 'Email: support@shield-security.app')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>💬</Text>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>Contact Support</Text>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.error }]}>Danger Zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.dangerButtonText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteButton]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={[styles.dangerButtonText, styles.deleteButtonText]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Version */}
      <Text style={styles.version}>Shield HQ v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  themeOptions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  themeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  themeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  themeLabelActive: {
    color: colors.accent,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  notificationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  notificationLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  notificationDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  menuInfo: {
    flex: 1,
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  menuDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  menuArrow: {
    ...typography.body,
    color: colors.textMuted,
  },
  verifiedBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  verifiedBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  dangerCard: {
    borderColor: colors.error + '40',
  },
  dangerButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dangerButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.error + '20',
    marginBottom: 0,
  },
  deleteButtonText: {
    color: colors.error,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
