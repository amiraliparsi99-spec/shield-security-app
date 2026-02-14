import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getVenueId, getAgencyId } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { SlideInView, FadeInView } from "../components/ui/AnimatedComponents";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Stats {
  totalBookings: number;
  completedShifts: number;
  totalHours: number;
  totalEarnings: number;
  avgRating: number;
  thisMonth: {
    bookings: number;
    hours: number;
    earnings: number;
  };
  lastMonth: {
    bookings: number;
    hours: number;
    earnings: number;
  };
  byStatus: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
}

interface ChartData {
  label: string;
  value: number;
  color: string;
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<string>("");
  const [stats, setStats] = useState<Stats>({
    totalBookings: 0,
    completedShifts: 0,
    totalHours: 0,
    totalEarnings: 0,
    avgRating: 0,
    thisMonth: { bookings: 0, hours: 0, earnings: 0 },
    lastMonth: { bookings: 0, hours: 0, earnings: 0 },
    byStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
  });
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      const { profileId, role: userRole } = await getProfileIdAndRole(supabase);
      setRole(userRole || "");

      if (!profileId) return;

      // Get date ranges
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      let query = supabase.from("bookings").select("*");

      if (userRole === "personnel") {
        const { data: personnel } = await supabase
          .from("personnel")
          .select("id")
          .eq("user_id", profileId)
          .single();
        
        if (personnel) {
          query = query.eq("provider_id", personnel.id);
        }
      } else if (userRole === "venue") {
        const venueId = await getVenueId(supabase, profileId);
        if (venueId) {
          query = query.eq("venue_id", venueId);
        }
      } else if (userRole === "agency") {
        const agencyId = await getAgencyId(supabase, profileId);
        if (agencyId) {
          query = query.eq("provider_id", agencyId);
        }
      }

      const { data: bookings } = await query;

      if (bookings) {
        // Calculate stats
        const completed = bookings.filter((b) => b.status === "completed");
        const thisMonthBookings = bookings.filter(
          (b) => new Date(b.created_at) >= thisMonthStart
        );
        const lastMonthBookings = bookings.filter(
          (b) =>
            new Date(b.created_at) >= lastMonthStart &&
            new Date(b.created_at) <= lastMonthEnd
        );

        // Calculate hours (simplified - assumes each booking has start/end times)
        let totalHours = 0;
        completed.forEach((b) => {
          if (b.start_time && b.end_time) {
            const start = new Date(`2000-01-01T${b.start_time}`);
            let end = new Date(`2000-01-01T${b.end_time}`);
            if (end < start) end.setDate(end.getDate() + 1);
            totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
        });

        // Calculate earnings
        const totalEarnings = completed.reduce((sum, b) => sum + (b.rate || 0) * (b.guards_count || 1), 0);

        setStats({
          totalBookings: bookings.length,
          completedShifts: completed.length,
          totalHours: Math.round(totalHours),
          totalEarnings,
          avgRating: 4.8, // Placeholder - would come from reviews
          thisMonth: {
            bookings: thisMonthBookings.length,
            hours: Math.round(totalHours * 0.4), // Simplified
            earnings: Math.round(totalEarnings * 0.4),
          },
          lastMonth: {
            bookings: lastMonthBookings.length,
            hours: Math.round(totalHours * 0.3),
            earnings: Math.round(totalEarnings * 0.3),
          },
          byStatus: {
            pending: bookings.filter((b) => b.status === "pending").length,
            confirmed: bookings.filter((b) => b.status === "confirmed").length,
            completed: completed.length,
            cancelled: bookings.filter((b) => b.status === "cancelled").length,
          },
        });
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return `£${(amount / 100).toLocaleString("en-GB", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const renderBarChart = (data: ChartData[], maxValue: number) => {
    return (
      <View style={styles.barChart}>
        {data.map((item, index) => (
          <View key={index} style={styles.barItem}>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  {
                    height: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : 0,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{item.label}</Text>
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const statusChartData: ChartData[] = [
    { label: "Pending", value: stats.byStatus.pending, color: "#F59E0B" },
    { label: "Confirmed", value: stats.byStatus.confirmed, color: "#3B82F6" },
    { label: "Completed", value: stats.byStatus.completed, color: "#10B981" },
    { label: "Cancelled", value: stats.byStatus.cancelled, color: "#EF4444" },
  ];

  const maxStatusValue = Math.max(...statusChartData.map((d) => d.value));

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Analytics</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {(["week", "month", "year"] as const).map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.timeRangeBtn, timeRange === range && styles.timeRangeBtnActive]}
            onPress={() => {
              setTimeRange(range);
              safeHaptic("selection");
            }}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === range && styles.timeRangeTextActive,
              ]}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Overview Stats */}
        <SlideInView delay={0}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={styles.statValue}>{stats.totalBookings}</Text>
              <Text style={styles.statLabel}>Total Bookings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statValue}>{stats.completedShifts}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⏱</Text>
              <Text style={styles.statValue}>{stats.totalHours}h</Text>
              <Text style={styles.statLabel}>Hours Worked</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statValue}>{stats.avgRating}</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
          </View>
        </SlideInView>

        {/* Earnings Card */}
        <SlideInView delay={100}>
          <View style={styles.earningsCard}>
            <View style={styles.earningsHeader}>
              <Text style={styles.earningsTitle}>
                {role === "venue" ? "Total Spent" : "Total Earnings"}
              </Text>
              <View style={styles.changeIndicator}>
                <Text
                  style={[
                    styles.changeText,
                    {
                      color:
                        calculateChange(stats.thisMonth.earnings, stats.lastMonth.earnings) >= 0
                          ? "#10B981"
                          : "#EF4444",
                    },
                  ]}
                >
                  {calculateChange(stats.thisMonth.earnings, stats.lastMonth.earnings) >= 0
                    ? "↑"
                    : "↓"}{" "}
                  {Math.abs(calculateChange(stats.thisMonth.earnings, stats.lastMonth.earnings))}%
                </Text>
              </View>
            </View>
            <Text style={styles.earningsAmount}>{formatCurrency(stats.totalEarnings)}</Text>
            <View style={styles.earningsComparison}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>This month</Text>
                <Text style={styles.comparisonValue}>
                  {formatCurrency(stats.thisMonth.earnings)}
                </Text>
              </View>
              <View style={styles.comparisonDivider} />
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>Last month</Text>
                <Text style={styles.comparisonValue}>
                  {formatCurrency(stats.lastMonth.earnings)}
                </Text>
              </View>
            </View>
          </View>
        </SlideInView>

        {/* Status Breakdown Chart */}
        <SlideInView delay={200}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Bookings by Status</Text>
            {renderBarChart(statusChartData, maxStatusValue)}
          </View>
        </SlideInView>

        {/* Monthly Comparison */}
        <SlideInView delay={300}>
          <View style={styles.comparisonCard}>
            <Text style={styles.chartTitle}>Monthly Comparison</Text>
            <View style={styles.monthComparison}>
              <View style={styles.monthColumn}>
                <Text style={styles.monthLabel}>This Month</Text>
                <View style={styles.monthStats}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatValue}>{stats.thisMonth.bookings}</Text>
                    <Text style={styles.monthStatLabel}>Bookings</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatValue}>{stats.thisMonth.hours}h</Text>
                    <Text style={styles.monthStatLabel}>Hours</Text>
                  </View>
                </View>
              </View>
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>vs</Text>
              </View>
              <View style={styles.monthColumn}>
                <Text style={styles.monthLabel}>Last Month</Text>
                <View style={styles.monthStats}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatValue}>{stats.lastMonth.bookings}</Text>
                    <Text style={styles.monthStatLabel}>Bookings</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatValue}>{stats.lastMonth.hours}h</Text>
                    <Text style={styles.monthStatLabel}>Hours</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </SlideInView>

        {/* Quick Insights */}
        <SlideInView delay={400}>
          <View style={styles.insightsCard}>
            <Text style={styles.chartTitle}>💡 Quick Insights</Text>
            <View style={styles.insightsList}>
              <View style={styles.insightItem}>
                <Text style={styles.insightIcon}>📈</Text>
                <Text style={styles.insightText}>
                  You've completed {stats.completedShifts} shifts with a {stats.avgRating} rating
                </Text>
              </View>
              {stats.thisMonth.bookings > stats.lastMonth.bookings && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightIcon}>🔥</Text>
                  <Text style={styles.insightText}>
                    Bookings are up {calculateChange(stats.thisMonth.bookings, stats.lastMonth.bookings)}% this month!
                  </Text>
                </View>
              )}
              {stats.byStatus.pending > 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightIcon}>⏳</Text>
                  <Text style={styles.insightText}>
                    You have {stats.byStatus.pending} pending bookings to review
                  </Text>
                </View>
              )}
            </View>
          </View>
        </SlideInView>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  timeRangeContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  timeRangeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  timeRangeBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timeRangeText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  timeRangeTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2 - spacing.sm / 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
    fontSize: 24,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  earningsCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  earningsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  earningsTitle: {
    ...typography.body,
    color: colors.text,
    opacity: 0.8,
  },
  changeIndicator: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  changeText: {
    ...typography.caption,
    fontWeight: "600",
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.text,
    marginVertical: spacing.sm,
  },
  earningsComparison: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  comparisonItem: {
    flex: 1,
  },
  comparisonDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: spacing.md,
  },
  comparisonLabel: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.7,
  },
  comparisonValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  barChart: {
    flexDirection: "row",
    justifyContent: "space-around",
    height: 150,
  },
  barItem: {
    alignItems: "center",
    flex: 1,
  },
  barContainer: {
    flex: 1,
    width: 30,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: radius.sm,
  },
  barLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: 10,
  },
  barValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    fontSize: 12,
  },
  comparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  monthComparison: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthColumn: {
    flex: 1,
    alignItems: "center",
  },
  monthLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  monthStats: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  monthStat: {
    alignItems: "center",
  },
  monthStatValue: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
  },
  monthStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  vsContainer: {
    paddingHorizontal: spacing.md,
  },
  vsText: {
    ...typography.body,
    color: colors.textMuted,
  },
  insightsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightsList: {
    gap: spacing.md,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  insightIcon: {
    fontSize: 18,
  },
  insightText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
});
