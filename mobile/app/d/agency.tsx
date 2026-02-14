import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getAgencyId } from "../../lib/auth";
import { colors, typography, spacing, radius } from "../../theme";

type Tab = "jobs" | "payments" | "team";

type Booking = {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guards_count: number;
  rate: number;
  currency: string;
  status: string;
  venue_id?: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMoney(rate: number, currency: string): string {
  const c = (currency || "GBP").toUpperCase();
  const sym = c === "GBP" ? "£" : c === "EUR" ? "€" : "$";
  return `${sym}${(rate / 100).toFixed(2)}`;
}

export default function AgencyDashboard() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("jobs");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Not connected");
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to view your dashboard");
      setLoading(false);
      return;
    }
    const profile = await getProfileIdAndRole(supabase, user.id);
    if (!profile) {
      setError("Complete your profile in the web app to use the dashboard.");
      setLoading(false);
      return;
    }
    const agencyId = await getAgencyId(supabase, profile.profileId);
    if (!agencyId) {
      setError("No agency profile found. Complete setup in the web app.");
      setLoading(false);
      return;
    }
    const { data, error: e } = await supabase
      .from("bookings")
      .select("id, event_date, start_time, end_time, guards_count, rate, currency, status, venue_id")
      .eq("provider_type", "agency")
      .eq("provider_id", agencyId)
      .order("event_date", { ascending: false });
    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completed = bookings.filter((b) => b.status === "completed");
  const earnings = completed.reduce((s, b) => s + (b.rate || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity onPress={() => router.push("/ai-assistant")} style={[styles.quickAction, styles.aiQuickAction]} activeOpacity={0.7}>
          <Text style={styles.quickActionIcon}>🛡️</Text>
          <Text style={styles.quickActionText}>Shield AI</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/messages")} style={styles.quickAction} activeOpacity={0.7}>
          <Text style={styles.quickActionIcon}>💬</Text>
          <Text style={styles.quickActionText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/staff")} style={styles.quickAction} activeOpacity={0.7}>
          <Text style={styles.quickActionIcon}>👥</Text>
          <Text style={styles.quickActionText}>Staff</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/analytics")} style={styles.quickAction} activeOpacity={0.7}>
          <Text style={styles.quickActionIcon}>📊</Text>
          <Text style={styles.quickActionText}>Analytics</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Agency dashboard</Text>
      <Text style={styles.subtitle}>Jobs, payments, and team. Secure access for verified agencies.</Text>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "jobs" && styles.tabActive]} onPress={() => setTab("jobs")}>
          <Text style={[styles.tabText, tab === "jobs" && styles.tabTextActive]}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "payments" && styles.tabActive]} onPress={() => setTab("payments")}>
          <Text style={[styles.tabText, tab === "payments" && styles.tabTextActive]}>Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "team" && styles.tabActive]} onPress={() => setTab("team")}>
          <Text style={[styles.tabText, tab === "team" && styles.tabTextActive]}>Team</Text>
        </TouchableOpacity>
      </View>

      {tab === "jobs" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Your jobs</Text>
          {bookings.length === 0 ? (
            <Text style={styles.empty}>No jobs yet. When venues book your agency, they’ll appear here.</Text>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={styles.jobCard}>
                <Text style={styles.jobDate}>{formatDate(b.event_date)}</Text>
                <Text style={styles.jobMeta}>
                  {b.guards_count} guard{b.guards_count !== 1 ? "s" : ""} · {formatMoney(b.rate, b.currency)}
                </Text>
                <View style={[styles.badge, b.status === "completed" && styles.badgeDone]}>
                  <Text style={styles.badgeText}>{b.status}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === "payments" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.paymentsCard}>
            <Text style={styles.paymentsLabel}>Total earned</Text>
            <Text style={styles.paymentsValue}>{formatMoney(earnings, "GBP")}</Text>
            <Text style={styles.paymentsMeta}>From {completed.length} completed job{completed.length !== 1 ? "s" : ""}</Text>
          </View>
          <Text style={styles.sectionTitle}>By job</Text>
          {completed.length === 0 ? (
            <Text style={styles.empty}>No completed jobs yet.</Text>
          ) : (
            completed.map((b) => (
              <View key={b.id} style={styles.row}>
                <Text style={styles.rowDate}>{formatDate(b.event_date)}</Text>
                <Text style={styles.rowAmount}>{formatMoney(b.rate, b.currency)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === "team" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>User data & team</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Team management coming soon</Text>
            <Text style={styles.placeholderSub}>Manage your personnel and assignments in a future update.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  errText: { ...typography.body, color: colors.text, textAlign: "center" },
  backBtn: { marginTop: spacing.lg, padding: spacing.md },
  backBtnText: { ...typography.titleCard, color: colors.accent },
  quickActions: { 
    flexDirection: "row", 
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: "center",
  },
  aiQuickAction: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },
  quickActionIcon: { fontSize: 20, marginBottom: 4 },
  quickActionText: { ...typography.caption, color: colors.textMuted, fontWeight: "500" },
  title: { ...typography.title, color: colors.text, paddingHorizontal: spacing.lg },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: 6, paddingHorizontal: spacing.lg },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.sm - 2 },
  tabActive: { backgroundColor: colors.accentSoft },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.accent },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: "600" },
  empty: { ...typography.bodySmall, color: colors.textMuted, paddingVertical: spacing.lg },
  jobCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  jobDate: { ...typography.titleCard, color: colors.text },
  jobMeta: { ...typography.label, color: colors.accent, marginTop: 4 },
  badge: { alignSelf: "flex-start", marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.warningSoft },
  badgeDone: { backgroundColor: colors.successSoft },
  badgeText: { ...typography.captionMuted, color: colors.textMuted },
  paymentsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  paymentsLabel: { ...typography.captionMuted, color: colors.textMuted, marginBottom: 4 },
  paymentsValue: { ...typography.display, fontSize: 26, color: colors.accent },
  paymentsMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderMuted },
  rowDate: { ...typography.bodySmall, color: colors.text },
  rowAmount: { ...typography.label, color: colors.accent },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  placeholderText: { ...typography.titleCard, color: colors.text },
  placeholderSub: { ...typography.bodySmall, color: colors.textMuted, marginTop: 6, textAlign: "center" },
});
