import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, RefreshControl } from "react-native";
import { AGENCIES, AVAILABLE_PERSONNEL } from "../../data/dashboard";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../../lib/auth";
import { colors, typography, spacing, radius } from "../../theme";

type Tab = "personnel" | "agencies" | "bookings" | "payments";

type VenueBooking = {
  id: string;
  provider_type: string;
  provider_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guards_count: number;
  rate: number;
  currency: string;
  status: string;
  payment_status: string;
  event_name?: string;
  personnel?: {
    id: string;
    display_name: string;
    user_id: string;
  };
};

function formatMoney(rate: number, currency: string): string {
  const c = (currency || "GBP").toUpperCase();
  const sym = c === "GBP" ? "£" : c === "EUR" ? "€" : "$";
  return `${sym}${(rate / 100).toFixed(2)}`;
}

function filterPersonnel(q: string) {
  if (!q.trim()) return AVAILABLE_PERSONNEL;
  const lower = q.trim().toLowerCase();
  return AVAILABLE_PERSONNEL.filter(
    (p) =>
      p.display_name.toLowerCase().includes(lower) ||
      p.location.toLowerCase().includes(lower) ||
      (p.certs && p.certs.toLowerCase().includes(lower))
  );
}

function filterAgencies(q: string) {
  if (!q.trim()) return AGENCIES;
  const lower = q.trim().toLowerCase();
  return AGENCIES.filter(
    (a) =>
      a.name.toLowerCase().includes(lower) ||
      (a.location_name && a.location_name.toLowerCase().includes(lower)) ||
      (a.address && a.address.toLowerCase().includes(lower)) ||
      a.types.some((t) => t.toLowerCase().includes(lower))
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function VenueDashboard() {
  const [tab, setTab] = useState<Tab>("personnel");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueBookings, setVenueBookings] = useState<VenueBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const loadVenue = useCallback(async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const profile = await getProfileIdAndRole(supabase, user.id);
    if (!profile) return;
    const vId = await getVenueId(supabase, profile.profileId);
    setVenueId(vId ?? null);
    if (!vId) return;
    setLoadingBookings(true);
    const { data } = await supabase
      .from("bookings")
      .select(`
        id, provider_type, provider_id, event_date, start_time, end_time, 
        guards_count, rate, currency, status, payment_status, event_name,
        personnel:provider_id (id, display_name, user_id)
      `)
      .eq("venue_id", vId)
      .order("event_date", { ascending: false });
    setVenueBookings((data as VenueBooking[]) || []);
    setLoadingBookings(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVenue();
  }, [loadVenue]);

  useEffect(() => {
    loadVenue();
  }, [loadVenue]);

  const filteredPersonnel = useMemo(() => filterPersonnel(search), [search]);
  const filteredAgencies = useMemo(() => filterAgencies(search), [search]);
  const filteredBookings = useMemo(() => {
    if (!search.trim()) return venueBookings;
    const lower = search.trim().toLowerCase();
    return venueBookings.filter(
      (b) => b.provider_type.toLowerCase().includes(lower) || formatDate(b.event_date).toLowerCase().includes(lower)
    );
  }, [search, venueBookings]);

  const billingTotal = useMemo(
    () => venueBookings.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + (b.rate || 0), 0),
    [venueBookings]
  );

  const searchPlaceholder =
    tab === "personnel"
      ? "Search by name, location or certs…"
      : tab === "agencies"
        ? "Search agencies, type, or location…"
        : "Search by provider or date…";

  return (
    <View style={styles.container}>
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
        <TouchableOpacity onPress={() => router.push("/booking/new")} style={styles.quickAction} activeOpacity={0.7}>
          <Text style={styles.quickActionIcon}>➕</Text>
          <Text style={styles.quickActionText}>Book</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/analytics")} style={styles.quickAction} activeOpacity={0.7}>
          <Text style={styles.quickActionIcon}>📊</Text>
          <Text style={styles.quickActionText}>Analytics</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "personnel" && styles.tabActive]} onPress={() => setTab("personnel")}>
          <Text style={[styles.tabText, tab === "personnel" && styles.tabTextActive]}>Personnel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "agencies" && styles.tabActive]} onPress={() => setTab("agencies")}>
          <Text style={[styles.tabText, tab === "agencies" && styles.tabTextActive]}>Agencies</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "bookings" && styles.tabActive]} onPress={() => setTab("bookings")}>
          <Text style={[styles.tabText, tab === "bookings" && styles.tabTextActive]}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "payments" && styles.tabActive]} onPress={() => setTab("payments")}>
          <Text style={[styles.tabText, tab === "payments" && styles.tabTextActive]}>Payments</Text>
        </TouchableOpacity>
      </View>

      {tab !== "payments" && (
        <View style={styles.searchWrap}>
          <TextInput value={search} onChangeText={setSearch} placeholder={searchPlaceholder} placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
      )}

      {tab === "personnel" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Available for work</Text>
          <Text style={styles.sectionSubtitle}>Tap a profile to view details and book.</Text>
          {filteredPersonnel.length === 0 ? (
            <Text style={styles.noResults}>No personnel match your search.</Text>
          ) : (
            filteredPersonnel.map((p) => (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => router.push(`/personnel/${p.id}`)} activeOpacity={0.7}>
                <View style={styles.personRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{p.display_name[0]}</Text>
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.cardTitle}>{p.display_name}</Text>
                    <View style={[styles.badge, p.status === "available" && styles.badgeAvail]}>
                      <Text style={[styles.badgeText, p.status === "available" && styles.badgeTextAvail]}>{p.status === "available" ? "Available" : "Looking"}</Text>
                    </View>
                    <Text style={styles.cardMeta}>{p.location}</Text>
                    <Text style={styles.highlight}>{p.rate}</Text>
                  </View>
                  <Text style={styles.chevron}>→</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {tab === "agencies" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Security agencies</Text>
          <Text style={styles.sectionSubtitle}>Browse and tap for details.</Text>
          {filteredAgencies.length === 0 ? (
            <Text style={styles.noResults}>No agencies match your search.</Text>
          ) : (
            filteredAgencies.map((a) => (
              <TouchableOpacity key={a.id} style={styles.card} onPress={() => router.push(`/agency/${a.id}`)} activeOpacity={0.7}>
                <Text style={styles.cardTitle}>{a.name}</Text>
                <View style={styles.agencyTypes}>
                  {a.types.map((t) => (
                    <View key={t} style={styles.agencyTypeBadge}>
                      <Text style={styles.agencyTypeText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.cardMeta}>{a.address || a.location_name}</Text>
                <Text style={styles.highlight}>{a.staff_range && `${a.staff_range} staff`}{a.staff_range && a.rate_from && " · "}{a.rate_from}</Text>
                <Text style={styles.tapHint}>Tap for full details</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {tab === "bookings" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Your bookings</Text>
          <Text style={styles.sectionSubtitle}>Confirmed shifts. Tap to view that provider’s profile.</Text>
          {loadingBookings ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: spacing.xl }} />
          ) : filteredBookings.length === 0 ? (
            <Text style={styles.noResults}>
              {!venueId ? "Set up your venue in the web app to see bookings." : "No bookings yet. When you confirm shifts with personnel or agencies, they’ll appear here."}
            </Text>
          ) : (
            filteredBookings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.card}
                onPress={() => router.push(b.provider_type === "personnel" ? `/personnel/${b.provider_id}` : `/agency/${b.provider_id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardTitle}>{b.provider_type === "personnel" ? "Personnel" : "Agency"}</Text>
                <View style={[styles.badge, styles.badgeBooking]}>
                  <Text style={styles.badgeText}>{b.provider_type === "personnel" ? "Personnel" : "Agency"}</Text>
                </View>
                <Text style={styles.cardMeta}>{formatDate(b.event_date)} · {b.guards_count} guard{b.guards_count !== 1 ? "s" : ""}</Text>
                <Text style={styles.highlight}>{formatMoney(b.rate, b.currency)}</Text>
                <Text style={styles.tapHint}>View profile →</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {tab === "payments" && (
        <ScrollView 
          style={styles.scroll} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {/* Payment Stats */}
          <View style={styles.paymentStats}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Unpaid</Text>
              <Text style={[styles.statValue, styles.statValueWarning]}>
                {formatMoney(
                  venueBookings
                    .filter((b) => ["confirmed", "completed"].includes(b.status) && b.payment_status !== "paid")
                    .reduce((s, b) => s + (b.rate || 0), 0),
                  "GBP"
                )}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Paid</Text>
              <Text style={[styles.statValue, styles.statValueSuccess]}>
                {formatMoney(
                  venueBookings
                    .filter((b) => b.payment_status === "paid")
                    .reduce((s, b) => s + (b.rate || 0), 0),
                  "GBP"
                )}
              </Text>
            </View>
          </View>

          {/* Unpaid Bookings */}
          <Text style={styles.sectionTitle}>Awaiting Payment</Text>
          <Text style={styles.sectionSubtitle}>Tap to pay for completed shifts.</Text>
          {venueBookings.filter((b) => ["confirmed", "completed"].includes(b.status) && b.payment_status !== "paid").length === 0 ? (
            <Text style={styles.noResults}>All bookings are paid! 🎉</Text>
          ) : (
            venueBookings
              .filter((b) => ["confirmed", "completed"].includes(b.status) && b.payment_status !== "paid")
              .map((b) => (
                <TouchableOpacity 
                  key={b.id} 
                  style={styles.paymentCard}
                  onPress={() => router.push(`/booking/${b.id}/pay`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentCardHeader}>
                    <View>
                      <Text style={styles.paymentCardTitle}>{b.event_name || "Security Shift"}</Text>
                      <Text style={styles.paymentCardMeta}>{formatDate(b.event_date)}</Text>
                      {b.personnel && (
                        <Text style={styles.paymentCardProvider}>Guard: {b.personnel.display_name}</Text>
                      )}
                    </View>
                    <View style={styles.paymentCardRight}>
                      <Text style={styles.paymentCardAmount}>{formatMoney(b.rate, b.currency)}</Text>
                      <View style={styles.unpaidBadge}>
                        <Text style={styles.unpaidBadgeText}>UNPAID</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.payNowButton}
                    onPress={() => router.push(`/booking/${b.id}/pay`)}
                  >
                    <Text style={styles.payNowButtonText}>Pay Now →</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
          )}

          {/* Paid Bookings */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Payment History</Text>
          <Text style={styles.sectionSubtitle}>Completed payments.</Text>
          {venueBookings.filter((b) => b.payment_status === "paid").length === 0 ? (
            <Text style={styles.noResults}>No completed payments yet.</Text>
          ) : (
            venueBookings
              .filter((b) => b.payment_status === "paid")
              .map((b) => (
                <View key={b.id} style={styles.paidCard}>
                  <View style={styles.paidCardHeader}>
                    <View>
                      <Text style={styles.paidCardTitle}>{b.event_name || "Security Shift"}</Text>
                      <Text style={styles.paidCardMeta}>{formatDate(b.event_date)}</Text>
                    </View>
                    <View style={styles.paidCardRight}>
                      <Text style={styles.paidCardAmount}>{formatMoney(b.rate, b.currency)}</Text>
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidBadgeText}>PAID</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  quickActions: { 
    flexDirection: "row", 
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
  tabs: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xs, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xs },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.accentSoft },
  tabText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: "500" },
  tabTextActive: { color: colors.accent },
  searchWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderMuted },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 32 },
  sectionTitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "600" },
  sectionSubtitle: { ...typography.captionMuted, color: colors.textMuted, marginBottom: spacing.md },
  noResults: { ...typography.bodySmall, color: colors.textMuted, paddingVertical: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.titleCard, color: colors.text },
  cardMeta: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs },
  highlight: { ...typography.label, color: colors.accent, marginTop: spacing.sm, fontWeight: "500" },
  tapHint: { ...typography.captionMuted, color: colors.textMuted, marginTop: spacing.xs },
  personRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.accentSoft, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "600", color: colors.accent },
  personInfo: { flex: 1, marginLeft: spacing.md },
  badge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.warningSoft, marginTop: spacing.xs },
  badgeAvail: { backgroundColor: colors.successSoft },
  badgeBooking: { backgroundColor: colors.surfaceElevated },
  badgeText: { ...typography.captionMuted, color: colors.warning },
  badgeTextAvail: { color: colors.success },
  chevron: { fontSize: 16, color: colors.textMuted },
  agencyTypes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  agencyTypeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.accentSoft },
  agencyTypeText: { ...typography.captionMuted, color: colors.textSecondary },
  // Payment styles
  paymentStats: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  statLabel: { ...typography.caption, color: colors.textMuted },
  statValue: { ...typography.display, fontSize: 22, marginTop: spacing.xs },
  statValueWarning: { color: colors.warning },
  statValueSuccess: { color: colors.success },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  paymentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  paymentCardTitle: { ...typography.titleCard, color: colors.text },
  paymentCardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  paymentCardProvider: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  paymentCardRight: { alignItems: "flex-end" },
  paymentCardAmount: { ...typography.titleCard, color: colors.warning },
  unpaidBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  unpaidBadgeText: { ...typography.caption, color: colors.warning, fontWeight: "600", fontSize: 10 },
  payNowButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.md,
  },
  payNowButtonText: { ...typography.body, color: colors.text, fontWeight: "600" },
  paidCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  paidCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  paidCardTitle: { ...typography.body, color: colors.text },
  paidCardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  paidCardRight: { alignItems: "flex-end" },
  paidCardAmount: { ...typography.body, color: colors.success },
  paidBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  paidBadgeText: { ...typography.caption, color: colors.success, fontWeight: "600", fontSize: 10 },
});
