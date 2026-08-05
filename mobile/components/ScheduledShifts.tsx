/**
 * My Scheduled Shifts — roster shifts the guard's agency has placed them on.
 * Tap a card to open full shift details; decline from there if needed.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { computeShiftPay, paymentStatusLabel, shiftHasRecordedWork, getShiftCompletionDisplay } from "../lib/shiftEarnings";
import { fetchGuardShifts } from "../lib/guardShifts";

type RosterFilter = "upcoming" | "past";

type Assignment = {
  id: string;
  shift_id: string;
  status: string;
  shift_status: string;
  event_name: string | null;
  role: string | null;
  hourly_rate: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  location_text: string | null;
  agency_name: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  total_pay?: number | null;
  hours_worked?: number | null;
  venue_confirmed?: boolean | null;
  self_managed?: boolean | null;
};

type ShiftRow = {
  id: string;
  role: string | null;
  hourly_rate: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  booking_id: string | null;
  agency_id: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  total_pay?: number | null;
  hours_worked?: number | null;
  venue_confirmed?: boolean | null;
};

type BookingRow = {
  id: string;
  event_name: string | null;
  site_label: string | null;
  site_address_text: string | null;
  self_managed: boolean | null;
  agency_id: string | null;
  agencies: { name: string | null } | { name: string | null }[] | null;
};

type AssignmentRow = {
  id: string;
  shift_id: string;
  status: string;
  event_name: string | null;
  role: string | null;
  hourly_rate: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  location_text: string | null;
  agency_name: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function agencyNameFromBooking(booking: BookingRow | undefined): string | null {
  if (!booking?.agencies) return null;
  if (Array.isArray(booking.agencies)) return booking.agencies[0]?.name ?? null;
  return booking.agencies.name ?? null;
}

function isLiveNow(a: Assignment, nowMs = Date.now()): boolean {
  if (a.shift_status !== "checked_in") return false;
  const start = a.scheduled_start ? new Date(a.scheduled_start).getTime() : NaN;
  const end = a.scheduled_end ? new Date(a.scheduled_end).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  return nowMs >= start && nowMs <= end;
}

/** Shift table status is the source of truth for upcoming vs past. */
function bucketForShift(
  shiftStatus: string,
  scheduledEnd: string | null,
  actualStart: string | null | undefined,
  nowMs = Date.now(),
): RosterFilter {
  if (
    shiftHasRecordedWork({ status: shiftStatus, actual_start: actualStart }) ||
    shiftStatus === "no_show"
  ) {
    return "past";
  }
  if (shiftStatus === "cancelled") {
    return "past";
  }
  const endMs = scheduledEnd ? new Date(scheduledEnd).getTime() : NaN;
  if (Number.isFinite(endMs) && endMs < nowMs && shiftStatus !== "checked_in") {
    return "past";
  }
  if (shiftStatus === "pending" || shiftStatus === "accepted" || shiftStatus === "checked_in") {
    return "upcoming";
  }
  return "past";
}

function buildAssignment(
  shift: ShiftRow,
  booking: BookingRow | undefined,
  assignment: AssignmentRow | undefined,
): Assignment {
  const agencyName = assignment?.agency_name ?? agencyNameFromBooking(booking);
  return {
    id: assignment?.id ?? `shift-${shift.id}`,
    shift_id: shift.id,
    status: assignment?.status ?? (shift.status === "pending" ? "pending" : "accepted"),
    shift_status: shift.status,
    event_name: assignment?.event_name ?? booking?.event_name ?? "Scheduled shift",
    role: assignment?.role ?? shift.role ?? null,
    hourly_rate: assignment?.hourly_rate ?? shift.hourly_rate ?? null,
    scheduled_start: shift.scheduled_start ?? assignment?.scheduled_start ?? null,
    scheduled_end: shift.scheduled_end ?? assignment?.scheduled_end ?? null,
    location_text:
      assignment?.location_text ?? booking?.site_label ?? booking?.site_address_text ?? null,
    agency_name: agencyName,
    actual_start: shift.actual_start ?? null,
    actual_end: shift.actual_end ?? null,
    total_pay: shift.total_pay ?? null,
    hours_worked: shift.hours_worked ?? null,
    venue_confirmed: shift.venue_confirmed ?? null,
    self_managed: booking?.self_managed ?? null,
  };
}

function isAgencyRosterShift(
  shift: ShiftRow,
  booking: BookingRow | undefined,
  assignmentByShiftId: Map<string, AssignmentRow>,
): boolean {
  if (assignmentByShiftId.has(shift.id)) return true;
  if (shift.agency_id) return true;
  if (booking?.agency_id) return true;
  if (booking?.self_managed) return true;
  return false;
}

export function ScheduledShifts({
  onCountChange,
  hideWhenEmpty,
}: {
  onCountChange?: (n: number) => void;
  hideWhenEmpty?: boolean;
}) {
  const [upcoming, setUpcoming] = useState<Assignment[]>([]);
  const [past, setPast] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState<RosterFilter>("upcoming");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const profile = await getProfileIdAndRole(supabase, user.id);
      if (!profile) {
        setLoading(false);
        return;
      }
      const pid = await getPersonnelId(supabase, profile.profileId);
      if (!pid) {
        setLoading(false);
        return;
      }

      const pastCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const [assignmentsRes, fetchedShifts] = await Promise.all([
        supabase
          .from("shift_assignments")
          .select(
            "id, shift_id, status, event_name, role, hourly_rate, scheduled_start, scheduled_end, location_text, agency_name",
          )
          .eq("personnel_id", pid)
          .in("status", ["pending", "accepted"])
          .gte("scheduled_start", pastCutoff),
        fetchGuardShifts<ShiftRow>(supabase, pid, {
          select:
            "id, role, hourly_rate, scheduled_start, scheduled_end, status, booking_id, agency_id, actual_start, actual_end, total_pay, hours_worked, venue_confirmed, cancellation_reason, original_personnel_id, personnel_id",
          scheduledStartGte: pastCutoff,
          orderAsc: true,
        }),
      ]);

      let shiftRows = fetchedShifts;

      const assignmentRows = (assignmentsRes.data as AssignmentRow[]) ?? [];
      const assignmentByShiftId = new Map(assignmentRows.map((a) => [a.shift_id, a]));

      // Shifts referenced by assignments but missing from personnel query (edge case).
      const missingShiftIds = assignmentRows
        .map((a) => a.shift_id)
        .filter((id) => !shiftRows.some((s) => s.id === id));
      if (missingShiftIds.length > 0) {
        const { data: extraShifts } = await supabase
          .from("shifts")
          .select(
            "id, role, hourly_rate, scheduled_start, scheduled_end, status, booking_id, agency_id, actual_start, actual_end, total_pay, hours_worked, venue_confirmed, cancellation_reason, original_personnel_id, personnel_id",
          )
          .in("id", missingShiftIds);
        shiftRows.push(...((extraShifts as ShiftRow[]) ?? []));
      }

      const bookingIds = [
        ...new Set(shiftRows.map((s) => s.booking_id).filter(Boolean)),
      ] as string[];

      let bookingsById = new Map<string, BookingRow>();
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select(
            "id, event_name, site_label, site_address_text, self_managed, agency_id, agencies(name)",
          )
          .in("id", bookingIds);
        for (const b of (bookings as BookingRow[]) ?? []) {
          bookingsById.set(b.id, b);
        }
      }

      const nowMs = Date.now();
      const upcomingList: Assignment[] = [];
      const pastList: Assignment[] = [];
      const seen = new Set<string>();

      for (const shift of shiftRows) {
        if (seen.has(shift.id)) continue;
        const booking = shift.booking_id ? bookingsById.get(shift.booking_id) : undefined;
        const isPastWork = shiftHasRecordedWork({
          status: shift.status,
          actual_start: shift.actual_start,
        });
        // Upcoming: agency roster only. Past: any shift this guard worked.
        if (!isPastWork && !isAgencyRosterShift(shift, booking, assignmentByShiftId)) continue;

        seen.add(shift.id);
        const item = buildAssignment(shift, booking, assignmentByShiftId.get(shift.id));
        const bucket = bucketForShift(
          item.shift_status,
          item.scheduled_end,
          item.actual_start,
          nowMs,
        );
        if (bucket === "upcoming") upcomingList.push(item);
        else pastList.push(item);
      }

      upcomingList.sort(
        (a, b) =>
          new Date(a.scheduled_start || 0).getTime() - new Date(b.scheduled_start || 0).getTime(),
      );
      pastList.sort(
        (a, b) =>
          new Date(b.scheduled_start || 0).getTime() - new Date(a.scheduled_start || 0).getTime(),
      );

      setUpcoming(upcomingList);
      setPast(pastList);
      onCountChange?.(upcomingList.length);
    } catch (e) {
      console.warn("[ScheduledShifts] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const visible = filter === "upcoming" ? upcoming : past;

  const openShift = (a: Assignment) => {
    safeHaptic("light");
    router.push({
      pathname: "/shift/[id]",
      params: { id: a.shift_id, from: "roster" },
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (hideWhenEmpty && upcoming.length === 0 && past.length === 0) {
    return null;
  }

  return (
    <View>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === "upcoming" && styles.filterBtnActive]}
          onPress={() => {
            safeHaptic("selection");
            setFilter("upcoming");
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterText, filter === "upcoming" && styles.filterTextActive]}>
            Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === "past" && styles.filterBtnActive]}
          onPress={() => {
            safeHaptic("selection");
            setFilter("past");
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterText, filter === "past" && styles.filterTextActive]}>
            Past{past.length > 0 ? ` (${past.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{filter === "upcoming" ? "🗓️" : "📋"}</Text>
          <Text style={styles.emptyTitle}>
            {filter === "upcoming" ? "No upcoming shifts" : "No past shifts"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filter === "upcoming"
              ? "Agency shifts you're confirmed for will appear here."
              : "Completed roster shifts from the last 60 days will show here."}
          </Text>
        </View>
      ) : (
        visible.map((a) => {
          const isPending = a.status === "pending" && a.shift_status !== "checked_out";
          const live = filter === "upcoming" && isLiveNow(a);
          const isPast = filter === "past";
          const earnings = computeShiftPay({
            hourly_rate: a.hourly_rate,
            scheduled_start: a.scheduled_start,
            scheduled_end: a.scheduled_end,
            actual_start: a.actual_start,
            actual_end: a.actual_end,
            total_pay: a.total_pay,
            hours_worked: a.hours_worked,
            status: a.shift_status,
          });
          const pay =
            earnings.pay > 0 ? earnings.pay.toFixed(0) : null;
          const hours =
            earnings.hours > 0 ? earnings.hours.toFixed(1) : null;
          const payNote =
            isPast && shiftHasRecordedWork({ status: a.shift_status, actual_start: a.actual_start })
              ? paymentStatusLabel({
                  status: a.shift_status,
                  venue_confirmed: a.venue_confirmed,
                  actual_start: a.actual_start,
                  self_managed: a.self_managed,
                })
              : "";
          const completion = isPast
            ? getShiftCompletionDisplay({
                status: a.shift_status,
                actual_start: a.actual_start,
                actual_end: a.actual_end,
                scheduled_start: a.scheduled_start,
                scheduled_end: a.scheduled_end,
                hourly_rate: a.hourly_rate,
                total_pay: a.total_pay,
                hours_worked: a.hours_worked,
              })
            : null;

          return (
            <TouchableOpacity
              key={a.id}
              style={[styles.card, isPast && styles.cardPast]}
              onPress={() => openShift(a)}
              activeOpacity={0.88}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {a.event_name || "Scheduled shift"}
                  </Text>
                  {a.agency_name ? (
                    <Text style={styles.cardAgency} numberOfLines={1}>
                      {a.agency_name}
                    </Text>
                  ) : null}
                </View>
                {pay ? (
                  <View style={styles.payCol}>
                    <Text style={[styles.payAmount, isPast && styles.payAmountPast]}>£{pay}</Text>
                    {hours ? (
                      <Text style={styles.payRate}>
                        {hours}h{earnings.usedActual ? " worked" : ""}
                      </Text>
                    ) : null}
                    {payNote ? (
                      <Text style={styles.payStatus} numberOfLines={2}>
                        {payNote}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  📅 {formatDate(a.scheduled_start)} · {formatTime(a.scheduled_start)} –{" "}
                  {formatTime(a.scheduled_end)}
                </Text>
              </View>
              {(a.role || a.location_text) && (
                <Text style={styles.metaSub} numberOfLines={2}>
                  {[a.role, a.location_text ? `📍 ${a.location_text}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}

              <View style={styles.cardFooter}>
                <View
                  style={[
                    styles.statusPill,
                    live
                      ? styles.statusLive
                      : isPast
                        ? styles.statusPast
                        : isPending
                          ? styles.statusPending
                          : styles.statusConfirmed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      live
                        ? styles.statusLiveText
                        : isPast
                          ? styles.statusPastText
                          : isPending
                            ? styles.statusPendingText
                            : styles.statusConfirmedText,
                    ]}
                  >
                    {isPast && completion
                      ? completion.label
                      : live
                        ? "Live now"
                        : isPending
                          ? "Response needed"
                          : "Confirmed"}
                  </Text>
                </View>
                <Text style={styles.viewDetails}>View details →</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(0,212,170,0.45)",
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
  filterTextActive: {
    color: colors.accentLight,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.28)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPast: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
  },
  cardAgency: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  payCol: {
    alignItems: "flex-end",
  },
  payAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#34D399",
  },
  payAmountPast: {
    color: colors.textMuted,
  },
  payRate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  payStatus: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 10,
    marginTop: 2,
    maxWidth: 92,
    textAlign: "right",
  },
  metaRow: {
    marginBottom: 4,
  },
  metaText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  metaSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusConfirmed: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
  },
  statusLive: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
  },
  statusPending: {
    backgroundColor: "rgba(96, 165, 250, 0.15)",
  },
  statusPast: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusConfirmedText: {
    color: "#34D399",
  },
  statusLiveText: {
    color: "#FBBF24",
  },
  statusPendingText: {
    color: "#60A5FA",
  },
  statusPastText: {
    color: colors.textMuted,
  },
  viewDetails: {
    ...typography.caption,
    color: colors.accentLight,
    fontWeight: "600",
  },
});
