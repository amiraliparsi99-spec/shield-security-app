import type { SupabaseClient } from "@supabase/supabase-js";
import { createShiftPayment } from "@/lib/db/payments";
import { shiftHasRecordedWork } from "@/lib/shifts/shiftPay";

type ShiftRow = {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  original_personnel_id?: string | null;
  status: string;
  hourly_rate: number | null;
  total_pay: number | null;
  hours_worked: number | null;
  actual_start: string | null;
  actual_end: string | null;
};

type BookingRow = {
  venue_id: string | null;
  agency_id: string | null;
  self_managed: boolean | null;
  stripe_payment_intent_id: string | null;
  venues?: { id: string; user_id: string } | null;
};

const SHIFT_TERMINAL_STATUSES = ["checked_out", "cancelled", "no_show"];

/** Booking states that may still transition to completed. */
const BOOKING_OPEN_STATUSES = ["pending", "confirmed", "in_progress"];

/**
 * Create the escrow shift_payments row (venue-paid bookings only) and mark the
 * booking completed once every shift under it has reached a terminal state.
 *
 * Agency self-managed bookings carry no venue and no escrow — the agency pays
 * its own staff through payroll — so they skip the payment row but must still
 * complete, otherwise finished jobs sit in the agency board forever.
 */
export async function recordShiftPaymentAndCompleteBooking(
  supabase: SupabaseClient,
  shiftId: string,
): Promise<void> {
  const { data: shiftData } = await supabase
    .from("shifts")
    .select(
      "id, booking_id, personnel_id, original_personnel_id, status, hourly_rate, total_pay, hours_worked, actual_start, actual_end",
    )
    .eq("id", shiftId)
    .maybeSingle();

  const shift = shiftData as ShiftRow | null;
  if (!shift?.booking_id) return;

  const { data: bookingData } = await supabase
    .from("bookings")
    .select(
      "venue_id, agency_id, self_managed, stripe_payment_intent_id, venues(id, user_id)",
    )
    .eq("id", shift.booking_id)
    .maybeSingle();

  const booking = bookingData as BookingRow | null;

  if (shiftHasRecordedWork(shift)) {
    await recordEscrowPayment(supabase, shift, booking);
  }

  await completeBookingIfAllShiftsDone(supabase, shift.booking_id);
}

/**
 * Escrow only applies when a venue is on the hook for the money. Self-managed
 * agency bookings settle off-platform, so no shift_payments row is created.
 */
async function recordEscrowPayment(
  supabase: SupabaseClient,
  shift: ShiftRow,
  booking: BookingRow | null,
): Promise<void> {
  const payeeId = shift.personnel_id ?? shift.original_personnel_id ?? null;
  if (!payeeId) return;
  if (!shift.total_pay || shift.total_pay <= 0) return;

  const venue = booking?.venues ?? null;
  if (!booking?.venue_id || !venue || booking.self_managed) return;

  const { data: existing } = await supabase
    .from("shift_payments")
    .select("id")
    .eq("shift_id", shift.id)
    .maybeSingle();
  if (existing) return;

  let agencyId: string | null = null;
  let agencyCommissionRate: number | undefined;
  const { data: personnel } = await supabase
    .from("personnel")
    .select("agency_id")
    .eq("id", payeeId)
    .maybeSingle();

  if (personnel?.agency_id) {
    agencyId = personnel.agency_id;
    const { data: agency } = await supabase
      .from("agencies")
      .select("commission_rate")
      .eq("id", personnel.agency_id)
      .maybeSingle();
    agencyCommissionRate = agency?.commission_rate ?? 0.15;
  }

  await createShiftPayment(supabase as any, {
    shift: { ...shift, personnel_id: payeeId } as any,
    venueId: booking.venue_id,
    venueOwnerId: venue.user_id,
    agencyId,
    agencyCommissionRate,
    stripePaymentIntentId: booking.stripe_payment_intent_id ?? null,
  });
}

/**
 * A booking is complete when no shift is still live and at least one recorded
 * work — an all-cancelled booking stays open so it can be re-staffed.
 */
async function completeBookingIfAllShiftsDone(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<void> {
  const { data: siblings } = await supabase
    .from("shifts")
    .select("id, status, actual_start")
    .eq("booking_id", bookingId);

  if (!siblings?.length) return;

  const allDone = siblings.every((s) =>
    SHIFT_TERMINAL_STATUSES.includes(s.status),
  );
  const anyWorked = siblings.some((s) => shiftHasRecordedWork(s));
  if (!allDone || !anyWorked) return;

  await supabase
    .from("bookings")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", bookingId)
    .in("status", BOOKING_OPEN_STATUSES);
}
