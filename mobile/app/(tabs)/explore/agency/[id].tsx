import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAgencyById } from "../../../../data/dashboard";
import { supabase } from "../../../../lib/supabase";
import { colors, typography, spacing, radius } from "../../../../theme";
import { GradientBackground, GlassCard, GlowButton, FadeInView } from "../../../../components/ui/Glass";
import { BackButton } from "../../../../components/ui/BackButton";

export default function AgencyDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const agency = idStr ? getAgencyById(idStr) : undefined;
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !idStr) return;
    supabase
      .from("agencies")
      .select("owner_id")
      .eq("id", idStr)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.owner_id) setOwnerId(data.owner_id);
      });
  }, [idStr]);

  if (!agency) {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <FadeInView>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.error}>Agency not found.</Text>
              <GlowButton onPress={() => router.back()}>
                <Text style={styles.backBtnText}>Go back</Text>
              </GlowButton>
            </GlassCard>
          </FadeInView>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
        <BackButton />
        
        <FadeInView>
          <GlassCard>
            <Text style={styles.name}>{agency.name}</Text>

            <View style={styles.typesRow}>
              {agency.types.map((t, index) => (
                <FadeInView key={t} delay={index * 50}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{t}</Text>
                  </View>
                </FadeInView>
              ))}
            </View>

            {(agency.address || agency.location_name) && (
              <View style={styles.row}>
                <Text style={styles.label}>Location</Text>
                <Text style={styles.value}>{agency.address || agency.location_name}</Text>
              </View>
            )}

            {(agency.staff_range || agency.rate_from) && (
              <View style={styles.metaRow}>
                {agency.staff_range && <Text style={styles.meta}>Staff: {agency.staff_range}</Text>}
                {agency.rate_from && <Text style={[styles.meta, styles.rate]}>{agency.rate_from}</Text>}
              </View>
            )}

            {agency.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.desc}>{agency.description}</Text>
              </View>
            )}

            <View style={styles.ctaRow}>
              {ownerId && (
                <GlowButton
                  onPress={() => router.push({ pathname: "/chat/start", params: { other: ownerId } })}
                >
                  <Text style={styles.ctaText}>Message</Text>
                </GlowButton>
              )}
              <GlowButton variant="secondary" onPress={() => router.push("/")}>
                <Text style={styles.ctaText}>Request a quote</Text>
              </GlowButton>
            </View>
          </GlassCard>
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
  typesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  typeBadgeText: { ...typography.caption, color: colors.accent, fontWeight: "500" },
  row: { marginTop: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  value: { ...typography.body, color: colors.textSecondary },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.lg },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  rate: { color: colors.accent, fontWeight: "600" },
  section: { marginTop: spacing.xl },
  sectionTitle: { ...typography.titleCard, color: colors.text },
  desc: { ...typography.body, color: colors.textSecondary, lineHeight: 24, marginTop: spacing.sm },
  ctaRow: { marginTop: spacing.xl, gap: spacing.md },
  ctaText: { ...typography.body, fontWeight: "600", color: colors.text },
});
