/**
 * Upcoming Shifts List Component
 * Animated list of upcoming shifts with swipe actions
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../../theme";

interface Shift {
  id: string;
  venueName: string;
  date: string;
  startTime: string;
  endTime: string;
  earnings: number;
  status: "confirmed" | "pending";
}

interface UpcomingShiftsListProps {
  shifts: Shift[];
  onShiftPress: (shift: Shift) => void;
  onViewAll?: () => void;
}

function formatDate(dateStr: string): { day: string; month: string; weekday: string } {
  try {
    const date = new Date(dateStr);
    return {
      day: date.getDate().toString(),
      month: date.toLocaleDateString("en-GB", { month: "short" }),
      weekday: date.toLocaleDateString("en-GB", { weekday: "short" }),
    };
  } catch {
    return { day: "?", month: "?", weekday: "?" };
  }
}

function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    return `${h % 12 || 12}:${minutes}${h >= 12 ? "pm" : "am"}`;
  } catch {
    return time;
  }
}

function ShiftCard({ shift, index, onPress }: { shift: Shift; index: number; onPress: () => void }) {
  const translateX = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const date = formatDate(shift.date);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity,
          transform: [{ translateX }, { scale }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.card}>
          {/* Date Badge */}
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{date.day}</Text>
            <Text style={styles.dateMonth}>{date.month}</Text>
          </View>

          {/* Shift Details */}
          <View style={styles.details}>
            <Text style={styles.venueName} numberOfLines={1}>{shift.venueName}</Text>
            <Text style={styles.timeText}>
              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
            </Text>
            <View style={styles.bottomRow}>
              <View style={[
                styles.statusBadge,
                shift.status === "confirmed" ? styles.confirmed : styles.pending
              ]}>
                <Text style={styles.statusText}>
                  {shift.status === "confirmed" ? "✓ Confirmed" : "⏳ Pending"}
                </Text>
              </View>
            </View>
          </View>

          {/* Earnings */}
          <View style={styles.earningsContainer}>
            <Text style={styles.earningsAmount}>£{shift.earnings}</Text>
            <Text style={styles.earningsLabel}>Est.</Text>
          </View>

          {/* Arrow */}
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function UpcomingShiftsList({ shifts, onShiftPress, onViewAll }: UpcomingShiftsListProps) {
  if (shifts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No upcoming shifts scheduled</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Upcoming Shifts</Text>
        {onViewAll && shifts.length > 3 && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listContainer}>
        {shifts.slice(0, 5).map((shift, index) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            index={index}
            onPress={() => onShiftPress(shift)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  viewAllText: {
    ...typography.body,
    color: colors.accent,
    fontSize: 14,
  },
  listContainer: {
    gap: spacing.sm,
  },
  cardContainer: {
    marginBottom: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  dateDay: {
    ...typography.title,
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  dateMonth: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 10,
    textTransform: "uppercase",
  },
  details: {
    flex: 1,
    marginRight: spacing.sm,
  },
  venueName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginBottom: 2,
  },
  timeText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  confirmed: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  pending: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "600",
  },
  earningsContainer: {
    alignItems: "flex-end",
    marginRight: spacing.sm,
  },
  earningsAmount: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  arrow: {
    ...typography.title,
    color: colors.textMuted,
    fontSize: 24,
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
});

export default UpcomingShiftsList;
