/**
 * Upcoming Shifts Screen
 * Shows all upcoming shifts for the logged-in guard
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { bookingDisplayName } from "../lib/bookingDisplay";
import { locationSummaryOneLine } from "../lib/bookingLocation";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { colors, gradients, typography, spacing, radius } from "../theme";
import { AnimatedBackground } from "../components/ui/AnimatedBackground";
import { BackButton } from "../components/ui/BackButton";
import { GuestGate } from "../components/auth/GuestGate";

type Shift = {
  id: string;
  booking_id: string;
  personnel_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  venue_confirmed: boolean;
  venue_name?: string;
  event_name?: string;
  event_date?: string;
  address_line?: string | null;
};

export default function UpcomingShiftsScreen() {
  return (
    <GuestGate feature="shifts" redirectAfter="/upcoming-shifts">
      <UpcomingShiftsScreenContent />
    </GuestGate>
  );
}

function UpcomingShiftsScreenContent() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const loadShifts = useCallback(async (showRefresh = false) => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    if (showRefresh) setRefreshing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const profileData = await getProfileIdAndRole(supabase, session.user.id);
      if (!profileData) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const pid = await getPersonnelId(supabase, profileData.profileId);
      if (!pid) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const now = new Date();

      // Load all upcoming shifts
      const { data: shiftsData, error } = await supabase
        .from("shifts")
        .select(`
          id,
          booking_id,
          personnel_id,
          role,
          hourly_rate,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          status,
          venue_confirmed,
          booking:bookings (
            id,
            event_name,
            event_date,
            venue_id,
            site_label,
            site_address_text,
            site_latitude,
            site_longitude,
            venues (
              id,
              name,
              address_line1,
              city,
              postcode
            )
          )
        `)
        .eq("personnel_id", pid)
        .in("status", ["accepted", "pending"])
        .gte("scheduled_start", now.toISOString())
        .order("scheduled_start", { ascending: true });

      if (error) {
        console.error("Error loading shifts:", error);
      }

      const formattedShifts = (shiftsData || []).map((s: any) => {
        const booking = Array.isArray(s.booking) ? s.booking[0] : s.booking;
        const venues = booking ? (Array.isArray(booking.venues) ? booking.venues[0] : booking.venues) : null;
        return {
          ...s,
          venue_name: bookingDisplayName({
            ...booking,
            venue: venues,
          }),
          event_name: booking?.event_name || "Shift",
          event_date: booking?.event_date,
          address_line: locationSummaryOneLine({
            ...booking,
            venue: venues,
          }),
        };
      });

      setShifts(formattedShifts);
    } catch (e) {
      console.error("Exception loading shifts:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadShifts();
    }, [loadShifts])
  );

  const onRefresh = useCallback(() => {
    loadShifts(true);
  }, [loadShifts]);

  // Group shifts by date
  const groupedShifts = shifts.reduce((groups, shift) => {
    const date = new Date(shift.scheduled_start).toISOString().split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(shift);
    return groups;
  }, {} as Record<string, Shift[]>);

  const sortedDates = Object.keys(groupedShifts).sort();

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <AnimatedBackground variant="subtle" />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading shifts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnimatedBackground variant="subtle" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>📅 Upcoming Shifts</Text>
            <Text style={styles.headerSubtitle}>
              {shifts.length} shift{shifts.length !== 1 ? 's' : ''} scheduled
            </Text>
          </View>
        </View>

        {/* Shifts List */}
        {shifts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No Upcoming Shifts</Text>
            <Text style={styles.emptySubtitle}>
              You don't have any shifts scheduled. Browse available jobs to find work.
            </Text>
            <TouchableOpacity
              style={styles.findJobsBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/explore");
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={gradients.accent}
                style={styles.findJobsBtnGradient}
              >
                <Text style={styles.findJobsBtnText}>Find Shifts</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          sortedDates.map((date, dateIndex) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDateHeader(date)}</Text>
              {groupedShifts[date].map((shift, shiftIndex) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  onPress={() => router.push(`/shift/${shift.id}`)}
                  delay={(dateIndex * 100) + (shiftIndex * 50)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Shift Card Component
function ShiftCard({ 
  shift, 
  onPress, 
  delay = 0 
}: { 
  shift: Shift; 
  onPress: () => void; 
  delay?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
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

  const startTime = new Date(shift.scheduled_start).toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const endTime = new Date(shift.scheduled_end).toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const hours = (new Date(shift.scheduled_end).getTime() - new Date(shift.scheduled_start).getTime()) / 3600000;
  const earnings = hours * (shift.hourly_rate || 0);

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <LinearGradient
          colors={gradients.card}
          style={styles.shiftCard}
        >
          <View style={styles.shiftCardHeader}>
            <View style={styles.shiftVenueRow}>
              <Text style={styles.shiftVenueIcon}>🏢</Text>
              <Text style={styles.shiftVenue} numberOfLines={1}>
                {shift.venue_name}
              </Text>
            </View>
            <View style={[
              styles.shiftStatus,
              shift.status === "accepted" ? styles.statusConfirmed : styles.statusPending
            ]}>
              <Text style={[
                styles.shiftStatusText,
                shift.status === "accepted" ? styles.statusTextConfirmed : styles.statusTextPending
              ]}>
                {shift.status === "accepted" ? "✓ Confirmed" : "⏳ Pending"}
              </Text>
            </View>
          </View>

          {shift.event_name && (
            <Text style={styles.eventName} numberOfLines={1}>
              {shift.event_name}
            </Text>
          )}

          {shift.address_line ? (
            <Text style={styles.shiftAddress} numberOfLines={2}>
              📍 {shift.address_line}
            </Text>
          ) : null}

          <View style={styles.shiftCardDetails}>
            <View style={styles.shiftDetail}>
              <Text style={styles.shiftDetailIcon}>⏰</Text>
              <Text style={styles.shiftDetailValue}>{startTime} - {endTime}</Text>
            </View>
            <View style={styles.shiftDetail}>
              <Text style={styles.shiftDetailIcon}>⏱️</Text>
              <Text style={styles.shiftDetailValue}>{hours.toFixed(1)}h</Text>
            </View>
            <View style={styles.shiftDetail}>
              <Text style={styles.shiftDetailIcon}>💷</Text>
              <Text style={[styles.shiftDetailValue, { color: colors.success }]}>
                £{Math.round(earnings)}
              </Text>
            </View>
          </View>

          {shift.role && (
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>🛡️ {shift.role}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  headerContent: {
    marginTop: spacing.md,
  },
  headerTitle: {
    ...typography.display,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  findJobsBtn: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  findJobsBtnGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  findJobsBtnText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.background,
  },

  // Date Groups
  dateGroup: {
    marginBottom: spacing.xl,
  },
  dateHeader: {
    ...typography.titleCard,
    color: colors.accent,
    marginBottom: spacing.md,
  },

  // Shift Card
  shiftCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  shiftCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  shiftVenueRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  shiftVenueIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  shiftVenue: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  eventName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  shiftAddress: {
    ...typography.caption,
    color: colors.accent,
    marginBottom: spacing.sm,
    fontWeight: "600",
    lineHeight: 16,
  },
  shiftStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusConfirmed: {
    backgroundColor: colors.successSoft,
  },
  statusPending: {
    backgroundColor: colors.warningSoft,
  },
  shiftStatusText: {
    ...typography.caption,
    fontWeight: "600",
  },
  statusTextConfirmed: {
    color: colors.success,
  },
  statusTextPending: {
    color: colors.warning,
  },
  shiftCardDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  shiftDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shiftDetailIcon: {
    fontSize: 12,
  },
  shiftDetailValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  roleTagText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "500",
  },
});
