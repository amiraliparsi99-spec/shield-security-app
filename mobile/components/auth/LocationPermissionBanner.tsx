/**
 * LocationPermissionBanner — persistent post-signup nudge for personnel.
 *
 * Personnel signup intentionally lets guards finish with only "While Using"
 * (or even "Denied") so we don't trap users behind an iOS Settings round-trip.
 * To still steer them to "Always" — which we need for accurate ETA tracking
 * before a shift starts — this banner sits at the top of the Account tab
 * until their OS-level location permission is "Always".
 *
 * Tapping it tries to upgrade in-app first; if iOS already burned through the
 * prompt, it deep-links to Settings. Re-checks on focus + AppState change.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { colors, radius, spacing, typography } from "../../theme";
import {
  checkLocation,
  openAppSettings,
  requestLocationBackground,
  requestLocationForeground,
  type LocationLevel,
} from "../../lib/signup-permissions";

export function LocationPermissionBanner() {
  const [level, setLevel] = useState<LocationLevel | null>(null);
  const [blockedBySettings, setBlockedBySettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const state = await checkLocation();
    setLevel(state.level);
    setBlockedBySettings(state.blockedBySettings);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onTap = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (blockedBySettings) {
        await openAppSettings();
        return;
      }
      if (level === "denied" || level === null) {
        const fg = await requestLocationForeground();
        if (fg.level === "while_using") {
          const upgraded = await requestLocationBackground();
          setLevel(upgraded.level);
          setBlockedBySettings(upgraded.blockedBySettings);
          return;
        }
        setLevel(fg.level);
        setBlockedBySettings(fg.blockedBySettings);
        return;
      }
      if (level === "while_using") {
        const upgraded = await requestLocationBackground();
        setLevel(upgraded.level);
        setBlockedBySettings(upgraded.blockedBySettings);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, level, blockedBySettings]);

  // Hide entirely once Always is granted.
  if (level === "always" || level === null) return null;

  const isDenied = level === "denied" || blockedBySettings;
  const title = isDenied ? "Location is off — tap to fix" : "Enable Always location";
  const body = isDenied
    ? "Shield can't track your ETA or verify shift attendance without location. Some venues may decline shifts from guards without it."
    : "You're set to While Using. For full live tracking before shifts (ETA, no-show prevention), upgrade to Always.";
  const ctaLabel = blockedBySettings ? "Open Settings" : isDenied ? "Allow location" : "Upgrade";

  return (
    <View style={[styles.banner, isDenied ? styles.bannerError : styles.bannerWarn]}>
      <View style={styles.bannerIcon}>
        <Text style={styles.bannerIconText}>{isDenied ? "📵" : "📍"}</Text>
      </View>
      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerSubtitle}>{body}</Text>
      </View>
      <TouchableOpacity
        style={styles.bannerCta}
        onPress={onTap}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text style={styles.bannerCtaText}>{ctaLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  bannerWarn: {
    backgroundColor: colors.warningSoft,
    borderColor: "rgba(245,158,11,0.45)",
  },
  bannerError: {
    backgroundColor: colors.errorSoft,
    borderColor: "rgba(239,68,68,0.5)",
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconText: { fontSize: 18 },
  bannerBody: { flex: 1 },
  bannerTitle: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  bannerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  bannerCta: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    minWidth: 80,
    alignItems: "center",
  },
  bannerCtaText: {
    ...typography.caption,
    color: "#000",
    fontWeight: "700",
  },
});
