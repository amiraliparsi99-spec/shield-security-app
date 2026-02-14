/**
 * Today's Shift Card Component
 * Prominent card showing today's scheduled shift
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";

interface TodayShiftCardProps {
  venueName: string;
  venueAddress: string;
  startTime: string;
  endTime: string;
  role: string;
  status: "upcoming" | "in_progress" | "completed";
  onPress: () => void;
  onCheckIn?: () => void;
}

function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return time;
  }
}

function getStatusColor(status: string): [string, string] {
  switch (status) {
    case "in_progress":
      return ["rgba(16, 185, 129, 0.3)", "rgba(16, 185, 129, 0.1)"];
    case "completed":
      return ["rgba(107, 114, 128, 0.3)", "rgba(107, 114, 128, 0.1)"];
    default:
      return ["rgba(45, 212, 191, 0.2)", "rgba(45, 212, 191, 0.05)"];
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      return "Upcoming";
  }
}

export function TodayShiftCard({
  venueName,
  venueAddress,
  startTime,
  endTime,
  role,
  status,
  onPress,
  onCheckIn,
}: TodayShiftCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for in_progress status
    if (status === "in_progress") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleCheckIn = () => {
    if (onCheckIn) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCheckIn();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
        },
      ]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.95}>
        <LinearGradient
          colors={getStatusColor(status)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Status Badge */}
          <View style={styles.header}>
            <View style={[styles.statusBadge, status === "in_progress" && styles.statusBadgeActive]}>
              {status === "in_progress" && <View style={styles.liveDot} />}
              <Text style={styles.statusText}>{getStatusText(status)}</Text>
            </View>
            <Text style={styles.date}>Today</Text>
          </View>

          {/* Venue Info */}
          <Text style={styles.venueName}>{venueName}</Text>
          <Text style={styles.venueAddress}>{venueAddress}</Text>

          {/* Time and Role */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>🕐</Text>
              <Text style={styles.detailText}>
                {formatTime(startTime)} - {formatTime(endTime)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>🛡️</Text>
              <Text style={styles.detailText}>{role}</Text>
            </View>
          </View>

          {/* Action Button */}
          {status === "upcoming" && onCheckIn && (
            <TouchableOpacity style={styles.checkInButton} onPress={handleCheckIn}>
              <LinearGradient
                colors={[colors.accent, "#1fa89e"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.checkInGradient}
              >
                <Text style={styles.checkInText}>📍 Check In</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {status === "in_progress" && (
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: "60%" }]} />
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Empty state when no shift today
export function NoShiftToday({ onFindShifts }: { onFindShifts: () => void }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(30, 30, 40, 0.8)", "rgba(20, 20, 30, 0.8)"]}
        style={styles.emptyCard}
      >
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyTitle}>No Shifts Today</Text>
        <Text style={styles.emptySubtitle}>Browse available opportunities</Text>
        <TouchableOpacity
          style={styles.findButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFindShifts();
          }}
        >
          <Text style={styles.findButtonText}>Find Shifts</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  statusText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
    fontSize: 11,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
  },
  venueName: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  venueAddress: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  detailsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  detailText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  checkInButton: {
    marginTop: spacing.sm,
  },
  checkInGradient: {
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  checkInText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    fontSize: 15,
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  emptyCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  findButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  findButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});

export default TodayShiftCard;
