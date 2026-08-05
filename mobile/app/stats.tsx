/**
 * Stats & Insights Screen
 * Shows detailed statistics and insights for security guards
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { bookingDisplayName } from "../lib/bookingDisplay";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { computeShiftPay, shiftCountsAsWorked } from "../lib/shiftEarnings";
import { fetchGuardShifts } from "../lib/guardShifts";
import { BackButton } from "../components/ui/BackButton";
import { GuestGate } from "../components/auth/GuestGate";

interface ShiftStats {
  totalShifts: number;
  completedShifts: number;
  upcomingShifts: number;
  cancelledShifts: number;
  noShowShifts: number;
  totalHoursWorked: number;
  totalEarnings: number;
  averageHourlyRate: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  thisWeekShifts: number;
  confirmedPayments: number;
  pendingPayments: number;
}

export default function StatsScreen() {
  return (
    <GuestGate feature="stats" redirectAfter="/stats">
      <StatsScreenContent />
    </GuestGate>
  );
}

function StatsScreenContent() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [recentShifts, setRecentShifts] = useState<any[]>([]);

  const loadStats = useCallback(async (showRefresh = false) => {
    if (!supabase) return;
    if (showRefresh) setRefreshing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const profileData = await getProfileIdAndRole(supabase, user.id);
      if (!profileData?.profileId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const personnelId = await getPersonnelId(supabase, profileData.profileId);
      if (!personnelId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch all shifts for this guard
      const shifts = await fetchGuardShifts<any>(supabase, personnelId, {
        select: `
          id,
          status,
          hourly_rate,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          total_pay,
          hours_worked,
          venue_confirmed,
          cancellation_reason,
          booking:bookings(
            event_name,
            site_label,
            site_address_text,
            venues(name)
          )
        `,
        orderAsc: false,
      });

      // Calculate stats
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const completed = shifts?.filter((s) => shiftCountsAsWorked(s)) || [];
      const upcoming = shifts?.filter(s => 
        (s.status === "accepted" || s.status === "pending") && 
        new Date(s.scheduled_start) > now
      ) || [];
      const cancelled = shifts?.filter(s => s.status === "cancelled") || [];
      const noShow = shifts?.filter(s => s.status === "no_show") || [];

      // Calculate hours and earnings from completed shifts
      let totalHours = 0;
      let totalEarnings = 0;
      let thisMonthEarnings = 0;
      let lastMonthEarnings = 0;
      let confirmedPayments = 0;
      let pendingPayments = 0;

      completed.forEach(shift => {
        const { hours, pay } = computeShiftPay(shift as any);
        
        totalHours += hours;
        totalEarnings += pay;

        const start = shift.actual_start ? new Date(shift.actual_start) : new Date(shift.scheduled_start);
        if (start >= thisMonthStart) {
          thisMonthEarnings += pay;
        } else if (start >= lastMonthStart && start <= lastMonthEnd) {
          lastMonthEarnings += pay;
        }

        if (shift.venue_confirmed) {
          confirmedPayments += pay;
        } else {
          pendingPayments += pay;
        }
      });

      // This week's shifts
      const thisWeekShifts = shifts?.filter(s => {
        const shiftDate = new Date(s.scheduled_start);
        return shiftDate >= thisWeekStart;
      }).length || 0;

      // Average hourly rate
      const rates = shifts?.map(s => s.hourly_rate).filter(r => r > 0) || [];
      const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

      setStats({
        totalShifts: shifts?.length || 0,
        completedShifts: completed.length,
        upcomingShifts: upcoming.length,
        cancelledShifts: cancelled.length,
        noShowShifts: noShow.length,
        totalHoursWorked: Math.round(totalHours * 10) / 10,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        averageHourlyRate: Math.round(avgRate * 100) / 100,
        thisMonthEarnings: Math.round(thisMonthEarnings * 100) / 100,
        lastMonthEarnings: Math.round(lastMonthEarnings * 100) / 100,
        thisWeekShifts,
        confirmedPayments: Math.round(confirmedPayments * 100) / 100,
        pendingPayments: Math.round(pendingPayments * 100) / 100,
      });

      // Recent completed shifts
      setRecentShifts(completed.slice(0, 5));

    } catch (err) {
      console.error("Error loading stats:", err);
    }
    
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading your stats...</Text>
      </View>
    );
  }

  const earningsChange = stats && stats.lastMonthEarnings > 0
    ? Math.round(((stats.thisMonthEarnings - stats.lastMonthEarnings) / stats.lastMonthEarnings) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadStats(true)}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Your Stats & Insights</Text>
        <Text style={styles.subtitle}>Track your performance and earnings</Text>
      </View>

      {/* Earnings Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Earnings</Text>
        <LinearGradient
          colors={["#1a472a", "#0d2818"]}
          style={styles.earningsCard}
        >
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsValue}>£{stats?.totalEarnings.toFixed(2) || "0.00"}</Text>
          
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsItemLabel}>This Month</Text>
              <Text style={styles.earningsItemValue}>£{stats?.thisMonthEarnings.toFixed(2) || "0.00"}</Text>
              {earningsChange !== 0 && (
                <Text style={[styles.changeText, earningsChange > 0 ? styles.positive : styles.negative]}>
                  {earningsChange > 0 ? "↑" : "↓"} {Math.abs(earningsChange)}% vs last month
                </Text>
              )}
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsItemLabel}>Last Month</Text>
              <Text style={styles.earningsItemValue}>£{stats?.lastMonthEarnings.toFixed(2) || "0.00"}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Payment Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💳 Payment Status</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardGreen]}>
            <Text style={styles.statCardValue}>£{stats?.confirmedPayments.toFixed(0) || "0"}</Text>
            <Text style={styles.statCardLabel}>Confirmed</Text>
            <Text style={styles.statCardSubtext}>Released to you</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAmber]}>
            <Text style={styles.statCardValue}>£{stats?.pendingPayments.toFixed(0) || "0"}</Text>
            <Text style={styles.statCardLabel}>Pending</Text>
            <Text style={styles.statCardSubtext}>Awaiting confirmation</Text>
          </View>
        </View>
      </View>

      {/* Shift Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Shift Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{stats?.totalShifts || 0}</Text>
            <Text style={styles.statCardLabel}>Total Shifts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{stats?.completedShifts || 0}</Text>
            <Text style={styles.statCardLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{stats?.upcomingShifts || 0}</Text>
            <Text style={styles.statCardLabel}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{stats?.thisWeekShifts || 0}</Text>
            <Text style={styles.statCardLabel}>This Week</Text>
          </View>
        </View>
      </View>

      {/* Performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏱️ Performance</Text>
        <View style={styles.performanceCard}>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Hours Worked</Text>
            <Text style={styles.performanceValue}>{stats?.totalHoursWorked || 0}h</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Average Rate</Text>
            <Text style={styles.performanceValue}>£{stats?.averageHourlyRate.toFixed(2) || "0.00"}/hr</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Cancellations</Text>
            <Text style={[styles.performanceValue, stats?.cancelledShifts ? styles.negative : {}]}>
              {stats?.cancelledShifts || 0}
            </Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>No Shows</Text>
            <Text style={[styles.performanceValue, stats?.noShowShifts ? styles.negative : {}]}>
              {stats?.noShowShifts || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Completed Shifts */}
      {recentShifts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Recent Completed</Text>
          {recentShifts.map((shift, index) => {
            const start = shift.actual_start ? new Date(shift.actual_start) : new Date(shift.scheduled_start);
            const end = shift.actual_end ? new Date(shift.actual_end) : new Date(shift.scheduled_end);
            const hours = (end.getTime() - start.getTime()) / 3600000;
            const earnings = hours * (shift.hourly_rate || 0);
            
            return (
              <View key={shift.id} style={styles.recentShift}>
                <View style={styles.recentShiftInfo}>
                  <Text style={styles.recentShiftVenue}>
                    {bookingDisplayName(
                      Array.isArray(shift.booking) ? shift.booking[0] : shift.booking,
                    )}
                  </Text>
                  <Text style={styles.recentShiftDate}>
                    {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} • {hours.toFixed(1)}h
                  </Text>
                </View>
                <View style={styles.recentShiftEarnings}>
                  <Text style={styles.recentShiftAmount}>£{earnings.toFixed(2)}</Text>
                  {shift.venue_confirmed ? (
                    <Text style={styles.confirmedBadge}>✓ Paid</Text>
                  ) : (
                    <Text style={styles.pendingBadge}>Pending</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  earningsCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  earningsLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  earningsValue: {
    fontSize: 42,
    fontWeight: "700",
    color: "#4ade80",
    marginVertical: spacing.sm,
  },
  earningsRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  earningsItem: {
    flex: 1,
  },
  earningsItemLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  earningsItemValue: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },
  changeText: {
    ...typography.caption,
    marginTop: spacing.xs,
    fontSize: 11,
  },
  positive: {
    color: "#4ade80",
  },
  negative: {
    color: "#f87171",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardGreen: {
    borderColor: "rgba(74, 222, 128, 0.3)",
    backgroundColor: "rgba(74, 222, 128, 0.05)",
  },
  statCardAmber: {
    borderColor: "rgba(251, 191, 36, 0.3)",
    backgroundColor: "rgba(251, 191, 36, 0.05)",
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  statCardLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statCardSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  performanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  performanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  performanceLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  performanceValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  recentShift: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentShiftInfo: {
    flex: 1,
  },
  recentShiftVenue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  recentShiftDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  recentShiftEarnings: {
    alignItems: "flex-end",
  },
  recentShiftAmount: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  confirmedBadge: {
    ...typography.caption,
    color: "#4ade80",
    fontSize: 10,
    marginTop: 2,
  },
  pendingBadge: {
    ...typography.caption,
    color: "#fbbf24",
    fontSize: 10,
    marginTop: 2,
  },
});
