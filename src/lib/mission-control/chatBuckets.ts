import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type TypedSupabaseClient = SupabaseClient<any>;

export type MissionBucket = "live" | "passed";
export type PassedSubFilter = "all" | "cancelled" | "completed";
export type PassedKind = "cancelled" | "completed";

export type ShiftMissionSummary = {
  id: string;
  booking_id: string;
  status: string;
  personnel_id: string | null;
};

const ACTIVE_SHIFT = new Set(["pending", "accepted", "checked_in"]);
const TERMINAL_SHIFT = new Set(["cancelled", "declined", "checked_out", "no_show"]);

export async function fetchShiftSummariesForBookings(
  supabase: TypedSupabaseClient,
  bookingIds: string[]
): Promise<Record<string, ShiftMissionSummary[]>> {
  if (bookingIds.length === 0) return {};
  const { data, error } = await supabase
    .from("shifts")
    .select("id, booking_id, status, personnel_id")
    .in("booking_id", bookingIds);
  if (error || !data) {
    console.error("[mission-control] fetch shifts for bookings:", error?.message);
    return {};
  }
  const byBooking: Record<string, ShiftMissionSummary[]> = {};
  for (const row of data as ShiftMissionSummary[]) {
    const bid = row.booking_id;
    if (!byBooking[bid]) byBooking[bid] = [];
    byBooking[bid].push(row);
  }
  return byBooking;
}

export async function fetchBookingStatusesForIds(
  supabase: TypedSupabaseClient,
  bookingIds: string[]
): Promise<Record<string, { status: string }>> {
  if (bookingIds.length === 0) return {};
  const { data, error } = await supabase
    .from("bookings")
    .select("id, status")
    .in("id", bookingIds);
  if (error || !data) {
    console.error("[mission-control] fetch booking statuses:", error?.message);
    return {};
  }
  const out: Record<string, { status: string }> = {};
  for (const row of data as { id: string; status: string }[]) {
    out[row.id] = { status: row.status };
  }
  return out;
}

export function venueMissionMeta(
  bookingId: string | null | undefined,
  bookingStatus: string | null | undefined,
  shifts: ShiftMissionSummary[] | undefined
): { bucket: MissionBucket; passedKind: PassedKind } {
  if (!bookingId) return { bucket: "live", passedKind: "completed" };
  if (bookingStatus === "cancelled") {
    return { bucket: "passed", passedKind: "cancelled" };
  }
  const list = shifts ?? [];
  if (list.length === 0) {
    return { bucket: "live", passedKind: "completed" };
  }
  const anyActive = list.some((s) => ACTIVE_SHIFT.has(s.status));
  if (anyActive) {
    return { bucket: "live", passedKind: "completed" };
  }
  const anyCancelled = list.some((s) => s.status === "cancelled");
  if (anyCancelled) {
    return { bucket: "passed", passedKind: "cancelled" };
  }
  const allTerminal = list.every((s) => TERMINAL_SHIFT.has(s.status));
  if (allTerminal) {
    return { bucket: "passed", passedKind: "completed" };
  }
  return { bucket: "live", passedKind: "completed" };
}

export function personnelMissionMeta(
  personnelId: string | null | undefined,
  bookingId: string | null | undefined,
  bookingStatus: string | null | undefined,
  shifts: ShiftMissionSummary[] | undefined
): { bucket: MissionBucket; passedKind: PassedKind } {
  if (!bookingId || !personnelId) {
    return { bucket: "passed", passedKind: "completed" };
  }
  if (bookingStatus === "cancelled") {
    return { bucket: "passed", passedKind: "cancelled" };
  }
  const list = shifts ?? [];
  const mine = list.filter((s) => s.personnel_id === personnelId);
  const hasLiveMine = mine.some((s) =>
    ["accepted", "checked_in", "pending"].includes(s.status)
  );
  if (hasLiveMine) {
    return { bucket: "live", passedKind: "completed" };
  }
  const anyCancelledOnBooking =
    list.some((s) => s.status === "cancelled") || bookingStatus === "cancelled";
  if (anyCancelledOnBooking) {
    return { bucket: "passed", passedKind: "cancelled" };
  }
  return { bucket: "passed", passedKind: "completed" };
}

export function matchesPassedSubFilter(
  bucket: MissionBucket,
  passedKind: PassedKind,
  sub: PassedSubFilter
): boolean {
  if (bucket !== "passed") return false;
  if (sub === "all") return true;
  if (sub === "cancelled") return passedKind === "cancelled";
  return passedKind === "completed";
}
