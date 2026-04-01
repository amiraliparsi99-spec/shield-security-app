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

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerType, setOwnerType] = useState<"personnel" | "agency" | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

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
      setProfileId(profile.profileId);
      setAuthUserId(session.user.id);

      const { data: vData } = await supabase
        .from("verifications")
        .select("status")
        .eq("owner_type", profile.role)
        .eq("owner_id", foundOwnerId)
        .maybeSingle();
      if (vData?.status) setVerificationStatus(vData.status);
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

  if (verificationStatus === "verified") {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <FadeInView>
            <GlassCard style={styles.verifiedCard}>
              <View style={styles.verifiedIconWrap}>
                <Text style={styles.verifiedIcon}>{"\u2713"}</Text>
              </View>
              <Text style={styles.verifiedTitle}>Account Verified</Text>
              <Text style={styles.verifiedSubtitle}>
                Your identity and SIA licence have already been verified. No further action is needed.
              </Text>
              <TouchableOpacity
                style={styles.verifiedPaymentsBtn}
                onPress={() => router.replace("/(tabs)/payments")}
                activeOpacity={0.7}
              >
                <Text style={styles.verifiedPaymentsBtnText}>Go to Payments</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.verifiedBackBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.verifiedBackBtnText}>{"\u2190"} Back</Text>
              </TouchableOpacity>
            </GlassCard>
          </FadeInView>
        </View>
      </GradientBackground>
    );
  }

  return (
    <View style={styles.dashboardWrap}>
      <VerificationDashboard
        ownerType={ownerType}
        ownerId={ownerId}
        profileId={profileId ?? undefined}
        authUserId={authUserId ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardWrap: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl },
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
  verifiedCard: { alignItems: "center", paddingVertical: spacing.xxl },
  verifiedIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.successSoft,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  verifiedIcon: { fontSize: 36, color: colors.success },
  verifiedTitle: { ...typography.display, fontSize: 22, color: colors.text, marginBottom: spacing.sm },
  verifiedSubtitle: { ...typography.body, color: colors.textMuted, textAlign: "center", marginBottom: spacing.xl, lineHeight: 22 },
  verifiedPaymentsBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    width: "100%", alignItems: "center", marginBottom: spacing.md,
  },
  verifiedPaymentsBtnText: { ...typography.body, fontWeight: "600", color: colors.textInverse },
  verifiedBackBtn: {
    paddingVertical: 12, width: "100%", alignItems: "center",
  },
  verifiedBackBtnText: { ...typography.body, color: colors.textMuted },
});
