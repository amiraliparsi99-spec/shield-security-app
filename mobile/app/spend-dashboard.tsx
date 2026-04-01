import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../lib/auth";
import { getPricingBreakdown } from "../lib/pricing";

interface SpendItem {
  id: string;
  event_name: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  estimated_total: number | null;
  final_total: number | null;
  staff_requirements: any;
}

function calcCost(item: SpendItem): number {
  return getPricingBreakdown(item).totalGBP;
}

export default function SpendDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SpendItem[]>([]);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const profile = await getProfileIdAndRole(supabase, user.id);
        if (!profile) return;
        const venueId = await getVenueId(supabase, profile.profileId);
        if (!venueId) return;
        const { data } = await supabase
          .from("bookings")
          .select("id, event_name, event_date, start_time, end_time, status, estimated_total, final_total, staff_requirements")
          .eq("venue_id", venueId)
          .order("event_date", { ascending: false })
          .limit(100);
        setItems((data || []) as SpendItem[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { totalSpend, thisMonthSpend, confirmedSpend, pendingSpend, monthlyRows } = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let total = 0, thisM = 0, confirmed = 0, pending = 0;
    const monthly = new Map<string, number>();
    for (const row of items) {
      const cost = calcCost(row);
      total += cost;
      const status = (row.status || "").toLowerCase();
      if (status === "completed" || status === "confirmed") confirmed += cost;
      else pending += cost;
      if (row.event_date) {
        const d = new Date(row.event_date);
        const key = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
        monthly.set(key, (monthly.get(key) || 0) + cost);
        if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) thisM += cost;
      }
    }
    const monthlyRows = [...monthly.entries()].slice(0, 6).map(([month, amount]) => ({ month, amount }));
    return { totalSpend: total, thisMonthSpend: thisM, confirmedSpend: confirmed, pendingSpend: pending, monthlyRows };
  }, [items]);

  if (loading) {
    return (
      <View style={[s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const maxBar = Math.max(...monthlyRows.map((r) => r.amount), 1);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.backBtn}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.title}>Spend Dashboard</Text>
        <Text style={s.subtitle}>Your security spending overview</Text>

        {/* Hero total */}
        <LinearGradient colors={["rgba(45,212,191,0.12)", "rgba(45,212,191,0.03)"]} style={s.heroCard}>
          <Text style={s.heroLabel}>Total Spend</Text>
          <Text style={s.heroAmount}>£{totalSpend.toFixed(2)}</Text>
          <Text style={s.heroSub}>{items.length} bookings</Text>
        </LinearGradient>

        {/* Stat chips */}
        <View style={s.chipRow}>
          <View style={s.chip}>
            <Text style={s.chipLabel}>This Month</Text>
            <Text style={s.chipVal}>£{thisMonthSpend.toFixed(0)}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipLabel}>Confirmed</Text>
            <Text style={[s.chipVal, { color: "#10B981" }]}>£{confirmedSpend.toFixed(0)}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipLabel}>Pending</Text>
            <Text style={[s.chipVal, { color: "#F59E0B" }]}>£{pendingSpend.toFixed(0)}</Text>
          </View>
        </View>

        {/* Monthly chart */}
        {monthlyRows.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Monthly Spending</Text>
            {monthlyRows.map((row) => (
              <View key={row.month} style={s.barRow}>
                <Text style={s.barLabel}>{row.month}</Text>
                <View style={s.barTrack}>
                  <LinearGradient
                    colors={[colors.accent, "#1fa89e"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[s.barFill, { width: `${Math.max(4, (row.amount / maxBar) * 100)}%` }]}
                  />
                </View>
                <Text style={s.barAmount}>£{row.amount.toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent events */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Bookings</Text>
          {items.slice(0, 8).map((item) => {
            const cost = calcCost(item);
            const isConfirmed = ["completed", "confirmed"].includes((item.status || "").toLowerCase());
            return (
              <View key={item.id} style={s.eventCard}>
                <View style={[s.eventDot, isConfirmed ? s.eventDotGreen : s.eventDotOrange]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.eventName}>{item.event_name || "Security Booking"}</Text>
                  <Text style={s.eventMeta}>
                    {item.event_date ? new Date(item.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBC"}
                    {item.start_time ? ` · ${item.start_time}` : ""}
                  </Text>
                </View>
                <Text style={s.eventCost}>£{cost.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.sm },
  backBtn: { ...typography.body, color: colors.accent, fontWeight: "600" },
  title: { ...typography.display, color: colors.text, fontSize: 26 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },

  heroCard: { borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: "rgba(45,212,191,0.2)", marginBottom: spacing.lg },
  heroLabel: { ...typography.caption, color: colors.textMuted },
  heroAmount: { ...typography.display, color: colors.accent, fontSize: 36, marginTop: 4 },
  heroSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  chipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  chip: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  chipLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  chipVal: { ...typography.title, color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 4 },

  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: "700", marginBottom: spacing.md },

  barRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: spacing.sm },
  barLabel: { ...typography.caption, color: colors.textMuted, width: 56 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surface, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  barAmount: { ...typography.caption, color: colors.text, fontWeight: "600", width: 56, textAlign: "right" },

  eventCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xs },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.md },
  eventDotGreen: { backgroundColor: "#10B981" },
  eventDotOrange: { backgroundColor: "#F59E0B" },
  eventName: { ...typography.body, color: colors.text, fontWeight: "600" },
  eventMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  eventCost: { ...typography.body, color: colors.text, fontWeight: "700" },
});
