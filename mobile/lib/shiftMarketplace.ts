/** Client-side mirror of src/lib/shifts/marketplace.ts */

export const MIN_REMAINING_MINUTES_TO_CLAIM_URGENT = 15;

export type MarketplaceShift = {
  status: string;
  personnel_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  is_urgent?: boolean | null;
  dispatcher_status?: string | null;
  cover_search_wave?: number | null;
};

export function remainingMinutes(
  scheduledEnd: string,
  nowMs: number = Date.now(),
): number {
  return Math.round((new Date(scheduledEnd).getTime() - nowMs) / 60_000);
}

export function hasShiftStarted(
  scheduledStart: string,
  nowMs: number = Date.now(),
): boolean {
  return nowMs >= new Date(scheduledStart).getTime();
}

export function isActiveUrgentCover(
  shift: MarketplaceShift,
  nowMs: number = Date.now(),
): boolean {
  if (shift.personnel_id) return false;
  if (shift.status !== "pending") return false;
  if (!shift.is_urgent) return false;
  if (shift.dispatcher_status !== "searching") return false;
  if ((shift.cover_search_wave ?? 0) < 1) return false;
  return (
    remainingMinutes(shift.scheduled_end, nowMs) >=
    MIN_REMAINING_MINUTES_TO_CLAIM_URGENT
  );
}

export function isClaimableOnMarketplace(
  shift: MarketplaceShift,
  opts?: {
    bookingStatus?: string | null;
    selfManaged?: boolean;
    nowMs?: number;
  },
): boolean {
  const nowMs = opts?.nowMs ?? Date.now();

  if (shift.personnel_id) return false;
  if (shift.status === "cancelled" || shift.status === "checked_out") {
    return false;
  }
  if (opts?.bookingStatus === "cancelled") return false;
  if (opts?.selfManaged) return false;
  if (remainingMinutes(shift.scheduled_end, nowMs) <= 0) return false;

  if (isActiveUrgentCover(shift, nowMs)) return true;

  if (shift.status !== "pending") return false;
  if (hasShiftStarted(shift.scheduled_start, nowMs)) return false;

  return true;
}
