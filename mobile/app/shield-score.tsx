/**
 * Shield Score Screen
 * Explains the guard's Shield Score in plain English: what it is, what it's
 * made of, and how to improve it. (Earnings & shift stats live in /stats.)
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { GuestGate } from "../components/auth/GuestGate";

interface ScoreData {
  shieldScore: number;
  siaVerified: boolean;
  dbsVerified: boolean;
  rtwVerified: boolean;
  totalShifts: number;
  avgRating: number;
  reviewCount: number;
  trainingCount: number;
}

function getScoreLabel(score: number) {
  if (score >= 95) return "Elite";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Great";
  if (score >= 70) return "Good";
  return "Building";
}

function getScoreColor(score: number) {
  if (score >= 90) return "#34d399";
  if (score >= 75) return "#60a5fa";
  if (score >= 60) return "#fbbf24";
  return "#f87171";
}

export default function ShieldScoreScreen() {
  return (
    <GuestGate feature="stats" redirectAfter="/shield-score">
      <ShieldScoreContent />
    </GuestGate>
  );
}

function ShieldScoreContent() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ScoreData | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile?.profileId) return;
      const personnelId = await getPersonnelId(supabase, profile.profileId);
      if (!personnelId) return;

      const [{ data: person }, { data: reviewRows }, { count: trainingCount }] =
        await Promise.all([
          supabase
            .from("personnel")
            .select(
              "shield_score, sia_verified, dbs_verified, right_to_work_verified, total_shifts"
            )
            .eq("id", personnelId)
            .single(),
          supabase
            .from("reviews")
            .select("overall_rating")
            .in("reviewee_id", [personnelId, profile.profileId]),
          supabase
            .from("training_completions")
            .select("id", { count: "exact", head: true })
            .eq("personnel_id", personnelId),
        ]);

      const ratings = (reviewRows || []).map((r: any) => Number(r.overall_rating || 0));
      const avgRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      setData({
        shieldScore: typeof person?.shield_score === "number" ? person.shield_score : 0,
        siaVerified: !!person?.sia_verified,
        dbsVerified: !!person?.dbs_verified,
        rtwVerified: !!person?.right_to_work_verified,
        totalShifts: person?.total_shifts ?? 0,
        avgRating,
        reviewCount: ratings.length,
        trainingCount: trainingCount ?? 0,
      });
    } catch (e) {
      console.error("Error loading shield score:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const score = data?.shieldScore ?? 0;
  const scoreColor = getScoreColor(score);
  const verifiedCount = [data?.siaVerified, data?.dbsVerified, data?.rtwVerified].filter(
    Boolean
  ).length;

  const tips: { icon: string; text: string; done: boolean }[] = [
    {
      icon: "🛡️",
      text: "Get your SIA licence verified",
      done: !!data?.siaVerified,
    },
    {
      icon: "✅",
      text: "Complete your DBS check",
      done: !!data?.dbsVerified,
    },
    {
      icon: "⭐",
      text: "Earn 5-star reviews by being professional on every shift",
      done: (data?.avgRating ?? 0) >= 4.5 && (data?.reviewCount ?? 0) >= 5,
    },
    {
      icon: "⏰",
      text: "Always check in on time — no-shows hit your score hardest",
      done: false,
    },
    {
      icon: "🎓",
      text: "Pass training modules to boost your score",
      done: (data?.trainingCount ?? 0) >= 3,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shield Score</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Score hero */}
        <View style={styles.heroCard}>
          <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
            <Text style={styles.scoreOutOf}>/ 100</Text>
          </View>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>{getScoreLabel(score)}</Text>
          <Text style={styles.heroText}>
            Your Shield Score shows venues how reliable and well-reviewed you are. A higher
            score means you appear higher in searches and get offered more work.
          </Text>
        </View>

        {/* Breakdown */}
        <Text style={styles.sectionHeading}>What makes up your score</Text>

        <TouchableOpacity
          style={styles.factorCard}
          onPress={() => router.push("/verification")}
          activeOpacity={0.7}
        >
          <Text style={styles.factorIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.factorTitle}>Verification</Text>
            <Text style={styles.factorSub}>{verifiedCount}/3 checks complete</Text>
            <View style={styles.checkRow}>
              <Text style={[styles.checkItem, data?.siaVerified && styles.checkItemDone]}>
                {data?.siaVerified ? "✓" : "○"} SIA
              </Text>
              <Text style={[styles.checkItem, data?.dbsVerified && styles.checkItemDone]}>
                {data?.dbsVerified ? "✓" : "○"} DBS
              </Text>
              <Text style={[styles.checkItem, data?.rtwVerified && styles.checkItemDone]}>
                {data?.rtwVerified ? "✓" : "○"} Right to work
              </Text>
            </View>
          </View>
          <Text style={styles.factorChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.factorCard}
          onPress={() => router.push("/reviews")}
          activeOpacity={0.7}
        >
          <Text style={styles.factorIcon}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.factorTitle}>Reviews</Text>
            <Text style={styles.factorSub}>
              {data?.reviewCount
                ? `${data.avgRating.toFixed(1)} average from ${data.reviewCount} review${
                    data.reviewCount !== 1 ? "s" : ""
                  }`
                : "No reviews yet — they arrive after completed shifts"}
            </Text>
          </View>
          <Text style={styles.factorChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.factorCard}
          onPress={() => router.push("/stats")}
          activeOpacity={0.7}
        >
          <Text style={styles.factorIcon}>💼</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.factorTitle}>Experience</Text>
            <Text style={styles.factorSub}>
              {data?.totalShifts
                ? `${data.totalShifts} shift${data.totalShifts !== 1 ? "s" : ""} completed`
                : "Complete your first shift to start building experience"}
            </Text>
          </View>
          <Text style={styles.factorChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.factorCard}
          onPress={() => router.push("/training")}
          activeOpacity={0.7}
        >
          <Text style={styles.factorIcon}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.factorTitle}>Training</Text>
            <Text style={styles.factorSub}>
              {data?.trainingCount
                ? `${data.trainingCount} module${data.trainingCount !== 1 ? "s" : ""} passed`
                : "Pass free training modules to lift your score"}
            </Text>
          </View>
          <Text style={styles.factorChevron}>›</Text>
        </TouchableOpacity>

        {/* How to improve */}
        <Text style={styles.sectionHeading}>How to improve</Text>
        <View style={styles.tipsCard}>
          {tips.map((tip, i) => (
            <View
              key={tip.text}
              style={[styles.tipRow, i < tips.length - 1 && styles.tipRowBorder]}
            >
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={[styles.tipText, tip.done && styles.tipTextDone]}>{tip.text}</Text>
              {tip.done && <Text style={styles.tipDone}>✓</Text>}
            </View>
          ))}
        </View>

        <View style={{ height: insets.bottom + spacing.xl }} />
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
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  scoreRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: "800",
  },
  scoreOutOf: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -4,
  },
  scoreLabel: {
    ...typography.title,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  heroText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionHeading: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  factorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  factorIcon: {
    fontSize: 26,
  },
  factorTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  factorSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  factorChevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
  checkRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  checkItem: {
    ...typography.caption,
    color: colors.textMuted,
  },
  checkItemDone: {
    color: "#34d399",
    fontWeight: "600",
  },
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  tipRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  tipTextDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  tipDone: {
    color: "#34d399",
    fontWeight: "700",
  },
});
