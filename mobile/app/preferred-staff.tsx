import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../lib/auth";

type Filter = "all" | "preferred" | "blocked";

interface StaffRow {
  id: string;
  display_name: string | null;
  city: string | null;
  shield_score: number | null;
  hourly_rate: number | null;
  status: "preferred" | "blocked" | "neutral";
  shifts_count: number;
}

export default function PreferredStaffScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile) return;
      const vid = await getVenueId(supabase, profile.profileId);
      if (!vid) return;
      setVenueId(vid);

      const { data: preferredRows } = await supabase.from("preferred_staff").select("personnel_id").eq("venue_id", vid);
      const { data: blockedRows } = await supabase.from("blocked_staff").select("personnel_id").eq("venue_id", vid);
      const preferredSet = new Set((preferredRows || []).map((r: any) => r.personnel_id));
      const blockedSet = new Set((blockedRows || []).map((r: any) => r.personnel_id));

      const { data: bookingRows } = await supabase.from("bookings").select("id").eq("venue_id", vid).limit(200);
      const bookingIds = (bookingRows || []).map((b: any) => b.id);

      const countMap = new Map<string, number>();
      if (bookingIds.length > 0) {
        const { data: shifts } = await supabase.from("shifts").select("personnel_id").in("booking_id", bookingIds).not("personnel_id", "is", null);
        for (const sh of shifts || []) {
          const pid = sh.personnel_id as string | null;
          if (!pid) continue;
          countMap.set(pid, (countMap.get(pid) || 0) + 1);
        }
      }

      const staffIds = [...new Set([...countMap.keys(), ...preferredSet, ...blockedSet])];
      if (staffIds.length === 0) { setStaff([]); return; }

      const { data: personnelRows } = await supabase
        .from("personnel")
        .select("id, display_name, city, shield_score, hourly_rate")
        .in("id", staffIds);

      const rows: StaffRow[] = (personnelRows || []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name || "Guard",
        city: p.city,
        shield_score: p.shield_score,
        hourly_rate: p.hourly_rate,
        shifts_count: countMap.get(p.id) || 0,
        status: blockedSet.has(p.id) ? "blocked" : preferredSet.has(p.id) ? "preferred" : "neutral",
      }));
      setStaff(rows.sort((a, b) => b.shifts_count - a.shifts_count));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (q && !(s.display_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, search, filter]);

  const setStatus = async (staffId: string, newStatus: "preferred" | "blocked" | "neutral") => {
    if (!supabase || !venueId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await supabase.from("preferred_staff").delete().eq("venue_id", venueId).eq("personnel_id", staffId);
      await supabase.from("blocked_staff").delete().eq("venue_id", venueId).eq("personnel_id", staffId);
      if (newStatus === "preferred") await supabase.from("preferred_staff").insert({ venue_id: venueId, personnel_id: staffId });
      else if (newStatus === "blocked") await supabase.from("blocked_staff").insert({ venue_id: venueId, personnel_id: staffId });
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update.");
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const preferredCount = staff.filter((x) => x.status === "preferred").length;
  const blockedCount = staff.filter((x) => x.status === "blocked").length;

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: staff.length },
    { id: "preferred", label: "⭐ Preferred", count: preferredCount },
    { id: "blocked", label: "Blocked", count: blockedCount },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing.sm }}>
          <Text style={s.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Preferred Staff</Text>
        <Text style={s.subtitle}>Manage your favourite guards</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { borderColor: colors.accent }]}>
            <Text style={s.statNum}>{staff.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: "#10B981" }]}>{preferredCount}</Text>
            <Text style={s.statLabel}>Preferred</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { color: colors.error }]}>{blockedCount}</Text>
            <Text style={s.statLabel}>Blocked</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search by name..." placeholderTextColor={colors.textMuted} />
        </View>

        {/* Filter pills */}
        <View style={s.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f.id} style={[s.filterPill, filter === f.id && s.filterPillActive]} onPress={() => setFilter(f.id)}>
              <Text style={[s.filterPillText, filter === f.id && s.filterPillTextActive]}>{f.label} ({f.count})</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Staff list */}
        {filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 28 }}>👥</Text>
            <Text style={s.emptyTitle}>No staff found</Text>
            <Text style={s.emptySub}>Guards who work your events will appear here</Text>
          </View>
        ) : (
          filtered.map((row) => {
            const initials = (row.display_name || "?").split(" ").map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join("");
            const isPref = row.status === "preferred";
            const isBlocked = row.status === "blocked";
            return (
              <TouchableOpacity key={row.id} style={s.card} onPress={() => router.push(`/personnel/${row.id}`)} activeOpacity={0.7}>
                <View style={[s.avatar, isPref && s.avatarPref, isBlocked && s.avatarBlocked]}>
                  <Text style={[s.avatarText, isPref && { color: "#000" }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.cardName}>{row.display_name}</Text>
                    {isPref && <Text style={{ fontSize: 12 }}>⭐</Text>}
                    {isBlocked && <Text style={{ fontSize: 12 }}>🚫</Text>}
                  </View>
                  <Text style={s.cardMeta}>
                    {row.city || "—"} · Shield {row.shield_score ?? 0} · {row.shifts_count} shift{row.shifts_count !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={s.cardRate}>£{row.hourly_rate ?? 16}/hr</Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity
                      style={[s.actionChip, isPref && s.actionChipActive]}
                      onPress={(e) => { e.stopPropagation(); setStatus(row.id, isPref ? "neutral" : "preferred"); }}
                      hitSlop={8}
                    >
                      <Text style={[s.actionChipText, isPref && s.actionChipTextActive]}>{isPref ? "★" : "☆"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionChip, isBlocked && s.actionChipDanger]}
                      onPress={(e) => { e.stopPropagation(); setStatus(row.id, isBlocked ? "neutral" : "blocked"); }}
                      hitSlop={8}
                    >
                      <Text style={[s.actionChipText, isBlocked && s.actionChipTextDanger]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: 100 },
  backBtn: { ...typography.body, color: colors.accent, fontWeight: "600" },
  title: { ...typography.display, color: colors.text, fontSize: 26 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },

  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  statNum: { ...typography.title, color: colors.accent, fontSize: 22, fontWeight: "700" },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchIcon: { fontSize: 14, marginRight: spacing.sm },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 12 },

  filterRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterPillText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  filterPillTextActive: { color: "#000", fontWeight: "700" },

  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  emptyTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
  emptySub: { ...typography.caption, color: colors.textMuted, textAlign: "center" },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(45,212,191,0.12)", alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  avatarPref: { backgroundColor: colors.accent },
  avatarBlocked: { backgroundColor: "rgba(239,68,68,0.15)" },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  cardName: { ...typography.body, color: colors.text, fontWeight: "600" },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardRate: { ...typography.bodySmall, color: colors.accent, fontWeight: "700" },

  actionChip: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  actionChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionChipDanger: { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)" },
  actionChipText: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },
  actionChipTextActive: { color: "#000" },
  actionChipTextDanger: { color: colors.error },
});
