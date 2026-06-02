import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { getTrainingCompletions } from "../lib/trainingProgress";
import { GuestGate } from "../components/auth/GuestGate";
import { TROPHY_DEFS } from "../data/trophies";
import { dayKey, splitTrophies, type TrophyStats } from "../lib/trophyEngine";
import { BackButton } from "../components/ui/BackButton";

type VenueSummary = {
  name: string;
  shifts: number;
  hours: number;
};

type Certificate = {
  id: string;
  name: string;
  issuer: string;
  status: string;
  expires?: string | null;
};

type CvData = {
  displayName: string;
  memberSince: string;
  siaNumber: string | null;
  isVerified: boolean;
  shieldScore: number;
  totalShifts: number;
  totalHours: number;
  avgRating: number;
  reviewCount: number;
  topVenues: VenueSummary[];
  trainingBadges: string[];
  earnedTrophies: { id: string; name: string; icon: string }[];
  certificates: Certificate[];
};

function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCvSummary(data: CvData): string {
  const ratingPart = data.avgRating ? `Average rating ${data.avgRating.toFixed(1)} from ${data.reviewCount} reviews` : "Building review history";
  return [
    `${data.displayName} is a ${data.isVerified ? "verified" : "actively verifying"} security professional on Shield.`,
    `Completed ${data.totalShifts} shifts (${data.totalHours} hours) across trusted venues with Shield Score ${data.shieldScore}.`,
    `${ratingPart}.`,
    `Holds ${data.trainingBadges.length} training badge${data.trainingBadges.length === 1 ? "" : "s"} and ${data.earnedTrophies.length} earned trophies.`,
  ].join(" ");
}

function buildCvHtml(data: CvData): string {
  const topVenues = data.topVenues
    .map((v) => `<li><strong>${htmlEscape(v.name)}</strong> - ${v.shifts} shifts, ${Math.round(v.hours)} hours</li>`)
    .join("");
  const badges = data.trainingBadges.map((b) => `<li>${htmlEscape(b)}</li>`).join("");
  const trophies = data.earnedTrophies.map((t) => `<li>${htmlEscape(`${t.icon} ${t.name}`)}</li>`).join("");
  const certs = data.certificates
    .map((c) => {
      const status = c.status === "verified" ? "Verified" : "Pending";
      const expires = c.expires ? ` • Expires ${htmlEscape(formatMonthYear(c.expires))}` : "";
      return `<li><strong>${htmlEscape(c.name)}</strong> (${htmlEscape(c.issuer)}) - ${status}${expires}</li>`;
    })
    .join("");
  const summary = htmlEscape(buildCvSummary(data));

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; padding: 28px; }
        h1 { font-size: 26px; margin: 0 0 8px 0; }
        h2 { font-size: 16px; margin: 20px 0 8px; }
        p { font-size: 12px; line-height: 1.5; margin: 0; }
        .muted { color: #6b7280; font-size: 12px; }
        .meta { background: #f3f4f6; border-radius: 8px; padding: 10px 12px; margin-top: 10px; font-size: 12px; }
        ul { margin: 8px 0 0 18px; padding: 0; }
        li { margin: 4px 0; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>${htmlEscape(data.displayName)} - Digital CV</h1>
      <p class="muted">${data.isVerified ? "Verified profile" : "Verification in progress"} • Member since ${htmlEscape(data.memberSince)}</p>
      <div class="meta">
        SIA: ${htmlEscape(data.siaNumber || "Pending")} • Shield Score: ${data.shieldScore} • Shifts: ${data.totalShifts} • Hours: ${data.totalHours} • Rating: ${data.avgRating ? data.avgRating.toFixed(1) : "N/A"}
      </div>

      <h2>Professional Summary</h2>
      <p>${summary}</p>

      <h2>Work History (Top Venues)</h2>
      <ul>${topVenues || "<li>No completed shifts yet</li>"}</ul>

      <h2>Training Badges</h2>
      <ul>${badges || "<li>No training badges yet</li>"}</ul>

      <h2>Trophies Earned</h2>
      <ul>${trophies || "<li>No trophies yet</li>"}</ul>

      <h2>Certifications & Documents</h2>
      <ul>${certs || "<li>No documents uploaded yet</li>"}</ul>
    </body>
  </html>
  `;
}

export default function DigitalCVScreen() {
  return (
    <GuestGate feature="cv" redirectAfter="/cv">
      <DigitalCVScreenContent />
    </GuestGate>
  );
}

function DigitalCVScreenContent() {
  const [data, setData] = useState<CvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadCv = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setData(null);
        return;
      }

      const profile = await getProfileIdAndRole(supabase, user.id);
      const personnelId = await getPersonnelId(supabase, profile?.profileId || user.id);
      if (!personnelId) {
        setData(null);
        return;
      }

      const [personnelRes, shiftsRes, reviewsRes, completions, docsRes] = await Promise.all([
        supabase
          .from("personnel")
          .select("display_name,sia_license_number,sia_verified,created_at,shield_score")
          .eq("id", personnelId)
          .single(),
        supabase
          .from("shifts")
          .select("scheduled_start,scheduled_end,booking:bookings(venue_name)")
          .eq("personnel_id", personnelId)
          .eq("status", "completed")
          .order("scheduled_start", { ascending: false }),
        supabase.from("reviews").select("overall_rating").eq("reviewee_id", personnelId),
        getTrainingCompletions(supabase, personnelId),
        supabase
          .from("user_documents")
          .select("id,title,document_type,verification_status,expiry_date,created_at")
          .eq("user_id", profile?.profileId || user.id)
          .order("created_at", { ascending: false }),
      ]);

      const personnel = personnelRes.data;
      const shifts = (shiftsRes.data || []) as any[];
      const reviews = (reviewsRes.data || []) as any[];
      const docs = (docsRes.data || []) as any[];

      const byVenue = new Map<string, VenueSummary>();
      const byDay = new Map<string, number>();
      let night = 0;
      let morning = 0;
      let totalHours = 0;

      shifts.forEach((s) => {
        const venue = s?.booking?.venue_name || "Verified Venue";
        const start = new Date(s.scheduled_start);
        const end = s.scheduled_end ? new Date(s.scheduled_end) : null;
        const hours = end ? Math.max(0, (end.getTime() - start.getTime()) / 3600000) : 8;
        const key = dayKey(s.scheduled_start);
        byDay.set(key, (byDay.get(key) || 0) + 1);
        totalHours += hours;
        const hour = start.getHours();
        if (hour >= 21 || hour <= 5) night += 1;
        if (hour >= 5 && hour <= 9) morning += 1;

        const existing = byVenue.get(venue) || { name: venue, shifts: 0, hours: 0 };
        existing.shifts += 1;
        existing.hours += hours;
        byVenue.set(venue, existing);
      });

      const ratings = reviews.map((r) => Number(r.overall_rating || 0)).filter((n) => n > 0);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const maxShiftsSingleDay = Array.from(byDay.values()).reduce((m, n) => Math.max(m, n), 0);
      const stats: TrophyStats = {
        completedShifts: shifts.length,
        shieldScore: Number(personnel?.shield_score || 0),
        trainingCount: completions.length,
        reviewCount: ratings.length,
        avgRating,
        activeDays: byDay.size,
        nightShifts: night,
        morningShifts: morning,
        maxShiftsSingleDay,
      };
      const { earned } = splitTrophies(TROPHY_DEFS, stats);

      setData({
        displayName: personnel?.display_name || user.user_metadata?.display_name || "Shield Personnel",
        memberSince: formatMonthYear(personnel?.created_at),
        siaNumber: personnel?.sia_license_number || null,
        isVerified: Boolean(personnel?.sia_verified),
        shieldScore: stats.shieldScore,
        totalShifts: stats.completedShifts,
        totalHours: Math.round(totalHours),
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount,
        topVenues: Array.from(byVenue.values()).sort((a, b) => b.shifts - a.shifts).slice(0, 8),
        trainingBadges: completions.map((c) => c.badge_name).filter(Boolean).slice(0, 12),
        earnedTrophies: earned.slice(0, 20).map((t) => ({ id: t.id, name: t.name, icon: t.icon })),
        certificates: docs.slice(0, 10).map((d: any) => ({
          id: d.id,
          name: d.title || d.document_type || "Certification",
          issuer: "Shield Documents",
          status: d.verification_status || "pending",
          expires: d.expiry_date || null,
        })),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCv();
  }, [loadCv]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCv();
  }, [loadCv]);

  const shareMessage = useMemo(() => {
    if (!data) return "My Shield Digital CV";
    return [
      `${data.displayName} • Shield Digital CV`,
      `${data.isVerified ? "Verified" : "In review"} profile`,
      `${data.totalShifts} shifts • ${data.totalHours} hours • Shield ${data.shieldScore}`,
      data.avgRating ? `${data.avgRating.toFixed(1)} avg rating` : "Rating history building",
    ].join("\n");
  }, [data]);

  const cvSummary = useMemo(() => (data ? buildCvSummary(data) : ""), [data]);

  const handleShare = async () => {
    await Share.share({ title: "My Shield Digital CV", message: shareMessage });
  };

  const handleExportPdf = async () => {
    if (!data) return;
    setExporting(true);
    try {
      // Lazy-load native modules so the screen still works
      // even when the dev client hasn't been rebuilt yet.
      const Print = await import("expo-print");
      const Sharing = await import("expo-sharing");
      const html = buildCvHtml(data);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Exported", `CV PDF saved at:\n${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Export Shield CV",
        UTI: "com.adobe.pdf",
      });
    } catch (error: any) {
      await Share.share({
        title: "Shield CV Summary",
        message: `${data.displayName}\n\n${buildCvSummary(data)}`,
      });
      Alert.alert(
        "PDF export unavailable",
        "Your app build does not include the native PDF module yet. I shared a text CV summary as fallback. Rebuild the iOS app to enable PDF export."
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#07080f", "#101424", "#07080f"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Digital CV</Text>
          <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
            <Text style={styles.iconText}>📤</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={["rgba(147,197,253,0.24)", "rgba(59,130,246,0.07)"]} style={styles.heroCard}>
            <Text style={styles.profileName}>{data?.displayName || "Loading..."}</Text>
            <Text style={styles.profileMeta}>
              {data?.isVerified ? "✓ Verified profile" : "Verification in progress"} • Member since {data?.memberSince || "-"}
            </Text>
            <Text style={styles.profileMeta}>{data?.siaNumber ? `SIA ${data.siaNumber}` : "SIA licence pending"}</Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{data?.totalShifts || 0}</Text>
                <Text style={styles.statLabel}>Shifts</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{data?.totalHours || 0}</Text>
                <Text style={styles.statLabel}>Hours</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{data?.avgRating ? data.avgRating.toFixed(1) : "-"}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{data?.shieldScore || 0}</Text>
                <Text style={styles.statLabel}>Shield</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryAction} onPress={handleExportPdf} disabled={exporting || !data}>
              {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryActionText}>Export CV as PDF</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={handleShare}>
              <Text style={styles.secondaryActionText}>Share Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Written CV Summary</Text>
            <Text style={styles.summaryText}>{cvSummary || "Loading summary..."}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Work History</Text>
              <Text style={styles.sectionHint}>Top venues by completed shifts</Text>
            </View>
            {(data?.topVenues || []).length === 0 ? (
              <Text style={styles.emptyText}>No completed shifts yet.</Text>
            ) : (
              data?.topVenues.map((venue) => (
                <View key={venue.name} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{venue.name}</Text>
                  <Text style={styles.itemSub}>{venue.shifts} shifts • {Math.round(venue.hours)}h worked</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training Badges</Text>
            <View style={styles.chipsWrap}>
              {(data?.trainingBadges || []).map((badge) => (
                <View key={badge} style={styles.chip}>
                  <Text style={styles.chipText}>🎓 {badge}</Text>
                </View>
              ))}
              {(data?.trainingBadges || []).length === 0 && <Text style={styles.emptyText}>No training badges yet.</Text>}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trophies Earned</Text>
            <View style={styles.chipsWrap}>
              {(data?.earnedTrophies || []).slice(0, 12).map((t) => (
                <View key={t.id} style={styles.chip}>
                  <Text style={styles.chipText}>{t.icon} {t.name}</Text>
                </View>
              ))}
              {(data?.earnedTrophies || []).length === 0 && <Text style={styles.emptyText}>No trophies yet.</Text>}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SIA Certification & Documents</Text>
            {(data?.certificates || []).length === 0 ? (
              <Text style={styles.emptyText}>No uploaded certifications yet.</Text>
            ) : (
              data?.certificates.map((cert) => (
                <View key={cert.id} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{cert.name}</Text>
                  <Text style={styles.itemSub}>
                    {cert.issuer} • {cert.status === "verified" ? "✓ Verified" : "Pending review"}
                    {cert.expires ? ` • Expires ${formatMonthYear(cert.expires)}` : ""}
                  </Text>
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => router.push("/documents")}>
              <Text style={styles.linkText}>Manage documents →</Text>
            </TouchableOpacity>
          </View>

          {loading && <Text style={styles.loadingText}>Syncing your Digital CV...</Text>}
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
    paddingVertical: spacing.xs,
  },
  headerTitle: { ...typography.title, color: colors.text },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 16 },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: 120 },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: "rgba(15,23,42,0.65)",
  },
  profileName: { ...typography.title, color: colors.text, marginBottom: 4 },
  profileMeta: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  statsRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.24)",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: { alignItems: "center", flex: 1 },
  statValue: { ...typography.titleCard, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  primaryAction: {
    flex: 1.5,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: { ...typography.body, color: "#fff", fontWeight: "700" },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: { ...typography.bodySmall, color: colors.text },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionHint: { ...typography.caption, color: colors.textMuted },
  sectionTitle: { ...typography.titleCard, color: colors.text, marginBottom: spacing.sm },
  summaryText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
  itemSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: { ...typography.caption, color: colors.text },
  linkText: { ...typography.caption, color: colors.accent, marginTop: spacing.sm, fontWeight: "600" },
  emptyText: { ...typography.caption, color: colors.textMuted },
  loadingText: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
});
