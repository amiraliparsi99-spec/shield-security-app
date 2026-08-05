import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { requireCronAuth } from "@/lib/auth/cronAuth";
import { recordShiftPaymentAndCompleteBooking } from "@/lib/shifts/finalizeShiftWork";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAutoCheckoutGraceMinutes(): number {
  const value = Number(process.env.AUTO_CHECKOUT_GRACE_MINUTES ?? "0");
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const graceMinutes = getAutoCheckoutGraceMinutes();
    const cutoff = new Date(Date.now() - graceMinutes * 60_000).toISOString();

    const { data: candidates, error: queryErr } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, role, hourly_rate, status, scheduled_start, scheduled_end, actual_start, actual_end, check_in_latitude, check_in_longitude",
      )
      .eq("status", "checked_in")
      .is("actual_end", null)
      .lte("scheduled_end", cutoff)
      .limit(200);

    if (queryErr) {
      console.error("[AUTO-CHECKOUT] Failed to query shifts:", queryErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    let autoCheckedOut = 0;
    let failed = 0;

    for (const shift of candidates ?? []) {
      const now = new Date();
      const actualStart = new Date(shift.actual_start ?? shift.scheduled_start);
      const scheduledEnd = new Date(shift.scheduled_end);

      // Auto-checkout policy: end time is exactly scheduled_end. The shift
      // does NOT keep accruing pay past the scheduled end just because the
      // cron ran late or the guard's phone was off. Manual checkout (with
      // overtime grace) is the only path to pay beyond scheduled_end.
      const endMsCandidate = Number.isFinite(scheduledEnd.getTime())
        ? scheduledEnd.getTime()
        : now.getTime();
      const safeStartMs =
        actualStart.getTime() > endMsCandidate ? endMsCandidate : actualStart.getTime();
      const endMs = endMsCandidate < safeStartMs ? safeStartMs : endMsCandidate;
      const actualEnd = new Date(endMs);

      const hoursWorkedRaw = (endMs - safeStartMs) / (1000 * 60 * 60);
      const hoursWorked = Math.round(Math.max(0, hoursWorkedRaw) * 100) / 100;
      const totalPay = Math.round(hoursWorked * Number(shift.hourly_rate ?? 0) * 100) / 100;

      const { error: updateErr } = await supabase
        .from("shifts")
        .update({
          status: "checked_out",
          actual_end: actualEnd.toISOString(),
          check_out_latitude: shift.check_in_latitude ?? null,
          check_out_longitude: shift.check_in_longitude ?? null,
          hours_worked: hoursWorked,
          total_pay: totalPay,
          updated_at: now.toISOString(),
        })
        .eq("id", shift.id)
        .eq("status", "checked_in");

      if (updateErr) {
        failed++;
        console.error(`[AUTO-CHECKOUT] Failed to update shift ${shift.id}:`, updateErr);
        continue;
      }

      const personnelName = await getPersonnelName(supabase, shift.personnel_id);

      await postStatusToMissionControl(
        supabase,
        {
          id: shift.id,
          booking_id: shift.booking_id,
          personnel_id: shift.personnel_id,
          role: shift.role,
        },
        personnelName,
        {
          hours_worked: hoursWorked,
          total_pay: totalPay,
          auto_checkout: true,
        },
      );

      await notifyVenueAttendanceConfirmation(supabase, {
        shiftId: shift.id,
        bookingId: shift.booking_id,
        personnelName,
        autoCheckout: true,
      });

      await recordShiftPaymentAndCompleteBooking(supabase, shift.id);

      autoCheckedOut++;
    }

    return NextResponse.json({
      success: true,
      checked: candidates?.length ?? 0,
      auto_checked_out: autoCheckedOut,
      failed,
      grace_minutes: graceMinutes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[AUTO-CHECKOUT] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

async function getPersonnelName(
  supabase: SupabaseClient<any>,
  personnelId: string | null,
): Promise<string> {
  if (!personnelId) return "Guard";

  const { data: personnel } = await supabase
    .from("personnel")
    .select("display_name")
    .eq("id", personnelId)
    .maybeSingle();

  return personnel?.display_name?.trim() || "Guard";
}

async function notifyVenueAttendanceConfirmation(
  supabase: SupabaseClient<any>,
  params: {
    shiftId: string;
    bookingId: string;
    personnelName: string;
    autoCheckout: boolean;
  },
): Promise<void> {
  const { shiftId, bookingId, personnelName, autoCheckout } = params;
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, event_name, venue_id")
    .eq("id", bookingId)
    .single();

  if (!booking?.venue_id) return;

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, user_id")
    .eq("id", booking.venue_id)
    .single();

  const venueUserId =
    (venue as { user_id?: string | null } | null)?.user_id ?? null;

  if (!venueUserId) return;

  const title = autoCheckout
    ? "Shift Auto Checked Out - Confirmation Needed"
    : "Shift Attendance Confirmation Needed";
  const body = autoCheckout
    ? `${personnelName}'s shift for "${booking.event_name}" reached end time and was automatically checked out. Please confirm attendance or raise a dispute.`
    : `${personnelName} checked out of "${booking.event_name}". Please confirm attendance or raise a dispute.`;

  await supabase.from("notifications").insert({
    user_id: venueUserId,
    type: "shift",
    title,
    body,
    data: {
      type: "venue_attendance_confirmation",
      shift_id: shiftId,
      booking_id: bookingId,
      action: "open_live_checkin",
      auto_checkout: autoCheckout,
    },
    is_read: false,
  } as any);

  await sendPushNotification({
    userId: venueUserId,
    type: "shift_reminder",
    title,
    body,
    data: {
      reminder_kind: "venue_attendance_confirmation",
      shift_id: shiftId,
      booking_id: bookingId,
      action: "open_live_checkin",
      auto_checkout: autoCheckout,
    },
  });
}

async function postStatusToMissionControl(
  supabase: SupabaseClient<any>,
  shift: {
    id: string;
    booking_id: string;
    personnel_id: string | null;
    role: string | null;
  },
  personnelName: string,
  extra?: { hours_worked?: number; total_pay?: number; auto_checkout?: boolean },
): Promise<void> {
  const { data: gc } = await supabase
    .from("group_chats")
    .select("id")
    .eq("booking_id", shift.booking_id)
    .eq("chat_type", "mission_control")
    .eq("is_active", true)
    .maybeSingle();

  if (!gc?.id) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("venue_id")
    .eq("id", shift.booking_id)
    .single();

  if (!booking?.venue_id) return;

  const { data: venue } = await supabase
    .from("venues")
    .select("user_id")
    .eq("id", booking.venue_id)
    .single();

  if (!venue?.user_id) return;

  const role = shift.role || "Security";
  const hrs = extra?.hours_worked?.toFixed(1) ?? "?";
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const suffix = extra?.auto_checkout
    ? "This checkout was automatic at scheduled shift end."
    : "Payment processing will begin shortly.";
  const content =
    `🏁 **${personnelName} has checked out**\n\n` +
    `${role} shift complete at ${time} — ${hrs} hours worked. ${suffix}`;

  await supabase.from("group_chat_messages").insert({
    group_chat_id: gc.id,
    sender_id: venue.user_id,
    content,
    message_type: "system",
    metadata: {
      type: "shift_checkout_confirmed",
      shift_id: shift.id,
      booking_id: shift.booking_id,
      personnel_id: shift.personnel_id,
      status: "checked_out",
      auto_checkout: extra?.auto_checkout ?? false,
    },
  });

  await supabase
    .from("group_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", gc.id);
}
