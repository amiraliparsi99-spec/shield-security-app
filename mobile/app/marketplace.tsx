import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { SlideInView } from "../components/ui/AnimatedComponents";

interface ShiftPost {
  id: string;
  title: string;
  shift_type: string;
  location_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  positions_available: number;
  positions_filled: number;
  urgency: string;
  sia_required: boolean;
  venue?: { name: string; city: string };
  agency?: { name: string; city: string };
  my_application?: { id: string; status: string } | null;
}

const SHIFT_TYPES: Record<string, { label: string; icon: string }> = {
  door_supervisor: { label: "Door Supervisor", icon: "🚪" },
  cctv_operator: { label: "CCTV Operator", icon: "📹" },
  close_protection: { label: "Close Protection", icon: "🛡️" },
  event_security: { label: "Event Security", icon: "🎪" },
  retail_security: { label: "Retail Security", icon: "🛒" },
  corporate_security: { label: "Corporate Security", icon: "🏢" },
  mobile_patrol: { label: "Mobile Patrol", icon: "🚗" },
  static_guard: { label: "Static Guard", icon: "🧍" },
  concierge: { label: "Concierge", icon: "🎩" },
  other: { label: "Other", icon: "📋" },
};

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const [shifts, setShifts] = useState<ShiftPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "urgent" | "applied">("all");

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    const { profileId } = await getProfileIdAndRole(supabase);
    if (profileId) {
      const pId = await getPersonnelId(supabase, profileId);
      setPersonnelId(pId);
      await loadShifts(pId);
    }
    setLoading(false);
  };

  const loadShifts = async (pId: string | null) => {
    const { data } = await supabase
      .from("shift_posts")
      .select(`
        *,
        venue:venues(name, city),
        agency:agencies(name, city)
      `)
      .eq("status", "open")
      .gte("shift_date", new Date().toISOString().split("T")[0])
      .order("urgency", { ascending: true })
      .order("shift_date", { ascending: true });

    if (data && pId) {
      const { data: applications } = await supabase
        .from("shift_applications")
        .select("id, status, shift_id")
        .eq("personnel_id", pId);

      const shiftsWithApps = data.map((shift) => ({
        ...shift,
        my_application: applications?.find((a) => a.shift_id === shift.id) || null,
      }));
      setShifts(shiftsWithApps);
    } else if (data) {
      setShifts(data);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShifts(personnelId);
    setRefreshing(false);
  };

  const handleWithdraw = async (applicationId: string) => {
    Alert.alert("Withdraw Application", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          await supabase
            .from("shift_applications")
            .update({ status: "withdrawn" })
            .eq("id", applicationId);
          await loadShifts(personnelId);
        },
      },
    ]);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredShifts = shifts.filter((shift) => {
    if (filter === "urgent") return shift.urgency !== "normal";
    if (filter === "applied") return shift.my_application;
    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shift Marketplace</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(["all", "urgent", "applied"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => {
              safeHaptic("selection");
              setFilter(f);
            }}
          >
            <Text
              style={[styles.filterText, filter === f && styles.filterTextActive]}
            >
              {f === "all" ? "All" : f === "urgent" ? "🔥 Urgent" : "Applied"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.resultsText}>
          {filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""}{" "}
          available
        </Text>

        {filteredShifts.map((shift, index) => {
          const typeInfo = SHIFT_TYPES[shift.shift_type] || SHIFT_TYPES.other;
          const positionsLeft = shift.positions_available - shift.positions_filled;

          return (
            <SlideInView key={shift.id} delay={index * 50}>
              <View
                style={[
                  styles.shiftCard,
                  shift.urgency === "emergency" && styles.shiftCardEmergency,
                  shift.urgency === "urgent" && styles.shiftCardUrgent,
                ]}
              >
                {/* Header */}
                <View style={styles.shiftHeader}>
                  <Text style={styles.shiftIcon}>{typeInfo.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shiftTitle}>{shift.title}</Text>
                    <Text style={styles.shiftVenue}>
                      {shift.venue?.name || shift.agency?.name} •{" "}
                      {shift.venue?.city || shift.agency?.city}
                    </Text>
                  </View>
                </View>

                {/* Badges */}
                <View style={styles.badges}>
                  {shift.urgency !== "normal" && (
                    <View
                      style={[
                        styles.badge,
                        shift.urgency === "emergency"
                          ? styles.badgeEmergency
                          : styles.badgeUrgent,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {shift.urgency === "emergency" ? "🚨 Emergency" : "⚡ Urgent"}
                      </Text>
                    </View>
                  )}
                  {shift.sia_required && (
                    <View style={[styles.badge, styles.badgeSIA]}>
                      <Text style={styles.badgeText}>SIA Required</Text>
                    </View>
                  )}
                </View>

                {/* Details */}
                <View style={styles.details}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(shift.shift_date)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Rate</Text>
                    <Text style={[styles.detailValue, { color: colors.accent }]}>
                      £{shift.hourly_rate.toFixed(2)}/hr
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Spots</Text>
                    <Text style={styles.detailValue}>
                      {positionsLeft}/{shift.positions_available}
                    </Text>
                  </View>
                </View>

                {/* Action */}
                <View style={styles.actionRow}>
                  {shift.my_application ? (
                    <View style={styles.appliedContainer}>
                      <View
                        style={[
                          styles.statusBadge,
                          shift.my_application.status === "accepted" &&
                            styles.statusAccepted,
                          shift.my_application.status === "pending" &&
                            styles.statusPending,
                          shift.my_application.status === "rejected" &&
                            styles.statusRejected,
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {shift.my_application.status === "accepted"
                            ? "✓ Booked"
                            : shift.my_application.status === "pending"
                            ? "Applied"
                            : shift.my_application.status}
                        </Text>
                      </View>
                      {shift.my_application.status === "pending" && (
                        <TouchableOpacity
                          onPress={() =>
                            handleWithdraw(shift.my_application!.id)
                          }
                        >
                          <Text style={styles.withdrawText}>Withdraw</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : positionsLeft > 0 ? (
                    <TouchableOpacity
                      style={styles.applyBtn}
                      onPress={() => {
                        safeHaptic("light");
                        router.push(`/accept-shift/${shift.id}`);
                      }}
                    >
                      <Text style={styles.applyBtnText}>Accept Shift →</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.filledBadge}>
                      <Text style={styles.filledText}>Filled</Text>
                    </View>
                  )}
                </View>
              </View>
            </SlideInView>
          );
        })}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  filters: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.text,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  resultsText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  shiftCardEmergency: {
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  shiftCardUrgent: {
    borderColor: "rgba(249, 115, 22, 0.5)",
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  shiftIcon: {
    fontSize: 28,
  },
  shiftTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  shiftVenue: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  badgeEmergency: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  badgeUrgent: {
    backgroundColor: "rgba(249, 115, 22, 0.2)",
  },
  badgeSIA: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  badgeText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 11,
  },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailItem: {
    minWidth: "40%",
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  applyBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  applyBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  appliedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  statusAccepted: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  statusPending: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
  },
  statusRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  statusText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "500",
  },
  withdrawText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  filledBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  filledText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  rateInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currency: {
    ...typography.body,
    color: colors.textMuted,
    paddingLeft: spacing.md,
  },
  perHour: {
    ...typography.body,
    color: colors.textMuted,
    paddingRight: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  textArea: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.text,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  submitBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
