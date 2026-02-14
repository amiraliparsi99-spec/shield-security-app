/**
 * ShiftOfferPopup — Uber-style full-screen shift offer overlay
 *
 * Appears automatically when a new shift offer arrives via Supabase Realtime.
 * Features: countdown timer, venue info, earnings breakdown, swipe-to-accept.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useShiftOffer } from "../../contexts/ShiftOfferContext";
import { colors, typography, spacing, radius } from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;

export function ShiftOfferPopup() {
  const insets = useSafeAreaInsets();
  const { currentOffer, countdown, accepting, acceptOffer, declineOffer, dismissOffer } =
    useShiftOffer();

  // Animations
  const cardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const accepted = useRef(false);

  // Reset animations when a new offer appears
  useEffect(() => {
    if (currentOffer) {
      accepted.current = false;
      cardAnim.setValue(0);
      successAnim.setValue(0);
      slideAnim.setValue(0);

      // Slide card in
      Animated.spring(cardAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Pulse the accept button
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [currentOffer?.id]);

  // Swipe-to-accept gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          slideAnim.setValue(Math.min(gs.dx, SWIPE_THRESHOLD));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx >= SWIPE_THRESHOLD * 0.6) {
          Animated.spring(slideAnim, {
            toValue: SWIPE_THRESHOLD,
            useNativeDriver: true,
          }).start(() => {
            handleAccept();
          });
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleAccept = async () => {
    if (accepted.current) return;
    accepted.current = true;

    Animated.timing(successAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    await acceptOffer();
  };

  if (!currentOffer) return null;

  // Calculate earnings
  const calcEarnings = () => {
    if (!currentOffer.start_time || !currentOffer.end_time) {
      return { hours: 0, total: 0 };
    }
    // Parse HH:MM format
    const [sh, sm] = currentOffer.start_time.split(":").map(Number);
    const [eh, em] = currentOffer.end_time.split(":").map(Number);
    let hours = eh + em / 60 - (sh + sm / 60);
    if (hours <= 0) hours += 24; // overnight shift
    const total = hours * currentOffer.hourly_rate;
    return { hours: Math.round(hours * 10) / 10, total };
  };

  const { hours, total } = calcEarnings();
  const isUrgent = countdown <= 15;

  // Success overlay
  if (accepted.current && accepting) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={["rgba(0, 212, 170, 0.2)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.successBox,
              {
                opacity: successAnim,
                transform: [
                  {
                    scale: successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Shift Accepted!</Text>
            <Text style={styles.successSub}>
              You're booked at {currentOffer.venue_name}
            </Text>
            <Text style={styles.successEarnings}>You'll earn £{total.toFixed(2)}</Text>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Dark backdrop */}
        <LinearGradient
          colors={["rgba(0,0,0,0.85)", "rgba(12,13,16,0.95)"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header: close + countdown */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={dismissOffer}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View
            style={[
              styles.timerBadge,
              isUrgent && { backgroundColor: "rgba(239,68,68,0.3)" },
            ]}
          >
            <Text style={[styles.timerTxt, isUrgent && { color: "#ef4444" }]}>
              {countdown}s
            </Text>
          </View>
        </View>

        {/* NEW SHIFT banner */}
        <LinearGradient
          colors={["rgba(45,212,191,0.25)", "rgba(45,212,191,0.05)"]}
          style={styles.banner}
        >
          <Text style={styles.bannerTxt}>📋 NEW SHIFT AVAILABLE</Text>
        </LinearGradient>

        {/* Main card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [120, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Venue */}
          <View style={styles.venueRow}>
            <View style={styles.venueIcon}>
              <Text style={{ fontSize: 24 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueName} numberOfLines={1}>
                {currentOffer.venue_name ?? "Venue"}
              </Text>
              {currentOffer.venue_address ? (
                <Text style={styles.venueAddr} numberOfLines={1}>
                  {currentOffer.venue_address}
                </Text>
              ) : null}
              {currentOffer.distance_miles != null && (
                <Text style={styles.distanceTxt}>
                  {currentOffer.distance_miles.toFixed(1)} miles away
                </Text>
              )}
            </View>
          </View>

          {/* Date + Time */}
          <View style={styles.dtRow}>
            <View style={styles.dtBlock}>
              <Text style={styles.dtLabel}>DATE</Text>
              <Text style={styles.dtValue}>{currentOffer.shift_date ?? "TBC"}</Text>
            </View>
            <View style={styles.dtBlock}>
              <Text style={styles.dtLabel}>TIME</Text>
              <Text style={styles.dtValue}>
                {currentOffer.start_time ?? "—"} – {currentOffer.end_time ?? "—"}
              </Text>
            </View>
          </View>

          {/* Earnings */}
          <View style={styles.earningsSection}>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Hourly Rate</Text>
              <Text style={styles.earningsVal}>£{currentOffer.hourly_rate.toFixed(2)}/hr</Text>
            </View>
            {hours > 0 && (
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Duration</Text>
                <Text style={styles.earningsVal}>{hours} hours</Text>
              </View>
            )}
            <View style={styles.earningsDivider} />
            <View style={styles.earningsRow}>
              <Text style={styles.totalLabel}>Total Earnings</Text>
              <Text style={styles.totalVal}>£{total.toFixed(2)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Swipe to accept */}
        <View style={styles.actionArea}>
          <Animated.View
            style={[styles.swipeTrack, { transform: [{ scale: pulseAnim }] }]}
          >
            <LinearGradient
              colors={[colors.accent, "#1fa89e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.swipeGradient}
            >
              <Text style={styles.swipeHint}>Swipe to Accept →</Text>
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.swipeThumb,
                  { transform: [{ translateX: slideAnim }] },
                ]}
              >
                <View style={styles.thumbInner}>
                  <Text style={styles.thumbTxt}>→</Text>
                </View>
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          {/* Tap to accept fallback */}
          <TouchableOpacity
            style={styles.tapBtn}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Text style={styles.tapTxt}>
              {accepting ? "Accepting..." : "Or tap here to accept"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Decline */}
        <TouchableOpacity
          style={[styles.declineBtn, { marginBottom: insets.bottom + 10 }]}
          onPress={declineOffer}
        >
          <Text style={styles.declineTxt}>Decline</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ——— Styles ———

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  closeTxt: { fontSize: 18, color: colors.text },
  timerBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(45,212,191,0.2)",
    borderRadius: radius.full,
  },
  timerTxt: { color: colors.accent, fontWeight: "700", fontSize: 14 },

  // Banner
  banner: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  bannerTxt: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 1,
  },

  // Card
  card: {
    flex: 1,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  venueIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  venueName: {
    ...typography.title,
    color: colors.text,
  },
  venueAddr: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  distanceTxt: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 4,
    fontWeight: "600",
  },

  // Date/time
  dtRow: {
    flexDirection: "row",
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  dtBlock: { flex: 1 },
  dtLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  dtValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 4,
  },

  // Earnings
  earningsSection: {
    paddingTop: spacing.sm,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  earningsLabel: { ...typography.body, color: colors.textMuted },
  earningsVal: { ...typography.body, color: colors.text },
  earningsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: { ...typography.body, color: colors.text, fontWeight: "600" },
  totalVal: { ...typography.title, color: colors.accent, fontSize: 24 },

  // Swipe area
  actionArea: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  swipeTrack: {
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
  },
  swipeGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  swipeHint: {
    flex: 1,
    textAlign: "center",
    ...typography.body,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  swipeThumb: {
    position: "absolute",
    left: 6,
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
  },
  thumbInner: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbTxt: { fontSize: 24, fontWeight: "700", color: colors.accent },
  tapBtn: { alignItems: "center", marginTop: spacing.md },
  tapTxt: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },

  // Decline
  declineBtn: { alignItems: "center", paddingVertical: spacing.md },
  declineTxt: { ...typography.body, color: colors.textMuted },

  // Success
  successBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  successIcon: { fontSize: 80, marginBottom: spacing.lg },
  successTitle: {
    ...typography.display,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successSub: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  successEarnings: {
    ...typography.title,
    color: colors.accent,
    fontSize: 28,
  },
});
