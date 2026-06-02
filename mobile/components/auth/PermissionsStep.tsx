/**
 * PermissionsStep — final step of mobile signup.
 *
 * Renders two cards (Notifications, Location) with status pills and OS-level
 * "Allow" buttons. Polls permission status when the screen regains focus so
 * "Open Settings" -> grant -> back-to-app updates instantly.
 *
 * The Submit CTA is disabled until the required minimum is met:
 *   - notifications must be granted (always required)
 *   - if requireLocation, foreground must be granted (Always recommended,
 *     While Using accepted with a warning per product spec)
 *
 * The component reports captured permission state via onChange so the parent
 * can flush it to the personnel/venues/agencies row after signup.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { colors, gradients, radius, spacing, typography } from "../../theme";
import {
  checkLocation,
  checkNotifications,
  openAppSettings,
  requestLocationBackground,
  requestLocationForeground,
  requestNotifications,
  type LocationLevel,
  type LocationState,
  type NotificationsState,
} from "../../lib/signup-permissions";

export type PermissionsCapture = {
  notifications: {
    granted: boolean;
    token: string | null;
    grantedAt: string | null;
  };
  location: {
    level: LocationLevel | null;
    grantedAt: string | null;
  };
};

type Props = {
  /** Whether to also gate on location (personnel = true, venue/agency = false). */
  requireLocation: boolean;
  /** Called whenever permission state changes — parent stores latest snapshot. */
  onChange: (capture: PermissionsCapture) => void;
  /** Whether the parent's submit is currently in flight. */
  submitting?: boolean;
};

export function PermissionsStep({ requireLocation, onChange, submitting }: Props) {
  const [notifications, setNotifications] = useState<NotificationsState | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [busy, setBusy] = useState<"none" | "notifications" | "location-fg" | "location-bg">(
    "none"
  );
  const lastReportRef = useRef<string>("");

  const refresh = useCallback(async () => {
    const [n, l] = await Promise.all([checkNotifications(), checkLocation()]);
    setNotifications(n);
    setLocation(l);
  }, []);

  // Initial check + AppState listener so coming back from Settings refreshes UI.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Refresh whenever the screen regains focus (parent stack navigation).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Report state up to parent whenever it changes (de-dup with a stable string key).
  useEffect(() => {
    if (!notifications) return;
    const capture: PermissionsCapture = {
      notifications: {
        granted: notifications.granted,
        token: notifications.token,
        grantedAt: notifications.granted ? new Date().toISOString() : null,
      },
      location: requireLocation
        ? {
            level: location?.level ?? null,
            grantedAt:
              location && location.level !== "denied" ? new Date().toISOString() : null,
          }
        : { level: null, grantedAt: null },
    };
    const key = JSON.stringify(capture);
    if (key === lastReportRef.current) return;
    lastReportRef.current = key;
    onChange(capture);
  }, [notifications, location, requireLocation, onChange]);

  const onTapNotifications = useCallback(async () => {
    if (busy !== "none") return;
    setBusy("notifications");
    try {
      if (notifications?.blockedBySettings) {
        await openAppSettings();
        // user comes back via AppState listener which refreshes
        return;
      }
      const next = await requestNotifications();
      setNotifications(next);
    } finally {
      setBusy("none");
    }
  }, [busy, notifications]);

  const onTapLocation = useCallback(async () => {
    if (busy !== "none") return;
    if (!location) return;

    if (location.blockedBySettings) {
      setBusy("location-fg");
      try {
        await openAppSettings();
      } finally {
        setBusy("none");
      }
      return;
    }

    if (location.level === "denied") {
      setBusy("location-fg");
      try {
        const next = await requestLocationForeground();
        setLocation(next);
        // If iOS granted While Using, immediately try the upgrade prompt so
        // users see it as a single coherent flow rather than two separate taps.
        if (next.level === "while_using") {
          setBusy("location-bg");
          const upgraded = await requestLocationBackground();
          setLocation(upgraded);
        }
      } finally {
        setBusy("none");
      }
      return;
    }

    if (location.level === "while_using") {
      setBusy("location-bg");
      try {
        const next = await requestLocationBackground();
        setLocation(next);
        // If the OS already burned through the Always prompt and they tapped
        // "Don't Allow", the only path is Settings; surface that next tap.
      } finally {
        setBusy("none");
      }
      return;
    }
  }, [busy, location]);

  const notificationsReady = !!notifications?.granted;
  const locationReady = !requireLocation || !!(location && location.level !== "denied");

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroIconWrap}>
        <LinearGradient colors={gradients.accentSoft} style={styles.heroIcon}>
          <Text style={styles.heroIconText}>🔐</Text>
        </LinearGradient>
      </View>
      <Text style={styles.title}>Last thing — almost done</Text>
      <Text style={styles.subtitle}>
        Shield needs two permissions to keep you safe and connected.
      </Text>

      <PermissionCard
        icon="🔔"
        title="Notifications"
        body="Instant alerts for shift offers, attendance prompts, payment confirmations and incoming venue calls."
        statusPill={
          notifications?.granted
            ? { label: "Allowed", tone: "good" }
            : notifications?.blockedBySettings
              ? { label: "Blocked", tone: "bad" }
              : { label: "Required", tone: "warn" }
        }
        ctaLabel={
          notifications?.granted
            ? null
            : notifications?.blockedBySettings
              ? "Open Settings"
              : "Allow notifications"
        }
        ctaBusy={busy === "notifications"}
        onCta={onTapNotifications}
      />

      {requireLocation && (
        <PermissionCard
          icon="📍"
          title="Location"
          body={
            location?.level === "always"
              ? "Always-on tracking enabled. Venues will see your live ETA, and Shield can verify you arrived safely."
              : location?.level === "while_using"
                ? "While Using granted. We strongly recommend upgrading to Always so we can track your ETA before a shift, even if Shield is in the background."
                : "Shield uses your location to verify shift attendance, calculate ETAs to the venue, and protect you on the way to work."
          }
          statusPill={
            location?.level === "always"
              ? { label: "Always", tone: "good" }
              : location?.level === "while_using"
                ? { label: "While using", tone: "warn" }
                : location?.blockedBySettings
                  ? { label: "Blocked", tone: "bad" }
                  : { label: "Required", tone: "warn" }
          }
          ctaLabel={
            location?.level === "always"
              ? null
              : location?.blockedBySettings
                ? "Open Settings"
                : location?.level === "while_using"
                  ? "Upgrade to Always"
                  : "Allow location"
          }
          ctaBusy={busy === "location-fg" || busy === "location-bg"}
          onCta={onTapLocation}
        />
      )}

      {requireLocation && location?.level === "while_using" && (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>⚠️  You'll have limited tracking</Text>
          <Text style={styles.warnBody}>
            Without "Always" location, Shield can't verify your ETA to the venue when the app is
            in the background. Some venues may decline shifts from guards without Always
            location. You can change this any time in iOS Settings → Shield.
          </Text>
        </View>
      )}

      <View style={styles.statusRow}>
        <StatusDot ready={notificationsReady} label="Notifications" />
        {requireLocation && <StatusDot ready={locationReady} label="Location" />}
      </View>

      <Text style={styles.footnote}>
        We never share your location outside an active shift window. You can revoke either
        permission any time in iOS Settings → Shield.
      </Text>

      {submitting && (
        <Text style={styles.submittingHint}>Creating your account…</Text>
      )}
    </ScrollView>
  );
}

/**
 * Returns true once all required permissions are granted (per role).
 * Parent screens use this to enable/disable the Create Account button.
 */
export function permissionsReady(
  capture: PermissionsCapture | null,
  requireLocation: boolean
): boolean {
  if (!capture) return false;
  if (!capture.notifications.granted) return false;
  if (requireLocation) {
    if (capture.location.level === null || capture.location.level === "denied") return false;
  }
  return true;
}

// ============ Sub-components ============

type StatusTone = "good" | "warn" | "bad";

function PermissionCard({
  icon,
  title,
  body,
  statusPill,
  ctaLabel,
  ctaBusy,
  onCta,
}: {
  icon: string;
  title: string;
  body: string;
  statusPill: { label: string; tone: StatusTone };
  ctaLabel: string | null;
  ctaBusy?: boolean;
  onCta: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Text style={styles.cardIconText}>{icon}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View
          style={[
            styles.pill,
            statusPill.tone === "good"
              ? styles.pillGood
              : statusPill.tone === "warn"
                ? styles.pillWarn
                : styles.pillBad,
          ]}
        >
          <Text
            style={[
              styles.pillText,
              statusPill.tone === "good"
                ? styles.pillTextGood
                : statusPill.tone === "warn"
                  ? styles.pillTextWarn
                  : styles.pillTextBad,
            ]}
          >
            {statusPill.label}
          </Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
      {ctaLabel && (
        <TouchableOpacity
          style={[styles.cardCta, ctaBusy && styles.cardCtaBusy]}
          onPress={onCta}
          disabled={ctaBusy}
          activeOpacity={0.85}
        >
          <Text style={styles.cardCtaText}>{ctaBusy ? "Working…" : ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatusDot({ ready, label }: { ready: boolean; label: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, ready ? styles.dotReady : styles.dotPending]} />
      <Text style={[styles.dotLabel, ready ? styles.dotLabelReady : styles.dotLabelPending]}>
        {ready ? `${label} ready` : `${label} pending`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroIconWrap: { alignItems: "center", marginBottom: spacing.md },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
  },
  heroIconText: { fontSize: 32 },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconText: { fontSize: 18 },
  cardHeaderText: { flex: 1 },
  cardTitle: { ...typography.titleCard, color: colors.text },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pillGood: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(34,197,94,0.4)",
  },
  pillWarn: {
    backgroundColor: colors.warningSoft,
    borderColor: "rgba(245,158,11,0.4)",
  },
  pillBad: {
    backgroundColor: colors.errorSoft,
    borderColor: "rgba(239,68,68,0.4)",
  },
  pillText: { fontSize: 11, fontWeight: "700" },
  pillTextGood: { color: colors.success },
  pillTextWarn: { color: colors.warning },
  pillTextBad: { color: colors.error },
  cardBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  cardCta: {
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  cardCtaBusy: { opacity: 0.7 },
  cardCtaText: {
    ...typography.bodySmall,
    color: "#000",
    fontWeight: "700",
  },
  warnBox: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warnTitle: {
    ...typography.bodySmall,
    color: colors.warning,
    fontWeight: "700",
    marginBottom: 4,
  },
  warnBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotReady: { backgroundColor: colors.success },
  dotPending: { backgroundColor: colors.textMuted },
  dotLabel: { ...typography.caption, fontWeight: "600" },
  dotLabelReady: { color: colors.success },
  dotLabelPending: { color: colors.textMuted },
  footnote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 16,
  },
  submittingHint: {
    ...typography.caption,
    color: colors.accent,
    textAlign: "center",
    marginTop: spacing.md,
    fontWeight: "600",
  },
});
