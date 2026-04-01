import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../lib/auth";
import { getPricingBreakdown } from "../lib/pricing";

type BookingFilter = "upcoming" | "live" | "all" | "past";

const FILTERS: { key: BookingFilter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live" },
  { key: "all", label: "All" },
  { key: "past", label: "Past" },
];

type VenueBooking = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  estimated_total: number | null;
  final_total: number | null;
  staff_requirements: any;
};

type ShiftFill = { booking_id: string; total: number; filled: number; role: string };

function fmtDay(iso: string | null) {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtTime(t: string | null) {
  if (!t) return "--:--";
  return t.slice(0, 5);
}

function getHours(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = eh - sh + (em - sm) / 60;
  if (h <= 0) h += 24;
  return h;
}

function getBookingCostAndStaff(booking: VenueBooking) {
  const pricing = getPricingBreakdown(booking);
  return {
    total: pricing.totalGBP,
    staffTotal: pricing.staffCount,
    roleLabel: pricing.roles[0]?.label || "Security",
  };
}

function statusLabel(s: string) {
  const lower = (s || "pending").toLowerCase();
  if (["pending", "confirmed"].includes(lower)) return "Awaiting Guards";
  if (lower === "in_progress" || lower === "active") return "Live";
  if (lower === "completed") return "Completed";
  if (lower === "cancelled") return "Cancelled";
  return s;
}

function statusColor(s: string) {
  const lower = (s || "pending").toLowerCase();
  if (["pending", "confirmed"].includes(lower)) return { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B" };
  if (lower === "in_progress" || lower === "active") return { bg: "rgba(16,185,129,0.12)", fg: "#10B981" };
  if (lower === "completed") return { bg: "rgba(59,130,246,0.12)", fg: "#3B82F6" };
  if (lower === "cancelled") return { bg: "rgba(239,68,68,0.12)", fg: "#EF4444" };
  return { bg: "rgba(255,255,255,0.06)", fg: colors.textMuted };
}

export default function VenueBookingsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<BookingFilter>("upcoming");
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [shiftFills, setShiftFills] = useState<ShiftFill[]>([]);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile) return;
      const venueId = await getVenueId(supabase, profile.profileId);
      if (!venueId) return;

      const { data: rows } = await supabase
        .from("bookings")
        .select("id, event_name, event_date, start_time, end_time, status, estimated_total, final_total, staff_requirements")
        .eq("venue_id", venueId)
        .order("event_date", { ascending: false });

      const bks = (rows || []) as VenueBooking[];
      setBookings(bks);

      if (bks.length > 0) {
        const ids = bks.map((b) => b.id);
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, booking_id, role, personnel_id")
          .in("booking_id", ids);

        const fillMap = new Map<string, { total: number; filled: number; role: string }>();
        for (const s of shifts || []) {
          const key = s.booking_id;
          const prev = fillMap.get(key) || { total: 0, filled: 0, role: s.role || "Security" };
          prev.total += 1;
          if (s.personnel_id) prev.filled += 1;
          prev.role = s.role || prev.role;
          fillMap.set(key, prev);
        }
        setShiftFills(
          [...fillMap.entries()].map(([booking_id, v]) => ({ booking_id, ...v }))
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const now = new Date();
    return bookings.filter((b) => {
      const s = (b.status || "").toLowerCase();
      const bDate = b.event_date ? new Date(`${b.event_date}T00:00:00`) : null;
      const upcoming = bDate ? bDate >= new Date(now.toDateString()) : false;
      if (filter === "upcoming") return upcoming && ["pending", "confirmed"].includes(s);
      if (filter === "live") return s === "in_progress" || s === "active";
      if (filter === "past") return s === "completed" || s === "cancelled";
      return true;
    });
  }, [bookings, filter]);

  const getFill = (bookingId: string) => shiftFills.find((f) => f.booking_id === bookingId);

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
        <View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Bookings</Text>
          <Text style={styles.pageCount}>{bookings.length} total</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push("/booking/new")} activeOpacity={0.85}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No bookings here</Text>
            <Text style={styles.emptySubtitle}>
              {filter === "all" ? "Create your first booking." : `No ${filter} bookings right now.`}
            </Text>
          </View>
        ) : (
          filtered.map((b) => {
            const sc = statusColor(b.status);
            const fill = getFill(b.id);
            const hours = getHours(b.start_time, b.end_time);
            const { total, staffTotal: reqStaffTotal, roleLabel: reqRoleLabel } = getBookingCostAndStaff(b);
            const roleLabel = reqRoleLabel || fill?.role || "Security";
            const staffTotal = fill?.total || reqStaffTotal || 1;
            const staffFilled = fill?.filled || 0;

            return (
              <TouchableOpacity
                key={b.id}
                style={styles.card}
                onPress={() => router.push(`/booking-manage?id=${b.id}`)}
                activeOpacity={0.75}
              >
                {/* Top row: name + status */}
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{b.event_name || "Security Booking"}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: sc.fg }]}>{statusLabel(b.status)}</Text>
                  </View>
                </View>

                {/* Date row */}
                <Text style={styles.cardDateRow}>
                  {fmtDay(b.event_date)}  ·  {fmtTime(b.start_time)} – {fmtTime(b.end_time)}  {hours > 0 ? `${hours.toFixed(1)}h` : ""}
                </Text>

                {/* Staff & price row */}
                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.cardStaff}>
                      {staffTotal} staff · {staffFilled}/{staffTotal} filled
                    </Text>
                    <Text style={styles.cardRole}>
                      {staffTotal}× {roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.cardPriceWrap}>
                    <Text style={styles.cardPriceLabel}>Est.</Text>
                    <Text style={styles.cardPrice}>£{total.toFixed(0)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backText: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  pageTitle: { ...typography.display, color: colors.text },
  pageCount: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  newBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  newBtnText: { ...typography.bodySmall, color: "#000", fontWeight: "700" },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  filterTextActive: { color: "#000", fontWeight: "700" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  emptyContainer: { alignItems: "center", paddingTop: spacing.xl * 3 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { ...typography.titleCard, color: colors.text, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", maxWidth: 260 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: "700", flex: 1, marginRight: spacing.sm },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  cardDateRow: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm },

  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cardStaff: { ...typography.bodySmall, color: colors.textSecondary },
  cardRole: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardPriceWrap: { alignItems: "flex-end" },
  cardPriceLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  cardPrice: { ...typography.titleCard, color: colors.accent, fontSize: 18 },
});
