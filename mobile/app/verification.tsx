import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId, getAgencyId } from "../lib/auth";
import { colors, typography, spacing, radius, shadows } from "../theme";
import { VerificationDashboard } from "../components/verification/VerificationDashboard";
import { GradientBackground, GlassCard, GlowButton, FadeInView } from "../components/ui/Glass";
import { BackButton } from "../components/ui/BackButton";

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerType, setOwnerType] = useState<"personnel" | "agency" | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    loadVerificationData();
  }, []);

  async function loadVerificationData() {
    if (!supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError("Please log in to access verification");
        setLoading(false);
        return;
      }

      const profile = await getProfileIdAndRole(supabase, session.user.id);
      if (!profile) {
        setError("Profile not found. Please complete your account setup.");
        setLoading(false);
        return;
      }

      if (profile.role !== "personnel" && profile.role !== "agency") {
        setError("Verification is only available for Security Personnel and Agency accounts.");
        setLoading(false);
        return;
      }

      const profileId = profile.profileId;
      let foundOwnerId: string | null = null;

      if (profile.role === "personnel") {
        foundOwnerId = await getPersonnelId(supabase, profileId);

        if (!foundOwnerId) {
          // Try with profileId first
          const { data: newPersonnel, error: createError } = await supabase
            .from("personnel")
            .insert({
              user_id: profileId,
              display_name: session.user.email?.split("@")[0] || "Security Personnel",
              bio: null,
              city: "London",
            })
            .select("id")
            .single();

          if (!createError && newPersonnel) {
            foundOwnerId = newPersonnel.id;
          } else {
            // Try with auth user id
            const { data: newPersonnel2, error: createError2 } = await supabase
              .from("personnel")
              .insert({
                user_id: session.user.id,
                display_name: session.user.email?.split("@")[0] || "Security Personnel",
                bio: null,
                city: "London",
              })
              .select("id")
              .single();

            if (!createError2 && newPersonnel2) {
              foundOwnerId = newPersonnel2.id;
            }
          }
        }
      } else if (profile.role === "agency") {
        foundOwnerId = await getAgencyId(supabase, profileId);

        if (!foundOwnerId) {
          // Try with profileId first
          const { data: newAgency, error: createError } = await supabase
            .from("agencies")
            .insert({
              user_id: profileId,
              name: session.user.email?.split("@")[0] || "Security Agency",
              description: null,
              city: "London",
            })
            .select("id")
            .single();

          if (!createError && newAgency) {
            foundOwnerId = newAgency.id;
          } else {
            // Try with auth user id
            const { data: newAgency2, error: createError2 } = await supabase
              .from("agencies")
              .insert({
                user_id: session.user.id,
                name: session.user.email?.split("@")[0] || "Security Agency",
                description: null,
                city: "London",
              })
              .select("id")
              .single();

            if (!createError2 && newAgency2) {
              foundOwnerId = newAgency2.id;
            }
          }
        }
      }

      if (!foundOwnerId) {
        setError("Failed to set up verification. Please try again.");
        setLoading(false);
        return;
      }

      setOwnerType(profile.role as "personnel" | "agency");
      setOwnerId(foundOwnerId);
    } catch (err: unknown) {
      console.error("Error loading verification:", err);
      setError((err as Error).message || "Failed to load verification data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading verification...</Text>
        </View>
      </GradientBackground>
    );
  }

  if (error) {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <FadeInView>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.errorTitle}>Verification</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
              <View style={styles.backBtnWrap}>
                <GlowButton variant="secondary" onPress={() => router.back()}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </GlowButton>
              </View>
            </GlassCard>
          </FadeInView>
        </View>
      </GradientBackground>
    );
  }

  if (!ownerType || !ownerId) {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <FadeInView>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.errorTitle}>Verification</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  Unable to set up verification. Please try again or contact support.
                </Text>
              </View>
              <View style={styles.backBtnWrap}>
                <GlowButton variant="secondary" onPress={() => router.back()}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </GlowButton>
              </View>
            </GlassCard>
          </FadeInView>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: 100 }]}
      >
        <BackButton />
        
        <FadeInView>
          <View style={styles.header}>
            <Text style={styles.title}>Verification</Text>
            <Text style={styles.subtitle}>
              Complete your verification to start accepting bookings. All documents are securely
              stored and reviewed by our team.
            </Text>
          </View>
        </FadeInView>
        <FadeInView delay={100}>
          <VerificationDashboard ownerType={ownerType} ownerId={ownerId} />
        </FadeInView>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
  header: { marginBottom: spacing.xl },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  loadingText: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.md },
  errorCard: { alignItems: "center" },
  errorTitle: { ...typography.title, color: colors.text, marginBottom: spacing.lg },
  errorBox: {
    padding: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.error,
    width: "100%",
  },
  errorText: { ...typography.bodySmall, color: colors.error, textAlign: "center" },
  backBtnWrap: { marginTop: spacing.xl, width: "100%" },
  backBtnText: { ...typography.label, color: colors.text },
});
