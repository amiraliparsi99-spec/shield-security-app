/**
 * EnhancedDashboard - Modern, animated dashboard for guards
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, gradients, typography, spacing, radius } from "../../theme";
import { LiveIndicator } from "../ui/LiveIndicator";

const { width } = Dimensions.get("window");

// ============ GREETING HEADER ============
interface EnhancedGreetingProps {
  name: string;
  hasActiveShift?: boolean;
  shiftCount?: number;
}

export function EnhancedGreeting({ name, hasActiveShift, shiftCount }: EnhancedGreetingProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getSubtitle = () => {
    if (hasActiveShift) return "You're currently on shift";
    if (shiftCount && shiftCount > 0) return `${shiftCount} shift${shiftCount > 1 ? 's' : ''} scheduled`;
    return "No shifts scheduled";
  };

  return (
    <Animated.View
      style={[
        styles.greetingContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text style={styles.greetingLabel}>{getGreeting()},</Text>
          <Text style={styles.greetingName}>{name}</Text>
        </View>
        {hasActiveShift && (
          <View style={styles.liveContainer}>
            <LiveIndicator label="ON SHIFT" color={colors.success} />
          </View>
        )}
      </View>
      <Text style={styles.greetingSubtitle}>{getSubtitle()}</Text>
    </Animated.View>
  );
}

// ============ QUICK ACTION BUTTON ============
interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: string | number;
  gradient?: [string, string];
  delay?: number;
  /** Number of columns in the row (default 4). Use 2 for a 2x2 grid. */
  columns?: number;
}

export function QuickActionButton({
  icon,
  label,
  onPress,
  badge,
  gradient,
  delay = 0,
  columns = 4,
}: QuickActionProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    
    onPress();
  };

  const colGap = spacing.sm;
  const containerWidth =
    (width - spacing.lg * 2 - colGap * (columns - 1)) / columns;

  return (
    <Animated.View
      style={[
        styles.quickActionContainer,
        { width: containerWidth },
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
        <LinearGradient
          colors={gradient || gradients.card}
          style={styles.quickActionButton}
        >
          <View style={styles.quickActionIconContainer}>
            <Text style={styles.quickActionIcon}>{icon}</Text>
            {badge && (
              <View style={styles.quickActionBadge}>
                <Text style={styles.quickActionBadgeText}>
                  {typeof badge === "number" && badge > 99 ? "99+" : badge}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.quickActionLabel}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============ STATS DISPLAY ============
interface StatItemProps {
  value: string | number;
  label: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

function StatItem({ value, label, trend, trendValue }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {trend && trendValue && (
        <View style={[styles.trendContainer, trend === "up" ? styles.trendUp : styles.trendDown]}>
          <Text style={[styles.trendText, trend === "up" ? styles.trendTextUp : styles.trendTextDown]}>
            {trend === "up" ? "↑" : "↓"} {trendValue}
          </Text>
        </View>
      )}
    </View>
  );
}

interface EnhancedStatsProps {
  earnings: number;
  completed: number;
  upcoming: number;
  onPress?: () => void;
}

export function EnhancedStats({ earnings, completed, upcoming, onPress }: EnhancedStatsProps) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.statsContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.8 : 1}
        onPress={handlePress}
        disabled={!onPress}
      >
        <LinearGradient
          colors={gradients.darkCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>📊 Your Stats</Text>
            {onPress && <Text style={styles.statsArrow}>→</Text>}
          </View>
          <View style={styles.statsRow}>
            <StatItem value={`£${earnings}`} label="Earnings" />
            <View style={styles.statsDivider} />
            <StatItem value={completed} label="Completed" />
            <View style={styles.statsDivider} />
            <StatItem value={upcoming} label="Upcoming" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============ TODAY'S SHIFT CARD ============
interface TodayShiftProps {
  venueName: string;
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  hourlyRate: number;
  isActive?: boolean;
  briefPreview?: string | null;
  locationLine?: string | null;
  onPress: () => void;
  onCheckIn?: () => void;
}

export function EnhancedTodayShift({
  venueName,
  eventName,
  date,
  startTime,
  endTime,
  role,
  hourlyRate,
  isActive,
  briefPreview,
  locationLine,
  onPress,
  onCheckIn,
}: TodayShiftProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View
      style={[
        styles.todayShiftContainer,
        {
          shadowColor: isActive ? colors.successGlow : colors.accentGlow,
          shadowOpacity: isActive ? 0.5 : 0.3,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        <LinearGradient
          colors={isActive ? gradients.successSoft : gradients.accentSoft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.todayShiftCard,
            { borderColor: isActive ? colors.success : colors.accent },
          ]}
        >
          <View style={styles.todayShiftHeader}>
            <View>
              <View style={styles.todayShiftLabelRow}>
                <Text style={styles.todayShiftLabel}>
                  {isActive ? "🟢 ON SHIFT NOW" : "📅 TODAY'S SHIFT"}
                </Text>
                {isActive && <LiveIndicator size="sm" showLabel={false} />}
              </View>
              <Text style={styles.todayShiftVenue}>{venueName}</Text>
              <Text style={styles.todayShiftEvent}>{eventName}</Text>
              {briefPreview ? (
                <Text style={styles.todayShiftBrief} numberOfLines={2}>
                  📋 {briefPreview}
                </Text>
              ) : null}
              {locationLine ? (
                <Text style={styles.todayShiftLocation} numberOfLines={2}>
                  📍 {locationLine}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.todayShiftDetails}>
            <View style={styles.todayShiftDate}>
              <Text style={styles.todayShiftDateLabel}>Date</Text>
              <Text style={styles.todayShiftDateValue}>{date}</Text>
            </View>
            <View style={styles.todayShiftTime}>
              <Text style={styles.todayShiftTimeLabel}>Time</Text>
              <Text style={styles.todayShiftTimeValue}>{startTime} - {endTime}</Text>
            </View>
            <View style={styles.todayShiftRole}>
              <Text style={styles.todayShiftRoleLabel}>Role</Text>
              <Text style={styles.todayShiftRoleValue}>{role}</Text>
            </View>
            <View style={styles.todayShiftPay}>
              <Text style={styles.todayShiftPayLabel}>Rate</Text>
              <Text style={styles.todayShiftPayValue}>£{hourlyRate}/hr</Text>
            </View>
          </View>

          {!isActive && onCheckIn && (
            <TouchableOpacity
              style={styles.checkInButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onCheckIn();
              }}
            >
              <LinearGradient
                colors={gradients.accent}
                style={styles.checkInButtonGradient}
              >
                <Text style={styles.checkInButtonText}>Check In</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ============ NO SHIFT CARD ============
interface NoShiftProps {
  onFindShifts: () => void;
}

export function EnhancedNoShift({ onFindShifts }: NoShiftProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -5,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.noShiftContainer}>
      <LinearGradient
        colors={gradients.card}
        style={styles.noShiftCard}
      >
        <Animated.Text
          style={[styles.noShiftIcon, { transform: [{ translateY: bounceAnim }] }]}
        >
          📅
        </Animated.Text>
        <Text style={styles.noShiftTitle}>No Shifts Today</Text>
        <Text style={styles.noShiftSubtitle}>Browse available opportunities</Text>
        <TouchableOpacity
          style={styles.findShiftsButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onFindShifts();
          }}
        >
          <LinearGradient
            colors={gradients.accent}
            style={styles.findShiftsGradient}
          >
            <Text style={styles.findShiftsText}>🔍 Find Shifts</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  // Greeting
  greetingContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greetingText: {},
  greetingLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  greetingName: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  greetingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  liveContainer: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success,
  },

  // Quick Actions (default width overridden by inline width from columns prop)
  quickActionContainer: {
    minWidth: 0,
  },
  quickActionButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  quickActionIconContainer: {
    position: "relative",
    marginBottom: spacing.xs,
  },
  quickActionIcon: {
    fontSize: 28,
  },
  quickActionBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Stats
  statsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  statsTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  statsArrow: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 18,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    backgroundColor: colors.glassBorder,
    marginHorizontal: spacing.sm,
  },
  trendContainer: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendUp: {
    backgroundColor: colors.successSoft,
  },
  trendDown: {
    backgroundColor: colors.errorSoft,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  trendTextUp: {
    color: colors.success,
  },
  trendTextDown: {
    color: colors.error,
  },

  // Today's Shift
  todayShiftContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
    elevation: 8,
  },
  todayShiftCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
  },
  todayShiftHeader: {
    marginBottom: spacing.md,
  },
  todayShiftLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  todayShiftLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  todayShiftVenue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  todayShiftEvent: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  todayShiftBrief: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  todayShiftLocation: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
    lineHeight: 18,
    fontWeight: "600",
  },
  todayShiftDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  todayShiftDate: {},
  todayShiftDateLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  todayShiftDateValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 2,
  },
  todayShiftTime: {},
  todayShiftTimeLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  todayShiftTimeValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 2,
  },
  todayShiftRole: {},
  todayShiftRoleLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  todayShiftRoleValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 2,
  },
  todayShiftPay: {},
  todayShiftPayLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  todayShiftPayValue: {
    ...typography.body,
    color: colors.success,
    fontWeight: "700",
    marginTop: 2,
  },
  checkInButton: {
    marginTop: spacing.lg,
  },
  checkInButtonGradient: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  checkInButtonText: {
    ...typography.body,
    color: colors.textInverse,
    fontWeight: "700",
  },

  // No Shift
  noShiftContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  noShiftCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  noShiftIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  noShiftTitle: {
    ...typography.title,
    color: colors.text,
  },
  noShiftSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  findShiftsButton: {
    width: "100%",
  },
  findShiftsGradient: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  findShiftsText: {
    ...typography.body,
    color: colors.textInverse,
    fontWeight: "700",
  },
});
