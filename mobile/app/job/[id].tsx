import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";
import { BackButton } from "../../components/ui/BackButton";
import { getProfileIdAndRole, getPersonnelId, isPersonnelVerified, isPersonnelBankConnected } from "../../lib/auth";
import { getClaimAvailabilityWarning } from "../../lib/shiftAvailabilityClaimCheck";
import { safeHaptic } from "../../lib/haptics";
import { isMissingColumnError } from "../../lib/postgresErrors";
import { bookingDisplayName } from "../../lib/bookingDisplay";
import { ShiftLocationCard } from "../../components/shift/ShiftLocationCard";
import { claimShiftWithLocation } from "../../lib/shiftClaim";
import { isActiveUrgentCover, isClaimableOnMarketplace, remainingMinutes } from "../../lib/shiftMarketplace";

type JobDetail = {
  id: string;
  role: string;
  personnel_id: string | null;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  is_urgent?: boolean | null;
  dispatcher_status?: string | null;
  cover_search_wave?: number | null;
  booking: {
    id: string;
    event_name: string;
    status?: string | null;
    brief_notes: string | null;
    site_label?: string | null;
    site_address_text?: string | null;
    site_latitude?: number | null;
    site_longitude?: number | null;
    venue_location?: {
      label?: string | null;
      address_line1?: string | null;
      city?: string | null;
      postcode?: string | null;
    } | null;
    venue: {
      id: string;
      name: string;
      city: string;
      address_line1: string | null;
      postcode?: string | null;
    } | null;
  } | null;
};

function extractAttireRequirement(briefNotes?: string | null): string | null {
  if (!briefNotes) return null;
  const match = briefNotes.match(/Attire requirement:\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !id) return;
      setLoading(true);
      const jobSelectFull = `
            id, role, personnel_id, hourly_rate, scheduled_start, scheduled_end, status,
            is_urgent, dispatcher_status, cover_search_wave,
            booking:bookings(
              id, event_name, status, brief_notes, site_label, site_address_text, site_latitude, site_longitude,
              venue_location:venue_locations!venue_location_id(label, address_line1, city, postcode),
              venue:venues(id, name, city, address_line1, postcode, latitude, longitude)
            )
          `;
      const jobSelectLegacy = `
            id, role, personnel_id, hourly_rate, scheduled_start, scheduled_end, status,
            booking:bookings(
              id, event_name, brief_notes, site_label,
              venue_location:venue_locations!venue_location_id(label, address_line1, city, postcode),
              venue:venues(id, name, city, address_line1, postcode)
            )
          `;

      let shiftRes = await supabase.from("shifts").select(jobSelectFull).eq("id", id).single();
      if (shiftRes.error && isMissingColumnError(shiftRes.error)) {
        shiftRes = await supabase.from("shifts").select(jobSelectLegacy).eq("id", id).single();
      }

      const { data: authData } = await supabase.auth.getUser();

      if (!cancelled) {
        setJob((shiftRes.data || null) as any);
      }

      const user = authData?.user;
      if (user && supabase) {
        const profile = await getProfileIdAndRole(supabase, user.id);
        if (profile) {
          const pid = await getPersonnelId(supabase, profile.profileId);
          if (!cancelled) setPersonnelId(pid || null);
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const attire = useMemo(() => extractAttireRequirement(job?.booking?.brief_notes), [job?.booking?.brief_notes]);
  const otherNotes = useMemo(() => {
    const notes = job?.booking?.brief_notes || "";
    return notes.replace(/Attire requirement:\s*.+/i, "").trim();
  }, [job?.booking?.brief_notes]);

  const handleClaimShift = async () => {
    if (!job || !supabase || !personnelId) return;

    const showFinalClaimConfirmation = () => {
      Alert.alert(
        "Do you want to claim this shift?",
        "If you continue, you'll be assigned to this shift immediately.",
        [
          { text: "Cancel claim", style: "cancel" },
          { text: "Claim shift", onPress: () => runClaim() },
        ]
      );
    };

    const verified = await isPersonnelVerified(supabase, personnelId);
    if (!verified) {
      Alert.alert("Verification Required", "Please complete ID/SIA verification before claiming.");
      return;
    }
    const bankConnected = await isPersonnelBankConnected(supabase, personnelId);
    if (!bankConnected) {
      Alert.alert("Connect Bank Account", "Please connect your bank account in Payments before claiming.");
      return;
    }

    try {
      const warning = await getClaimAvailabilityWarning(supabase, personnelId, job.scheduled_start, job.scheduled_end);
      if (warning.shouldWarn) {
        Alert.alert(warning.title, warning.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Claim anyway", onPress: showFinalClaimConfirmation },
        ]);
        return;
      }
    } catch {}

    showFinalClaimConfirmation();
  };

  const runClaim = async () => {
    if (!job || !supabase || !personnelId) return;
    setClaiming(true);
    safeHaptic("medium");
    try {
      await claimShiftWithLocation(job.id, personnelId);
      safeHaptic("success");
      Alert.alert("Shift claimed", "You are now confirmed for this shift.");
      setJob((prev) => (prev ? { ...prev, personnel_id: personnelId, status: "accepted" } : prev));
    } catch (e: any) {
      Alert.alert("Unable to claim", e?.message || "This shift may already be claimed.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyText}>Job not found.</Text>
      </View>
    );
  }

  const start = new Date(job.scheduled_start);
  const end = new Date(job.scheduled_end);
  const hours = Math.max(0, (end.getTime() - start.getTime()) / 3600000);
  const estimatedPay = Math.round(hours * (job.hourly_rate || 0));
  const isAvailable = isClaimableOnMarketplace(
    {
      status: job.status,
      personnel_id: job.personnel_id,
      scheduled_start: job.scheduled_start,
      scheduled_end: job.scheduled_end,
      is_urgent: job.is_urgent,
      dispatcher_status: job.dispatcher_status,
      cover_search_wave: job.cover_search_wave,
    },
    { bookingStatus: job.booking?.status },
  );
  const urgentCover = isActiveUrgentCover({
    status: job.status,
    personnel_id: job.personnel_id,
    scheduled_start: job.scheduled_start,
    scheduled_end: job.scheduled_end,
    is_urgent: job.is_urgent,
    dispatcher_status: job.dispatcher_status,
    cover_search_wave: job.cover_search_wave,
  });
  const unavailableLabel =
    job.status === "cancelled"
      ? "This shift was cancelled"
      : job.personnel_id
        ? "Already claimed"
        : "No longer available";

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#08151a", "#0e1118", "#07080f"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Job Card</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["rgba(45,212,191,0.2)", "rgba(45,212,191,0.04)"]} style={styles.hero}>
            {urgentCover ? (
              <Text style={styles.urgentBadge}>
                URGENT COVER · {remainingMinutes(job.scheduled_end)} min left
              </Text>
            ) : null}
            <Text style={styles.title}>{job.booking?.event_name || "Event"}</Text>
            <Text style={styles.subtitle}>{job.role}</Text>
            <Text style={styles.payLine}>~£{estimatedPay} • {hours.toFixed(1)}h at £{job.hourly_rate}/hr</Text>
          </LinearGradient>

          <View style={styles.row}>
            <View style={styles.cardHalf}>
              <Text style={styles.label}>🕐 Time</Text>
              <Text style={styles.value}>
                {start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </Text>
              <Text style={styles.subtle}>
                {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} -{" "}
                {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <View style={styles.cardHalf}>
              <Text style={styles.label}>👔 Attire</Text>
              <Text style={styles.value}>{attire || "No specific attire"}</Text>
            </View>
          </View>

          <ShiftLocationCard booking={job.booking} variant="full" />

          <View style={styles.section}>
            <Text style={styles.label}>🎟️ Who & Event Type</Text>
            <Text style={styles.value}>{job.booking?.venue?.name || "Venue team"}</Text>
            <Text style={styles.subtle}>{job.role} for {job.booking?.event_name || "event security"}</Text>
          </View>

          {otherNotes ? (
            <View style={styles.section}>
              <Text style={styles.label}>📝 Details Description</Text>
              <Text style={styles.value}>{otherNotes}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.claimCta, (!isAvailable || claiming) && styles.claimCtaDisabled]}
            onPress={handleClaimShift}
            disabled={!isAvailable || claiming}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={!isAvailable || claiming ? ["#4b5563", "#374151"] : [colors.accent, "#1fa89e"]}
              style={styles.claimCtaInner}
            >
              {claiming ? (
                <ActivityIndicator size="small" color="#04110f" />
              ) : (
                <Text style={styles.claimCtaText}>
                  {isAvailable
                    ? urgentCover
                      ? "Accept urgent cover"
                      : "Claim my shift"
                    : unavailableLabel}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.title, color: colors.text },
  content: { padding: spacing.md, paddingBottom: 120 },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(45,212,191,0.35)",
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, marginBottom: 2 },
  urgentBadge: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  subtitle: { ...typography.body, color: colors.textSecondary },
  payLine: { ...typography.caption, color: "#7ee7d8", marginTop: spacing.xs, fontWeight: "700" },
  row: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  cardHalf: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: 6, fontWeight: "700" },
  value: { ...typography.body, color: colors.text },
  subtle: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  claimCta: { marginTop: spacing.sm, borderRadius: radius.lg, overflow: "hidden" },
  claimCtaDisabled: { opacity: 0.72 },
  claimCtaInner: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  claimCtaText: { ...typography.body, color: "#04110f", fontWeight: "800", fontSize: 16 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  emptyText: { ...typography.body, color: colors.textMuted },
});
