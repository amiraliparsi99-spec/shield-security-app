import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getVenueId } from "../../lib/auth";
import { colors, typography, spacing, radius } from "../../theme";

interface Personnel {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  hourly_rate: number | null;
  shield_score: number | null;
  total_shifts: number | null;
  experience_years: number | null;
  bio: string | null;
  is_active: boolean;
  sia_license_number: string | null;
  sia_expiry_date: string | null;
}

export default function PersonnelProfile() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [person, setPerson] = useState<Personnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPreferred, setIsPreferred] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [isVenue, setIsVenue] = useState(false);

  useEffect(() => {
    if (!supabase || !pid) return;
    (async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, display_name, first_name, last_name, city, hourly_rate, shield_score, total_shifts, experience_years, bio, is_active, sia_license_number, sia_expiry_date")
        .eq("id", pid)
        .maybeSingle();
      if (data) setPerson(data as Personnel);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await getProfileIdAndRole(supabase, user.id);
        if (profile?.role === "venue") {
          setIsVenue(true);
          const vid = await getVenueId(supabase, profile.profileId);
          if (vid) {
            setVenueId(vid);
            const { data: pref } = await supabase.from("preferred_staff").select("id").eq("venue_id", vid).eq("personnel_id", pid).maybeSingle();
            if (pref) setIsPreferred(true);
          }
        }
      }
      setLoading(false);
    })();
  }, [pid]);

  const togglePreferred = async () => {
    if (!supabase || !venueId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPreferred) {
      await supabase.from("preferred_staff").delete().eq("venue_id", venueId).eq("personnel_id", pid);
      setIsPreferred(false);
    } else {
      await supabase.from("preferred_staff").insert({ venue_id: venueId, personnel_id: pid });
      setIsPreferred(true);
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={[s.centered, { paddingTop: insets.top }]}>
        <Text style={{ ...typography.body, color: colors.textMuted }}>Guard not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = person.display_name || `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Guard";
  const initials = name.split(" ").map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join("");
  const rate = person.hourly_rate ?? 16;
  const isAvailable = person.is_active;
  const isSiaVerified = !!person.sia_license_number;
  const expYears = person.experience_years ?? 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Text style={s.backText}>‹</Text>
          <Text style={s.backLabel}>Back</Text>
        </TouchableOpacity>

        <Text style={s.pageTitle}>Profile</Text>

        {/* Avatar + Name + Badges */}
        <View style={s.profileSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{name}</Text>
          <View style={s.badges}>
            {isAvailable && (
              <View style={s.badge}>
                <View style={s.badgeDot} />
                <Text style={s.badgeLabel}>Available</Text>
              </View>
            )}
            {isSiaVerified && (
              <View style={s.badge}>
                <Text style={s.badgeCheck}>✓</Text>
                <Text style={s.badgeLabel}>SIA Verified</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{person.shield_score ?? 0}</Text>
            <Text style={s.statLabel}>Shield Score</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{person.total_shifts ?? 0}</Text>
            <Text style={s.statLabel}>Shifts</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{expYears > 0 ? `${expYears}y` : "—"}</Text>
            <Text style={s.statLabel}>Experience</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>£{rate}</Text>
            <Text style={s.statLabel}>Per Hour</Text>
          </View>
        </View>

        {/* Action Buttons (venue only) */}
        {isVenue && (
          <View style={s.actions}>
            <TouchableOpacity style={[s.actionBtn, isPreferred && s.actionBtnActive]} onPress={togglePreferred} activeOpacity={0.8}>
              <Text style={s.actionBtnText}>{isPreferred ? "★ Preferred Staff" : "☆ Add to Preferred"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.bookGuardBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/booking/new"); }}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[colors.accent, "#1fa89e"]} style={s.bookGuardGrad}>
                <Text style={s.bookGuardText}>Book this guard</Text>
                <Text style={s.bookGuardSub}>Create a booking and assign them</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Details Section */}
        <Text style={s.detailsTitle}>DETAILS</Text>

        <View style={s.detailRow}>
          <Text style={s.detailIcon}>📍</Text>
          <View style={s.detailInfo}>
            <Text style={s.detailLabel}>Location</Text>
            <Text style={s.detailValue}>{person.city || "Not specified"}</Text>
          </View>
        </View>

        <View style={s.detailRow}>
          <Text style={s.detailIcon}>💷</Text>
          <View style={s.detailInfo}>
            <Text style={s.detailLabel}>Hourly Rate</Text>
            <Text style={[s.detailValue, { color: colors.accent }]}>£{rate}/hr</Text>
          </View>
        </View>

        {expYears > 0 && (
          <View style={s.detailRow}>
            <Text style={s.detailIcon}>🏆</Text>
            <View style={s.detailInfo}>
              <Text style={s.detailLabel}>Experience</Text>
              <Text style={s.detailValue}>{expYears} years in security</Text>
            </View>
          </View>
        )}

        {person.bio ? (
          <View style={s.detailRow}>
            <Text style={s.detailIcon}>📝</Text>
            <View style={s.detailInfo}>
              <Text style={s.detailLabel}>About</Text>
              <Text style={s.detailValue}>{person.bio}</Text>
            </View>
          </View>
        ) : null}

        {isSiaVerified && person.sia_license_number && (
          <View style={s.detailRow}>
            <Text style={s.detailIcon}>🪪</Text>
            <View style={s.detailInfo}>
              <Text style={s.detailLabel}>SIA Licence</Text>
              <Text style={s.detailValue}>{person.sia_license_number}{person.sia_expiry_date ? ` · Exp ${person.sia_expiry_date}` : ""}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 100 },

  back: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, marginTop: spacing.sm },
  backText: { fontSize: 24, color: colors.accent, fontWeight: "300", marginRight: 4 },
  backLabel: { ...typography.body, color: colors.accent, fontWeight: "600" },

  pageTitle: { ...typography.title, color: colors.text, textAlign: "center", marginBottom: spacing.xl },

  profileSection: { alignItems: "center", marginBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#000" },
  name: { ...typography.title, color: colors.text, fontSize: 22, marginBottom: spacing.sm },
  badges: { flexDirection: "row", gap: spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(45,212,191,0.12)", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 6 },
  badgeCheck: { color: colors.accent, fontWeight: "700", fontSize: 12, marginRight: 4 },
  badgeLabel: { ...typography.caption, color: colors.accent, fontWeight: "600" },

  statsRow: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg, alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { ...typography.title, color: colors.text, fontSize: 18, fontWeight: "700" },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },

  actions: { marginBottom: spacing.xl, gap: spacing.sm },
  actionBtn: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.accent, paddingVertical: spacing.md, alignItems: "center" },
  actionBtnActive: { backgroundColor: "rgba(45,212,191,0.1)" },
  actionBtnText: { ...typography.body, color: colors.accent, fontWeight: "700" },
  bookGuardBtn: { borderRadius: radius.lg, overflow: "hidden" },
  bookGuardGrad: { paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.lg },
  bookGuardText: { ...typography.body, color: "#000", fontWeight: "700", fontSize: 16 },
  bookGuardSub: { ...typography.caption, color: "rgba(0,0,0,0.6)", marginTop: 2 },

  detailsTitle: { ...typography.caption, color: colors.textMuted, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.md },

  detailRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.lg },
  detailIcon: { fontSize: 18, marginRight: spacing.md, marginTop: 2 },
  detailInfo: { flex: 1 },
  detailLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  detailValue: { ...typography.body, color: colors.text, fontWeight: "500", lineHeight: 22 },
});
