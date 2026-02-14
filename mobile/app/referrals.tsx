import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { safeHaptic } from "../lib/haptics";
import { SlideInView, FadeInView } from "../components/ui/AnimatedComponents";

interface ReferralData {
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  total_earned: number;
  tier: string;
}

interface ReferralSignup {
  id: string;
  status: string;
  created_at: string;
  referrer_reward: number;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  successful_referrals: number;
  tier: string;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

const TIER_THRESHOLDS = [
  { tier: "bronze", min: 0, max: 14 },
  { tier: "silver", min: 15, max: 29 },
  { tier: "gold", min: 30, max: 49 },
  { tier: "platinum", min: 50, max: Infinity },
];

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [signups, setSignups] = useState<ReferralSignup[]>([]);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get referral data
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/api/referrals`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReferral(data.referral);
        setSignups(data.signups || []);
        setAvailableCredits(data.availableCredits || 0);
        setMyPosition(data.leaderboardPosition);
      }

      // Get leaderboard
      const leaderboardResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/api/referrals/leaderboard?limit=10`
      );

      if (leaderboardResponse.ok) {
        const { leaderboard: lb } = await leaderboardResponse.json();
        setLeaderboard(lb || []);
      }
    } catch (error) {
      console.error("Error loading referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleCopyCode = async () => {
    if (!referral?.referral_code) return;
    
    await Clipboard.setStringAsync(referral.referral_code);
    safeHaptic("success");
    Alert.alert("Copied!", "Referral code copied to clipboard");
  };

  const handleShare = async () => {
    if (!referral?.referral_code) return;

    try {
      await Share.share({
        message: `Join Shield - the AI-powered security platform! Use my referral code ${referral.referral_code} to get £10 credit on your first booking. Download now: https://shield.app/download`,
        title: "Join Shield",
      });
      safeHaptic("success");
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const getNextTier = () => {
    if (!referral) return null;
    const current = TIER_THRESHOLDS.find((t) => t.tier === referral.tier);
    const nextIndex = TIER_THRESHOLDS.findIndex((t) => t.tier === referral.tier) + 1;
    if (nextIndex >= TIER_THRESHOLDS.length) return null;
    const next = TIER_THRESHOLDS[nextIndex];
    return {
      tier: next.tier,
      needed: next.min - referral.successful_referrals,
    };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const nextTier = getNextTier();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Referrals</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Referral Code Card */}
        <SlideInView delay={0}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{referral?.referral_code || "LOADING"}</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>📋 Copy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>🔗 Share with Friends</Text>
            </TouchableOpacity>
            <Text style={styles.rewardText}>
              You and your friend both get <Text style={styles.rewardHighlight}>£10</Text> when they complete their first booking!
            </Text>
          </View>
        </SlideInView>

        {/* Stats Cards */}
        <SlideInView delay={100}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{referral?.total_referrals || 0}</Text>
              <Text style={styles.statLabel}>Total Referrals</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{referral?.successful_referrals || 0}</Text>
              <Text style={styles.statLabel}>Successful</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>£{((referral?.total_earned || 0) / 100).toFixed(0)}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </View>
        </SlideInView>

        {/* Tier Progress */}
        <SlideInView delay={200}>
          <View style={styles.tierCard}>
            <View style={styles.tierHeader}>
              <View style={styles.tierBadge}>
                <Text style={[styles.tierEmoji, { color: TIER_COLORS[referral?.tier || "bronze"] }]}>
                  {referral?.tier === "platinum" ? "💎" : referral?.tier === "gold" ? "🥇" : referral?.tier === "silver" ? "🥈" : "🥉"}
                </Text>
                <Text style={[styles.tierName, { color: TIER_COLORS[referral?.tier || "bronze"] }]}>
                  {(referral?.tier || "bronze").charAt(0).toUpperCase() + (referral?.tier || "bronze").slice(1)}
                </Text>
              </View>
              {myPosition && (
                <Text style={styles.positionText}>#{myPosition} on leaderboard</Text>
              )}
            </View>
            
            {nextTier && (
              <View style={styles.progressSection}>
                <Text style={styles.progressLabel}>
                  {nextTier.needed} more referrals to {nextTier.tier}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          ((referral?.successful_referrals || 0) /
                            TIER_THRESHOLDS.find((t) => t.tier === nextTier.tier)!.min) *
                            100,
                          100
                        )}%`,
                        backgroundColor: TIER_COLORS[nextTier.tier],
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        </SlideInView>

        {/* Available Credits */}
        {availableCredits > 0 && (
          <SlideInView delay={300}>
            <View style={styles.creditsCard}>
              <Text style={styles.creditsIcon}>💰</Text>
              <View style={styles.creditsInfo}>
                <Text style={styles.creditsAmount}>£{(availableCredits / 100).toFixed(0)} Available</Text>
                <Text style={styles.creditsText}>Use on your next booking</Text>
              </View>
            </View>
          </SlideInView>
        )}

        {/* Leaderboard */}
        <SlideInView delay={400}>
          <View style={styles.leaderboardCard}>
            <Text style={styles.sectionTitle}>🏆 Top Referrers</Text>
            {leaderboard.length > 0 ? (
              leaderboard.map((entry, index) => (
                <View key={index} style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </Text>
                  <Text style={styles.leaderboardName} numberOfLines={1}>
                    {entry.display_name}
                  </Text>
                  <View style={styles.leaderboardStats}>
                    <Text style={styles.leaderboardCount}>{entry.successful_referrals}</Text>
                    <Text style={[styles.leaderboardTier, { color: TIER_COLORS[entry.tier] }]}>
                      {entry.tier}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Be the first on the leaderboard!</Text>
            )}
          </View>
        </SlideInView>

        {/* Recent Referrals */}
        <SlideInView delay={500}>
          <View style={styles.recentCard}>
            <Text style={styles.sectionTitle}>📋 Your Referrals</Text>
            {signups.length > 0 ? (
              signups.slice(0, 5).map((signup) => (
                <View key={signup.id} style={styles.signupRow}>
                  <View>
                    <Text style={styles.signupDate}>{formatDate(signup.created_at)}</Text>
                    <Text style={styles.signupStatus}>
                      {signup.status === "rewarded"
                        ? "✅ Completed"
                        : signup.status === "qualified"
                        ? "⏳ Qualified"
                        : "⏳ Pending"}
                    </Text>
                  </View>
                  <Text style={styles.signupReward}>
                    {signup.status === "rewarded" ? `+£${signup.referrer_reward / 100}` : "—"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                Share your code to start earning rewards!
              </Text>
            )}
          </View>
        </SlideInView>

        {/* How It Works */}
        <SlideInView delay={600}>
          <View style={styles.howItWorksCard}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Share your unique code with friends</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>They sign up and complete their first booking</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>You both get £10 credit!</Text>
            </View>
          </View>
        </SlideInView>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  codeCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  codeLabel: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.8,
    marginBottom: spacing.sm,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  codeText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 2,
  },
  copyBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  copyBtnText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  shareBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  shareBtnText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  rewardText: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.9,
    textAlign: "center",
  },
  rewardHighlight: {
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
    fontSize: 24,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  tierCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tierEmoji: {
    fontSize: 24,
  },
  tierName: {
    ...typography.title,
    fontSize: 18,
    textTransform: "capitalize",
  },
  positionText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  creditsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  creditsIcon: {
    fontSize: 32,
  },
  creditsInfo: {
    flex: 1,
  },
  creditsAmount: {
    ...typography.title,
    color: "#10B981",
    fontSize: 18,
  },
  creditsText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  leaderboardCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leaderboardRank: {
    fontSize: 18,
    width: 36,
  },
  leaderboardName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  leaderboardStats: {
    alignItems: "flex-end",
  },
  leaderboardCount: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  leaderboardTier: {
    ...typography.caption,
    textTransform: "capitalize",
  },
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signupDate: {
    ...typography.body,
    color: colors.text,
  },
  signupStatus: {
    ...typography.caption,
    color: colors.textMuted,
  },
  signupReward: {
    ...typography.body,
    color: "#10B981",
    fontWeight: "600",
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  howItWorksCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    color: colors.text,
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "700",
  },
  stepText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
});
