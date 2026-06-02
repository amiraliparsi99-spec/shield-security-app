import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import { colors, typography, spacing, radius } from "../theme";
import { BackButton } from "../components/ui/BackButton";
import { TROPHY_DEFS, type TrophyDef } from "../data/trophies";
import { getMyPersonnelId, getTrainingCompletions } from "../lib/trainingProgress";
import { GuestGate } from "../components/auth/GuestGate";

type Stats = {
  completedShifts: number;
  shieldScore: number;
  trainingCount: number;
  reviewCount: number;
  avgRating: number;
  activeDays: number;
  nightShifts: number;
  morningShifts: number;
  maxShiftsSingleDay: number;
};

type TrophyProgress = {
  label: string;
  current: number;
  target: number;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function earnedByRule(id: string, s: Stats): boolean {
  const trophyPower =
    s.completedShifts +
    s.trainingCount * 3 +
    s.reviewCount +
    Math.floor(s.shieldScore / 5) +
    s.activeDays * 2 +
    Math.floor(s.avgRating * 4) +
    s.nightShifts +
    s.morningShifts +
    s.maxShiftsSingleDay * 4;

  switch (id) {
    case "shift_1": return s.completedShifts >= 1;
    case "shift_5": return s.completedShifts >= 5;
    case "shift_25": return s.completedShifts >= 25;
    case "shift_50": return s.completedShifts >= 50;
    case "shift_100": return s.completedShifts >= 100;
    case "training_1": return s.trainingCount >= 1;
    case "training_5": return s.trainingCount >= 5;
    case "training_10": return s.trainingCount >= 10;
    case "review_5": return s.reviewCount >= 5;
    case "review_20": return s.reviewCount >= 20;
    case "rating_45": return s.reviewCount >= 5 && s.avgRating >= 4.5;
    case "rating_48": return s.reviewCount >= 10 && s.avgRating >= 4.8;
    case "score_70": return s.shieldScore >= 70;
    case "score_85": return s.shieldScore >= 85;
    case "score_95": return s.shieldScore >= 95;
    case "hulk_mode": return s.maxShiftsSingleDay >= 3;
    case "night_owl": return s.nightShifts >= 10;
    case "early_bird": return s.morningShifts >= 10;
    case "streak_7": return s.activeDays >= 7;
    case "streak_30": return s.activeDays >= 30;
    case "nick_fury": return s.completedShifts >= 75 && s.trainingCount >= 10 && s.shieldScore >= 85;
    case "door_jedi": return s.completedShifts >= 40 && s.reviewCount >= 10 && s.avgRating >= 4.8;
    case "captain_queue": return s.completedShifts >= 30;
    case "bat_signal": return s.nightShifts >= 20;
    case "neon_defender": return s.nightShifts >= 25 && s.shieldScore >= 80;
    case "shadow_responder": return s.completedShifts >= 60 && s.nightShifts >= 20;
    case "titan_guardian": return s.completedShifts >= 150 && s.shieldScore >= 90;
    case "hulk_smash": return s.maxShiftsSingleDay >= 5;
    case "marvel_mode": return s.trainingCount >= 10 && s.completedShifts >= 100;
    case "radio_active": return s.activeDays >= 25;
    case "steady_hand": return s.reviewCount >= 20 && s.avgRating >= 4.5;
    case "people_magnet": return s.reviewCount >= 40;
    case "passport_legend": return s.trainingCount >= 10 && s.shieldScore >= 80;
    case "zero_to_hero": return s.completedShifts >= 50 && s.trainingCount >= 5;
    case "comms_king": return s.reviewCount >= 30 && s.avgRating >= 4.8;
    case "early_riser_pro": return s.morningShifts >= 25;
    case "night_commander": return s.nightShifts >= 40;
    case "safest_hands": return s.shieldScore >= 95 && s.reviewCount >= 20 && s.avgRating >= 4.8;
    case "year_best": return s.completedShifts >= 200;
    case "legendary_guard": return s.completedShifts >= 250 && s.shieldScore >= 95;
    default:
      if (id.startsWith("legend_")) {
        const n = Number(id.replace("legend_", ""));
        if (!Number.isFinite(n)) return false;
        return trophyPower >= n;
      }
      return false;
  }
}

function getTrophyProgress(id: string, s: Stats): TrophyProgress | null {
  switch (id) {
    case "shift_1": return { label: "Shifts", current: s.completedShifts, target: 1 };
    case "shift_5": return { label: "Shifts", current: s.completedShifts, target: 5 };
    case "shift_25": return { label: "Shifts", current: s.completedShifts, target: 25 };
    case "shift_50": return { label: "Shifts", current: s.completedShifts, target: 50 };
    case "shift_100": return { label: "Shifts", current: s.completedShifts, target: 100 };
    case "training_1": return { label: "Training", current: s.trainingCount, target: 1 };
    case "training_5": return { label: "Training", current: s.trainingCount, target: 5 };
    case "training_10": return { label: "Training", current: s.trainingCount, target: 10 };
    case "review_5": return { label: "Reviews", current: s.reviewCount, target: 5 };
    case "review_20": return { label: "Reviews", current: s.reviewCount, target: 20 };
    case "rating_45": return { label: "Rating", current: Math.round(s.avgRating * 10), target: 45 };
    case "rating_48": return { label: "Rating", current: Math.round(s.avgRating * 10), target: 48 };
    case "score_70": return { label: "Shield", current: s.shieldScore, target: 70 };
    case "score_85": return { label: "Shield", current: s.shieldScore, target: 85 };
    case "score_95": return { label: "Shield", current: s.shieldScore, target: 95 };
    case "hulk_mode": return { label: "Best day", current: s.maxShiftsSingleDay, target: 3 };
    case "night_owl": return { label: "Night shifts", current: s.nightShifts, target: 10 };
    case "early_bird": return { label: "Morning shifts", current: s.morningShifts, target: 10 };
    case "streak_7": return { label: "Active days", current: s.activeDays, target: 7 };
    case "streak_30": return { label: "Active days", current: s.activeDays, target: 30 };
    case "nick_fury": return { label: "Shifts", current: s.completedShifts, target: 75 };
    case "door_jedi": return { label: "Shifts", current: s.completedShifts, target: 40 };
    case "captain_queue": return { label: "Shifts", current: s.completedShifts, target: 30 };
    case "bat_signal": return { label: "Night shifts", current: s.nightShifts, target: 20 };
    case "neon_defender": return { label: "Night shifts", current: s.nightShifts, target: 25 };
    case "shadow_responder": return { label: "Shifts", current: s.completedShifts, target: 60 };
    case "titan_guardian": return { label: "Shifts", current: s.completedShifts, target: 150 };
    case "hulk_smash": return { label: "Best day", current: s.maxShiftsSingleDay, target: 5 };
    case "marvel_mode": return { label: "Shifts", current: s.completedShifts, target: 100 };
    case "radio_active": return { label: "Active days", current: s.activeDays, target: 25 };
    case "steady_hand": return { label: "Reviews", current: s.reviewCount, target: 20 };
    case "people_magnet": return { label: "Reviews", current: s.reviewCount, target: 40 };
    case "passport_legend": return { label: "Training", current: s.trainingCount, target: 10 };
    case "zero_to_hero": return { label: "Shifts", current: s.completedShifts, target: 50 };
    case "comms_king": return { label: "Reviews", current: s.reviewCount, target: 30 };
    case "early_riser_pro": return { label: "Morning shifts", current: s.morningShifts, target: 25 };
    case "night_commander": return { label: "Night shifts", current: s.nightShifts, target: 40 };
    case "safest_hands": return { label: "Shield", current: s.shieldScore, target: 95 };
    case "year_best": return { label: "Shifts", current: s.completedShifts, target: 200 };
    case "legendary_guard": return { label: "Shifts", current: s.completedShifts, target: 250 };
    default:
      if (id.startsWith("legend_")) {
        const n = Number(id.replace("legend_", ""));
        const trophyPower =
          s.completedShifts +
          s.trainingCount * 3 +
          s.reviewCount +
          Math.floor(s.shieldScore / 5) +
          s.activeDays * 2 +
          Math.floor(s.avgRating * 4) +
          s.nightShifts +
          s.morningShifts +
          s.maxShiftsSingleDay * 4;
        return { label: "Power", current: trophyPower, target: Number.isFinite(n) ? n : 999 };
      }
      return null;
  }
}

export default function TrophiesScreen() {
  return (
    <GuestGate feature="trophies" redirectAfter="/trophies">
      <TrophiesScreenContent />
    </GuestGate>
  );
}

function TrophiesScreenContent() {
  const [stats, setStats] = useState<Stats>({
    completedShifts: 0,
    shieldScore: 0,
    trainingCount: 0,
    reviewCount: 0,
    avgRating: 0,
    activeDays: 0,
    nightShifts: 0,
    morningShifts: 0,
    maxShiftsSingleDay: 0,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const pid = await getMyPersonnelId(supabase);
      if (!pid) return;

      const [{ data: p }, { data: shifts }, { data: reviews }, training] = await Promise.all([
        supabase.from("personnel").select("shield_score").eq("id", pid).single(),
        supabase
          .from("shifts")
          .select("scheduled_start,scheduled_end,status")
          .eq("personnel_id", pid)
          .eq("status", "completed"),
        supabase.from("reviews").select("overall_rating").eq("reviewee_id", pid),
        getTrainingCompletions(supabase, pid),
      ]);

      const shiftRows = shifts || [];
      const byDay = new Map<string, number>();
      let night = 0;
      let morning = 0;
      shiftRows.forEach((s: any) => {
        const key = dayKey(s.scheduled_start);
        byDay.set(key, (byDay.get(key) || 0) + 1);
        const h = new Date(s.scheduled_start).getHours();
        if (h >= 21 || h <= 5) night += 1;
        if (h >= 5 && h <= 9) morning += 1;
      });
      const maxSingleDay = Array.from(byDay.values()).reduce((m, n) => Math.max(m, n), 0);
      const ratings = (reviews || []).map((r: any) => Number(r.overall_rating || 0));
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      if (!mounted) return;
      setStats({
        completedShifts: shiftRows.length,
        shieldScore: Number(p?.shield_score || 0),
        trainingCount: training.length,
        reviewCount: ratings.length,
        avgRating: avg,
        activeDays: byDay.size,
        nightShifts: night,
        morningShifts: morning,
        maxShiftsSingleDay: maxSingleDay,
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { earned, locked } = useMemo(() => {
    const e: TrophyDef[] = [];
    const l: TrophyDef[] = [];
    TROPHY_DEFS.forEach((t) => (earnedByRule(t.id, stats) ? e : l).push(t));
    return { earned: e, locked: l };
  }, [stats]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0a0f", "#111118", "#0a0a0f"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Trophies</Text>
          <View style={{ width: 64 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Your Trophy Cabinet</Text>
            <Text style={styles.summaryValue}>{earned.length} earned / {TROPHY_DEFS.length} total</Text>
          </View>

          <Text style={styles.sectionTitle}>Earned</Text>
          <View style={styles.grid}>
            {earned.slice(0, 30).map((t) => (
              <View key={t.id} style={styles.cardEarned}>
                <Text style={styles.icon}>{t.icon}</Text>
                <Text style={styles.name} numberOfLines={2}>{t.name}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Locked</Text>
          <View style={styles.grid}>
            {locked.slice(0, 90).map((t) => (
              <View key={t.id} style={styles.cardLocked}>
                <Text style={styles.icon}>🔒</Text>
                <Text style={styles.nameLocked} numberOfLines={2}>{t.name}</Text>
                <Text style={styles.req} numberOfLines={2}>{t.requirement}</Text>
                {(() => {
                  const p = getTrophyProgress(t.id, stats);
                  if (!p) return null;
                  const value = Math.min(100, (p.current / Math.max(1, p.target)) * 100);
                  return (
                    <View style={styles.progressWrap}>
                      <Text style={styles.progressText}>
                        {p.label}: {Math.min(p.current, p.target)}/{p.target}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${value}%` }]} />
                      </View>
                    </View>
                  );
                })()}
              </View>
            ))}
          </View>
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
  summaryCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryTitle: { ...typography.bodySmall, color: colors.textMuted },
  summaryValue: { ...typography.title, color: colors.text, marginTop: 4 },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  cardEarned: {
    width: "31%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(45,212,191,0.35)",
    backgroundColor: "rgba(45,212,191,0.1)",
    padding: spacing.sm,
    minHeight: 92,
  },
  cardLocked: {
    width: "31%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    minHeight: 112,
    opacity: 0.85,
  },
  icon: { fontSize: 20, marginBottom: 6 },
  name: { ...typography.caption, color: colors.text, fontWeight: "600" },
  nameLocked: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  req: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 4 },
  progressWrap: { marginTop: 6 },
  progressText: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginBottom: 4 },
  progressTrack: {
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
});
