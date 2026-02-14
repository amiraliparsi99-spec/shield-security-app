/**
 * Accept Shift Screen - Uber-like booking acceptance flow
 * Shows shift details and allows instant acceptance
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Vibration,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../../lib/auth";
import { safeHaptic } from "../../lib/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.6;

interface ShiftDetails {
  id: string;
  title: string;
  shift_type: string;
  location_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  positions_available: number;
  positions_filled: number;
  urgency: string;
  sia_required: boolean;
  description?: string;
  venue?: { name: string; city: string; address?: string };
  agency?: { name: string; city: string };
}

const SHIFT_TYPES: Record<string, { label: string; icon: string }> = {
  door_supervisor: { label: "Door Supervisor", icon: "🚪" },
  cctv_operator: { label: "CCTV Operator", icon: "📹" },
  close_protection: { label: "Close Protection", icon: "🛡️" },
  event_security: { label: "Event Security", icon: "🎪" },
  retail_security: { label: "Retail Security", icon: "🛒" },
  corporate_security: { label: "Corporate Security", icon: "🏢" },
  mobile_patrol: { label: "Mobile Patrol", icon: "🚗" },
  static_guard: { label: "Static Guard", icon: "🧍" },
  concierge: { label: "Concierge", icon: "🎩" },
  other: { label: "Other", icon: "📋" },
};

export default function AcceptShiftScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState<ShiftDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  // Swipe to accept
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        safeHaptic("light");
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          slideAnim.setValue(Math.min(gestureState.dx, SWIPE_THRESHOLD));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= SWIPE_THRESHOLD * 0.8) {
          // Swipe completed
          Animated.spring(slideAnim, {
            toValue: SWIPE_THRESHOLD,
            useNativeDriver: true,
          }).start(() => {
            handleAccept();
          });
        } else {
          // Reset
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    loadShiftAndUser();
    startAnimations();
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (shift && !accepted && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !accepted) {
      router.back();
    }
  }, [countdown, shift, accepted]);

  const startAnimations = () => {
    // Card slide in
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Pulse animation for accept button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadShiftAndUser = async () => {
    try {
      const { profileId } = await getProfileIdAndRole(supabase);
      if (profileId) {
        const pId = await getPersonnelId(supabase, profileId);
        setPersonnelId(pId);
      }

      // Support loading from shift_offers (Uber-style popup deep link)
      if (source === "shift_offers" || source === "urgent") {
        // id is the shift_id — find the shift_offer for this guard
        const { data: offerData, error: offerErr } = await supabase
          .from("shift_offers")
          .select("*")
          .eq("shift_id", id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!offerErr && offerData) {
          // Convert shift_offer to ShiftDetails format
          setShift({
            id: offerData.shift_id,
            title: offerData.venue_name || "Shift",
            shift_type: "door_supervisor",
            location_name: offerData.venue_name || "Venue",
            shift_date: offerData.shift_date || new Date().toISOString().split("T")[0],
            start_time: offerData.start_time || "00:00",
            end_time: offerData.end_time || "00:00",
            hourly_rate: offerData.hourly_rate,
            positions_available: 1,
            positions_filled: 0,
            urgency: source === "urgent" ? "emergency" : "normal",
            sia_required: true,
            venue: {
              name: offerData.venue_name || "Venue",
              city: "",
              address: offerData.venue_address || undefined,
            },
          });
          setLoading(false);
          return;
        }
      }

      // Default: load from shift_posts (marketplace flow)
      const { data, error } = await supabase
        .from("shift_posts")
        .select(`
          *,
          venue:venues(name, city, address),
          agency:agencies(name, city)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setShift(data);
    } catch (error) {
      console.error("Error loading shift:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!shift || !personnelId || accepting) return;

    setAccepting(true);
    safeHaptic("medium");
    Vibration.vibrate(100);

    try {
      // Create application with auto-accept status
      const { error } = await supabase.from("shift_applications").insert({
        shift_id: shift.id,
        personnel_id: personnelId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Success animation
      setAccepted(true);
      safeHaptic("success");
      Vibration.vibrate([0, 100, 50, 100]);

      Animated.timing(successAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Navigate after delay
      setTimeout(() => {
        router.replace("/(tabs)/account");
      }, 2500);
    } catch (error: any) {
      safeHaptic("error");
      setAccepting(false);
      alert(error.message || "Failed to accept shift");
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateEarnings = () => {
    if (!shift) return { hours: 0, total: 0 };
    const start = new Date(`2000-01-01T${shift.start_time}`);
    const end = new Date(`2000-01-01T${shift.end_time}`);
    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (hours < 0) hours += 24; // Overnight shift
    const total = hours * shift.hourly_rate;
    return { hours: Math.round(hours * 10) / 10, total };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Shift not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeInfo = SHIFT_TYPES[shift.shift_type] || SHIFT_TYPES.other;
  const { hours, total } = calculateEarnings();
  const positionsLeft = shift.positions_available - shift.positions_filled;

  // Success screen
  if (accepted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={["rgba(0, 212, 170, 0.2)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.successContainer,
            {
              opacity: successAnim,
              transform: [
                {
                  scale: successAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Shift Accepted!</Text>
          <Text style={styles.successSubtitle}>
            You're booked for {formatDate(shift.shift_date)}
          </Text>
          <View style={styles.successDetails}>
            <Text style={styles.successVenue}>
              {shift.venue?.name || shift.agency?.name}
            </Text>
            <Text style={styles.successTime}>
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </Text>
            <Text style={styles.successEarnings}>
              You'll earn £{total.toFixed(2)}
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{countdown}s</Text>
        </View>
      </View>

      {/* Urgency Banner */}
      {shift.urgency !== "normal" && (
        <LinearGradient
          colors={
            shift.urgency === "emergency"
              ? ["rgba(239, 68, 68, 0.3)", "rgba(239, 68, 68, 0.1)"]
              : ["rgba(249, 115, 22, 0.3)", "rgba(249, 115, 22, 0.1)"]
          }
          style={styles.urgencyBanner}
        >
          <Text style={styles.urgencyText}>
            {shift.urgency === "emergency" ? "🚨 EMERGENCY SHIFT" : "⚡ URGENT"}
          </Text>
        </LinearGradient>
      )}

      {/* Main Card */}
      <Animated.View
        style={[
          styles.mainCard,
          {
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Shift Type Header */}
        <View style={styles.shiftHeader}>
          <Text style={styles.shiftIcon}>{typeInfo.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.shiftTitle}>{shift.title}</Text>
            <Text style={styles.shiftType}>{typeInfo.label}</Text>
          </View>
          {shift.sia_required && (
            <View style={styles.siaBadge}>
              <Text style={styles.siaText}>SIA</Text>
            </View>
          )}
        </View>

        {/* Venue Info */}
        <View style={styles.venueSection}>
          <Text style={styles.venueName}>
            {shift.venue?.name || shift.agency?.name}
          </Text>
          <Text style={styles.venueAddress}>
            📍 {shift.venue?.address || shift.venue?.city || shift.agency?.city}
          </Text>
        </View>

        {/* Date & Time */}
        <View style={styles.dateTimeSection}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>DATE</Text>
            <Text style={styles.dateValue}>{formatDate(shift.shift_date)}</Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>TIME</Text>
            <Text style={styles.timeValue}>
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </Text>
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.earningsSection}>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Hourly Rate</Text>
            <Text style={styles.earningsValue}>£{shift.hourly_rate.toFixed(2)}/hr</Text>
          </View>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Duration</Text>
            <Text style={styles.earningsValue}>{hours} hours</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsRow}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalValue}>£{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Positions Left */}
        <View style={styles.positionsSection}>
          <Text style={styles.positionsText}>
            {positionsLeft} spot{positionsLeft !== 1 ? "s" : ""} remaining
          </Text>
        </View>
      </Animated.View>

      {/* Swipe to Accept Button */}
      <View style={styles.acceptContainer}>
        <Animated.View
          style={[styles.swipeTrack, { transform: [{ scale: pulseAnim }] }]}
        >
          <LinearGradient
            colors={[colors.accent, "#1fa89e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.swipeTrackGradient}
          >
            <Text style={styles.swipeHint}>Swipe to Accept →</Text>
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.swipeThumb,
                {
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={["#ffffff", "#f0f0f0"]}
                style={styles.swipeThumbGradient}
              >
                <Text style={styles.swipeThumbText}>
                  {accepting ? "..." : "→"}
                </Text>
              </LinearGradient>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Or tap to accept */}
        <TouchableOpacity
          style={styles.tapAcceptButton}
          onPress={handleAccept}
          disabled={accepting}
        >
          <Text style={styles.tapAcceptText}>
            {accepting ? "Accepting..." : "Or tap here to accept"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Decline Button */}
      <TouchableOpacity
        style={[styles.declineButton, { marginBottom: insets.bottom + 10 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.declineText}>Decline</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 12,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  backButtonText: {
    color: colors.accent,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 18,
    color: colors.text,
  },
  timerContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: radius.full,
  },
  timerText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 14,
  },
  urgencyBanner: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  urgencyText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  mainCard: {
    flex: 1,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  shiftIcon: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  shiftTitle: {
    ...typography.title,
    color: colors.text,
  },
  shiftType: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  siaBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  siaText: {
    ...typography.caption,
    color: "#3b82f6",
    fontWeight: "700",
  },
  venueSection: {
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  venueName: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
    fontSize: 18,
  },
  venueAddress: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  dateTimeSection: {
    flexDirection: "row",
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateBlock: {
    flex: 1,
  },
  timeBlock: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
  },
  dateValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 4,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
  },
  timeValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 4,
  },
  earningsSection: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  earningsLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  earningsValue: {
    ...typography.body,
    color: colors.text,
  },
  earningsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  totalValue: {
    ...typography.title,
    color: colors.accent,
    fontSize: 24,
  },
  positionsSection: {
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  positionsText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "500",
  },
  acceptContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  swipeTrack: {
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
  },
  swipeTrackGradient: {
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
  swipeThumbGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeThumbText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accent,
  },
  tapAcceptButton: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  tapAcceptText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  declineButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  declineText: {
    ...typography.body,
    color: colors.textMuted,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  successIcon: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.display,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  successDetails: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    width: "100%",
  },
  successVenue: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  successTime: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  successEarnings: {
    ...typography.title,
    color: colors.accent,
    fontSize: 24,
  },
});
