import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getVenueById } from "../../data/dashboard";
import type { VenueRequest } from "../../data/dashboard";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius, shadows } from "../../theme";
import { GradientBackground, GlassCard, GlowButton, FadeInView } from "../../components/ui/Glass";
import { BackButton } from "../../components/ui/BackButton";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
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

function formatTimeRange(start: string, end?: string) {
  try {
    const s = new Date(start);
    const startStr = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (end) {
      const e = new Date(end);
      return `${startStr} – ${e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return startStr;
  } catch {
    return start;
  }
}

function VenueTypeLabel(t: string) {
  const labels: Record<string, string> = {
    club: "Club",
    bar: "Bar",
    stadium: "Stadium / Arena",
    event_space: "Event space",
    restaurant: "Restaurant",
    corporate: "Corporate",
    retail: "Retail",
    other: "Other",
  };
  return labels[t] ?? t;
}

function RequestCard({ r, index }: { r: VenueRequest; index: number }) {
  const rate = r.rateOffered != null ? `£${(r.rateOffered / 100).toFixed(2)}/hr` : null;
  return (
    <FadeInView delay={index * 50}>
      <View style={styles.requestCard}>
        <Text style={styles.requestTitle}>{r.title}</Text>
        <Text style={styles.requestMeta}>
          {formatDate(r.start)}
          {r.end ? ` · ${formatTimeRange(r.start, r.end)}` : ""}
        </Text>
        <Text style={styles.requestGuards}>
          {r.guardsCount} guard{r.guardsCount !== 1 ? "s" : ""} needed
          {rate ? ` · ${rate}` : ""}
        </Text>
        {r.certsRequired && r.certsRequired.length > 0 && (
          <Text style={styles.requestCerts}>Certs: {r.certsRequired.join(", ")}</Text>
        )}
        {r.description && <Text style={styles.requestDesc}>{r.description}</Text>}
      </View>
    </FadeInView>
  );
}

export default function VenueDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const venue = idStr ? getVenueById(idStr) : undefined;
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !idStr) return;
    supabase
      .from("venues")
      .select("owner_id")
      .eq("id", idStr)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.owner_id) setOwnerId(data.owner_id);
      });
  }, [idStr]);

  if (!venue) {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <FadeInView>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.error}>Venue not found.</Text>
              <GlowButton onPress={() => router.back()}>
                <Text style={styles.backBtnText}>Go back</Text>
              </GlowButton>
            </GlassCard>
          </FadeInView>
        </View>
      </GradientBackground>
    );
  }

  const totalGuards = venue.openRequests.reduce((s, r) => s + r.guardsCount, 0);

  return (
    <GradientBackground>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
        <BackButton />
        
        <FadeInView>
          <GlassCard>
            <Text style={styles.name}>{venue.name}</Text>

            {venue.venueType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{VenueTypeLabel(venue.venueType)}</Text>
              </View>
            )}

            {venue.address && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>{venue.address}</Text>
              </View>
            )}

            {venue.description && (
              <View style={styles.descSection}>
                <Text style={styles.descLabel}>About the venue</Text>
                <Text style={styles.desc}>{venue.description}</Text>
              </View>
            )}

            {venue.capacity != null && (
              <Text style={styles.capacity}>Capacity: {venue.capacity.toLocaleString()}</Text>
            )}

            {ownerId && (
              <View style={styles.messageBtnWrap}>
                <GlowButton
                  onPress={() => router.push({ pathname: "/chat/start", params: { other: ownerId } })}
                >
                  <Text style={styles.messageBtnText}>Message venue</Text>
                </GlowButton>
              </View>
            )}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={200}>
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>What we&apos;re looking for</Text>
            <Text style={styles.sectionMeta}>
              {venue.openRequests.length} open request{venue.openRequests.length !== 1 ? "s" : ""} ·{" "}
              {totalGuards} guard{totalGuards !== 1 ? "s" : ""} needed
            </Text>
            {venue.openRequests.map((r, index) => (
              <RequestCard key={r.id} r={r} index={index} />
            ))}
          </View>
        </FadeInView>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  errorCard: { alignItems: "center", paddingVertical: spacing.xxl },
  error: { ...typography.body, color: colors.text, marginBottom: spacing.lg },
  backBtnText: { ...typography.titleCard, color: colors.text },
  name: { ...typography.display, fontSize: 22, color: colors.text },
  typeBadge: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  typeBadgeText: { ...typography.caption, color: colors.accent, fontWeight: "500" },
  infoRow: { marginTop: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  value: { ...typography.body, color: colors.textSecondary },
  descSection: { marginTop: spacing.lg },
  descLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  desc: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  capacity: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg },
  messageBtnWrap: { marginTop: spacing.xl },
  messageBtnText: { ...typography.body, fontWeight: "600", color: colors.text },
  requestsSection: { marginTop: spacing.xl },
  sectionTitle: { ...typography.titleCard, color: colors.text },
  sectionMeta: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  requestCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    marginBottom: spacing.md,
  },
  requestTitle: { ...typography.titleCard, color: colors.text },
  requestMeta: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs },
  requestGuards: { ...typography.label, color: colors.accent, marginTop: spacing.sm, fontWeight: "500" },
  requestCerts: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  requestDesc: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
});
