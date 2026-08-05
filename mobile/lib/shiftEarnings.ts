/** Client mirror of src/lib/shifts/shiftPay.ts */

export type ShiftPayInput = {
  hourly_rate?: number | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  total_pay?: number | null;
  hours_worked?: number | null;
  status?: string;
};

export function shiftHasRecordedWork(shift: ShiftPayInput): boolean {
  return Boolean(shift.actual_start) || shift.status === "checked_out";
}

export function computeShiftPay(shift: ShiftPayInput): {
  hours: number;
  pay: number;
  usedActual: boolean;
} {
  if (shift.total_pay != null && Number.isFinite(shift.total_pay)) {
    const hours =
      shift.hours_worked != null && Number.isFinite(shift.hours_worked)
        ? shift.hours_worked
        : estimateHours(shift);
    return { hours, pay: shift.total_pay, usedActual: true };
  }

  const startIso = shift.actual_start ?? shift.scheduled_start;
  const endIso = shift.actual_end ?? shift.scheduled_end;
  if (!startIso || !endIso) {
    return { hours: 0, pay: 0, usedActual: false };
  }

  const hours = Math.max(
    0,
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000,
  );
  const pay = hours * Number(shift.hourly_rate ?? 0);
  return {
    hours: Math.round(hours * 100) / 100,
    pay: Math.round(pay * 100) / 100,
    usedActual: Boolean(shift.actual_start && shift.actual_end),
  };
}

function estimateHours(shift: ShiftPayInput): number {
  const startIso = shift.actual_start ?? shift.scheduled_start;
  const endIso = shift.actual_end ?? shift.scheduled_end;
  if (!startIso || !endIso) return 0;
  return (
    Math.round(
      Math.max(
        0,
        (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000,
      ) * 100,
    ) / 100
  );
}

export function paymentStatusLabel(opts: {
  status?: string;
  venue_confirmed?: boolean | null;
  actual_start?: string | null;
  /** Agency roster shift — settled through agency payroll, not platform escrow. */
  self_managed?: boolean | null;
}): string {
  if (!shiftHasRecordedWork(opts)) return "";
  if (opts.self_managed) return "Payable via agency payroll";
  if (opts.venue_confirmed) return "Payment processing";
  return "Pay pending confirmation";
}

/** @deprecated use paymentStatusLabel */
export const payStatusLabel = paymentStatusLabel;

export function shiftCountsAsWorked(shift: ShiftPayInput): boolean {
  return shiftHasRecordedWork(shift);
}

const EARLY_END_BUFFER_MS = 2 * 60 * 1000;

export function minutesBeforeScheduledEnd(
  actualEnd: string,
  scheduledEnd: string,
): number | null {
  const endMs = new Date(actualEnd).getTime();
  const schedMs = new Date(scheduledEnd).getTime();
  if (!Number.isFinite(endMs) || !Number.isFinite(schedMs)) return null;
  return Math.round((schedMs - endMs) / 60_000);
}

export function isEarlyEnd(
  shift: ShiftPayInput,
  bufferMs: number = EARLY_END_BUFFER_MS,
): boolean {
  if (!shift.actual_end || !shift.scheduled_end) return false;
  return (
    new Date(shift.actual_end).getTime() <
    new Date(shift.scheduled_end).getTime() - bufferMs
  );
}

export type ShiftCompletionKind =
  | "completed"
  | "checked_out_early"
  | "ended_early"
  | "cancelled_after_work"
  | "scheduled"
  | "in_progress"
  | "cancelled"
  | "no_show";

export function getShiftCompletionKind(
  shift: ShiftPayInput & { cancellation_reason?: string | null },
): ShiftCompletionKind {
  if (shift.status === "no_show") return "no_show";
  if (shiftHasRecordedWork(shift)) {
    if (shift.status === "cancelled") return "cancelled_after_work";
    if (isEarlyEnd(shift)) return "checked_out_early";
    if (shift.cancellation_reason && shift.status === "checked_out") {
      return "ended_early";
    }
    if (shift.status === "checked_out") return "completed";
    if (shift.status === "checked_in") return "in_progress";
    return "checked_out_early";
  }
  if (shift.status === "cancelled") return "cancelled";
  if (shift.status === "checked_in") return "in_progress";
  return "scheduled";
}

export function getShiftCompletionDisplay(
  shift: ShiftPayInput & { cancellation_reason?: string | null },
): { label: string; detail: string | null } {
  const kind = getShiftCompletionKind(shift);
  const { hours, pay } = computeShiftPay(shift);
  const payLine =
    pay > 0 ? `${hours.toFixed(1)}h · £${pay.toFixed(2)} earned` : null;
  const earlyMins =
    shift.actual_end && shift.scheduled_end
      ? minutesBeforeScheduledEnd(shift.actual_end, shift.scheduled_end)
      : null;

  switch (kind) {
    case "completed":
      return { label: "Completed", detail: payLine };
    case "checked_out_early":
      return {
        label: "Checked out early",
        detail:
          earlyMins != null && earlyMins > 0
            ? `${payLine ?? ""}${payLine ? " · " : ""}${earlyMins}m before scheduled end`.trim()
            : payLine,
      };
    case "ended_early":
    case "cancelled_after_work":
      return {
        label: "Ended early",
        detail: payLine ?? shift.cancellation_reason ?? null,
      };
    case "in_progress":
      return { label: "On shift", detail: payLine };
    case "cancelled":
      return { label: "Cancelled", detail: "No work recorded" };
    case "no_show":
      return { label: "No show", detail: null };
    default:
      return { label: "Scheduled", detail: null };
  }
}
