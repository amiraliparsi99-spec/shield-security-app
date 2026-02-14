import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius, shadows } from "../../theme";
import { GradientBackground, GlassCard, GlowButton, FadeInView } from "../../components/ui/Glass";
import { BackButton } from "../../components/ui/BackButton";

function usePersonnel(id: string) {
  return {
    display_name: "Marcus Webb",
    location_name: "Central London, UK",
    experience_years: 8,
    experience_since_year: 2016,
    experience: "8 years in security · Since 2016",
    certs: ["SIA Door Supervisor", "First Aid at Work", "CCTV (PSS)"],
    rate: "£28.50/hr",
    status: "Available",
    reviewCount: 3,
    rating: "4.7",
  };
}

export default function PersonnelProfile() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "demo";
  const p = usePersonnel(idStr);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !idStr) return;
    supabase
      .from("personnel")
      .select("user_id")
      .eq("id", idStr)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.user_id) setUserId(data.user_id);
      });
  }, [idStr]);

  return (
    <GradientBackground>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
        <BackButton />
        
        <FadeInView>
          <GlassCard>
            <View style={styles.headerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{p.display_name.charAt(0)}</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.name}>{p.display_name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{p.status}</Text>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{p.location_name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Experience</Text>
              <Text style={styles.value}>{p.experience}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Rate</Text>
              <Text style={styles.valueHighlight}>{p.rate}</Text>
            </View>

            {userId && (
              <View style={styles.messageBtnWrap}>
                <GlowButton
                  onPress={() => router.push({ pathname: "/chat/start", params: { other: userId } })}
                >
                  <Text style={styles.messageBtnText}>Message</Text>
                </GlowButton>
              </View>
            )}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={100}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            <View style={styles.chipsContainer}>
              {p.certs.map((c, index) => (
                <FadeInView key={c} delay={150 + index * 50}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{c}</Text>
                  </View>
                </FadeInView>
              ))}
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={200}>
          <GlassCard style={styles.reviewsCard}>
            <Text style={styles.reviewsTitle}>Reviews</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingNumber}>{p.rating}</Text>
              <Text style={styles.ratingStars}>★★★★★</Text>
              <Text style={styles.reviewCount}>{p.reviewCount} reviews</Text>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.accentMuted,
  },
  avatarText: { fontSize: 24, fontWeight: "700", color: colors.accent },
  headerInfo: { marginLeft: spacing.md, flex: 1 },
  name: { ...typography.display, fontSize: 22, color: colors.text },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
  },
  badgeText: { ...typography.caption, color: colors.success, fontWeight: "600" },
  row: { marginTop: spacing.md },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  value: { ...typography.titleCard, color: colors.text },
  valueHighlight: { ...typography.titleCard, color: colors.accent },
  messageBtnWrap: { marginTop: spacing.xl },
  messageBtnText: { ...typography.body, fontWeight: "600", color: colors.text },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipText: { ...typography.bodySmall, color: colors.text },
  reviewsCard: { marginTop: spacing.xl },
  reviewsTitle: { ...typography.titleCard, color: colors.text, marginBottom: spacing.sm },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ratingNumber: { ...typography.display, fontSize: 28, color: colors.accent },
  ratingStars: { fontSize: 16, color: colors.warning },
  reviewCount: { ...typography.label, color: colors.textMuted },
});
