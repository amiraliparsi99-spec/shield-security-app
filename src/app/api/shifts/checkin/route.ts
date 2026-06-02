import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { distanceMeters } from "@/lib/geo/distance";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { applyLateCheckInPenalty } from "@/lib/shifts/shieldScoreEvents";

function maxCheckInDistanceM(): number {
  const n = Number(process.env.CHECK_IN_MAX_DISTANCE_METERS);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

// Guards may only check in within this many minutes before scheduled start.
function checkInEarliestMinutesBeforeStart(): number {
  const n = Number(process.env.CHECK_IN_EARLIEST_MINUTES_BEFORE_START);
  return Number.isFinite(n) && n >= 0 ? n : 15;
}

// Manual checkout may run up to this many minutes past scheduled_end before
// hours are capped. Prevents runaway pay if a phone is left on / cron runs late.
function checkoutOvertimeGraceMinutes(): number {
  const n = Number(process.env.CHECKOUT_OVERTIME_GRACE_MINUTES);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) return user;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { shift_id, action, latitude, longitude, auto } = body as {
    shift_id: string;
    action: "check_in" | "check_out";
    latitude: number;
    longitude: number;
    auto?: boolean;
  };

  if (!shift_id || !action || latitude == null || longitude == null) {
    return NextResponse.json(
      { error: "Missing shift_id, action, latitude, or longitude" },
      { status: 400 },
    );
  }

  const { data: shift, error: shiftErr } = await supabaseAdmin
    .from("shifts")
    .select(
      "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, role, hourly_rate, actual_start",
    )
    .eq("id", shift_id)
    .single();

  if (shiftErr || !shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const { data: personnel } = await supabaseAdmin
    .from("personnel")
    .select("id, user_id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!personnel || personnel.id !== shift.personnel_id) {
    return NextResponse.json(
      { error: "You are not assigned to this shift" },
      { status: 403 },
    );
  }

  const { data: bookingRow } = await supabaseAdmin
    .from("bookings")
    .select("venue_id, site_latitude, site_longitude, site_label")
    .eq("id", shift.booking_id)
    .single();

  let venueLat: number | null = null;
  let venueLon: number | null = null;
  let venueName: string | null = null;

  const siteLat =
    bookingRow?.site_latitude != null ? Number(bookingRow.site_latitude) : null;
  const siteLon =
    bookingRow?.site_longitude != null ? Number(bookingRow.site_longitude) : null;
  const siteLabel =
    typeof bookingRow?.site_label === "string" && bookingRow.site_label.trim()
      ? bookingRow.site_label.trim()
      : null;

  if (
    siteLat != null &&
    siteLon != null &&
    Number.isFinite(siteLat) &&
    Number.isFinite(siteLon)
  ) {
    venueLat = siteLat;
    venueLon = siteLon;
    venueName = siteLabel;
  } else if (bookingRow?.venue_id) {
    const { data: v } = await supabaseAdmin
      .from("venues")
      .select("latitude, longitude, name")
      .eq("id", bookingRow.venue_id)
      .single();
    if (v) {
      venueLat = v.latitude != null ? Number(v.latitude) : null;
      venueLon = v.longitude != null ? Number(v.longitude) : null;
      venueName = v.name ?? null;
    }
  }

  const maxM = maxCheckInDistanceM();

  const validateGeofence = (
    actionLabel: "check_in" | "check_out",
  ): NextResponse | null => {
    if (venueLat == null || venueLon == null || !Number.isFinite(venueLat) || !Number.isFinite(venueLon)) {
      return null;
    }
    const d = distanceMeters(latitude, longitude, venueLat, venueLon);
    if (d > maxM) {
      return NextResponse.json(
        {
          error: `You appear to be about ${Math.round(d)}m from ${venueName || "the venue"}. Move within ${maxM}m to ${actionLabel.replace("_", "-")}, or ask the venue to update their map pin.`,
          distance_meters: Math.round(d),
          max_distance_meters: maxM,
          geofence_failed: true,
        },
        { status: 422 },
      );
    }
    return null;
  };

  // --- CHECK IN ---
  if (action === "check_in") {
    const canCheckIn =
      shift.status === "accepted" ||
      (shift.status === "pending" && shift.personnel_id === personnel.id);
    if (!canCheckIn) {
      return NextResponse.json(
        { error: `Cannot check in from status "${shift.status}"` },
        { status: 422 },
      );
    }

    const earliestMinutes = checkInEarliestMinutesBeforeStart();
    const startMs = new Date(shift.scheduled_start).getTime();
    if (Number.isFinite(startMs)) {
      const earliestMs = startMs - earliestMinutes * 60_000;
      const nowMs = Date.now();
      if (nowMs < earliestMs) {
        const minutesUntilWindow = Math.ceil((earliestMs - nowMs) / 60_000);
        return NextResponse.json(
          {
            error: `Check-in opens ${earliestMinutes} minutes before your shift. Try again in ${minutesUntilWindow} min.`,
            check_in_window_not_open: true,
            earliest_check_in_iso: new Date(earliestMs).toISOString(),
            minutes_until_window: minutesUntilWindow,
          },
          { status: 422 },
        );
      }
    }

    const geoErr = validateGeofence("check_in");
    if (geoErr) return geoErr;

    const now = new Date().toISOString();

    // Tolerant write: try the full patch first (with cover-search cleanup so a
    // recovering original guard cancels any in-flight Wave 1/2 cover offers).
    // If columns are missing on the running schema, fall back progressively.
    const fullPatch: Record<string, unknown> = {
      status: "checked_in",
      actual_start: now,
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      updated_at: now,
      // Cancel any active cover sourcing — the original guard recovered.
      // Setting dispatcher_status back to "none" makes the accept-shift atomic
      // update (which requires "searching"/"at_risk") fail for any in-flight
      // Wave 1 cover taker, preventing double-booking.
      cover_search_wave: 0,
      cover_search_started_at: null,
      cover_search_last_wave_at: null,
      cover_unfilled_at: null,
      dispatcher_status: "none",
      is_urgent: false,
    };
    const minimalPatch: Record<string, unknown> = {
      status: "checked_in",
      actual_start: now,
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      updated_at: now,
    };

    let upErr: any = null;
    {
      const r = await supabaseAdmin
        .from("shifts")
        .update(fullPatch as never)
        .eq("id", shift_id);
      upErr = r.error;
    }
    if (upErr && (upErr as any).code === "42703") {
      // Missing column on this schema (cover_search_* not migrated yet) —
      // retry with the minimal patch so check-in is never blocked by audit columns.
      const retry = await supabaseAdmin
        .from("shifts")
        .update(minimalPatch as never)
        .eq("id", shift_id);
      upErr = retry.error;
    }

    if (upErr) {
      return NextResponse.json({ error: (upErr as any).message ?? String(upErr) }, { status: 500 });
    }

    await postStatusToMissionControl(shift, personnel, "checked_in");

    const lateMs = Date.now() - new Date(shift.scheduled_start).getTime();
    const lateMinutes = Math.floor(lateMs / (60 * 1000));
    if (lateMinutes >= 15) {
      await applyLateCheckInPenalty({
        supabase: supabaseAdmin as any,
        shiftId: shift_id,
        personnelId: personnel.id,
        minutesLate: lateMinutes,
      });
    }

    const d =
      venueLat != null && venueLon != null
        ? Math.round(distanceMeters(latitude, longitude, venueLat, venueLon))
        : null;

    return NextResponse.json({
      success: true,
      status: "checked_in",
      actual_start: now,
      distance_meters: d,
      max_distance_meters: venueLat != null && venueLon != null ? maxM : null,
      geofence_skipped: venueLat == null || venueLon == null,
    });
  }

  // --- CHECK OUT ---
  if (action === "check_out") {
    if (shift.status !== "checked_in") {
      return NextResponse.json(
        { error: `Cannot check out from status "${shift.status}"` },
        { status: 422 },
      );
    }

    if (!shift.actual_start) {
      return NextResponse.json(
        { error: "No check-in recorded" },
        { status: 422 },
      );
    }

    // NOTE: We do NOT block checkout by geofence. A shift must always be
    // closeable so it can stop accruing pay. Distance is still recorded for
    // audit, and the venue gets an attendance-confirmation prompt downstream.
    const dOut =
      venueLat != null && venueLon != null
        ? Math.round(distanceMeters(latitude, longitude, venueLat, venueLon))
        : null;
    const checkoutOutsideGeofence =
      dOut != null && dOut > maxM ? true : false;

    const nowMs = Date.now();
    const actualStart = new Date(shift.actual_start);
    const scheduledEndMs = new Date(shift.scheduled_end).getTime();
    const overtimeGraceMs = checkoutOvertimeGraceMinutes() * 60_000;

    // End-time policy:
    //   - auto checkout (foreground timer or cron-style call): clamp to scheduled_end
    //   - manual checkout: clamp to scheduled_end + overtime grace, never beyond
    // This prevents runaway pay if a guard's phone is left on long after the
    // shift ends, or a delayed cron tries to close the shift hours later.
    let endMs: number;
    if (auto) {
      endMs = Number.isFinite(scheduledEndMs)
        ? Math.min(nowMs, scheduledEndMs)
        : nowMs;
    } else {
      const hardCapMs = Number.isFinite(scheduledEndMs)
        ? scheduledEndMs + overtimeGraceMs
        : nowMs;
      endMs = Math.min(nowMs, hardCapMs);
    }
    // Never end before the actual start.
    if (endMs < actualStart.getTime()) endMs = actualStart.getTime();

    const actualEnd = new Date(endMs);
    const hoursWorked =
      (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
    const totalPay = hoursWorked * Number(shift.hourly_rate ?? 0);

    const { error: upErr } = await supabaseAdmin
      .from("shifts")
      .update({
        status: "checked_out",
        actual_end: actualEnd.toISOString(),
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        hours_worked: Math.round(Math.max(0, hoursWorked) * 100) / 100,
        total_pay: Math.round(Math.max(0, totalPay) * 100) / 100,
        updated_at: new Date(nowMs).toISOString(),
      })
      .eq("id", shift_id)
      .eq("status", "checked_in");

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await postStatusToMissionControl(shift, personnel, "checked_out", {
      hours_worked: Math.round(Math.max(0, hoursWorked) * 100) / 100,
      total_pay: Math.round(Math.max(0, totalPay) * 100) / 100,
    });

    await notifyVenueAttendanceConfirmation({
      shiftId: shift_id,
      bookingId: shift.booking_id,
      personnelName: personnel.display_name || "Guard",
    });

    return NextResponse.json({
      success: true,
      status: "checked_out",
      actual_end: actualEnd.toISOString(),
      hours_worked: Math.round(Math.max(0, hoursWorked) * 100) / 100,
      total_pay: Math.round(Math.max(0, totalPay) * 100) / 100,
      distance_meters: dOut,
      max_distance_meters: venueLat != null && venueLon != null ? maxM : null,
      geofence_skipped: venueLat == null || venueLon == null,
      checkout_outside_geofence: checkoutOutsideGeofence,
      auto: auto === true,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function notifyVenueAttendanceConfirmation(params: {
  shiftId: string;
  bookingId: string;
  personnelName: string;
}): Promise<void> {
  const { shiftId, bookingId, personnelName } = params;

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, event_name, venue_id")
    .eq("id", bookingId)
    .single();

  if (!booking?.venue_id) return;

  const { data: venue } = await supabaseAdmin
    .from("venues")
    .select("id, name, user_id, owner_id")
    .eq("id", booking.venue_id)
    .single();

  const venueUserId =
    (venue as { owner_id?: string | null; user_id?: string | null } | null)?.owner_id ??
    (venue as { user_id?: string | null } | null)?.user_id ??
    null;

  if (!venueUserId) return;

  const title = "Shift Attendance Confirmation Needed";
  const body = `${personnelName} checked out of "${booking.event_name}". Please confirm attendance or raise a dispute.`;

  await supabaseAdmin.from("notifications").insert({
    user_id: venueUserId,
    type: "shift",
    title,
    body,
    data: {
      type: "venue_attendance_confirmation",
      shift_id: shiftId,
      booking_id: bookingId,
      action: "open_live_checkin",
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
    },
  });
}

async function postStatusToMissionControl(
  shift: {
    id: string;
    booking_id: string;
    personnel_id: string | null;
    role: string;
  },
  personnel: { id: string; display_name: string | null },
  newStatus: "checked_in" | "checked_out",
  extra?: { hours_worked?: number; total_pay?: number },
) {
  const { data: gc } = await supabaseAdmin
    .from("group_chats")
    .select("id")
    .eq("booking_id", shift.booking_id)
    .eq("chat_type", "mission_control")
    .eq("is_active", true)
    .maybeSingle();

  if (!gc?.id) return;

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("venue_id")
    .eq("id", shift.booking_id)
    .single();

  if (!booking?.venue_id) return;

  const { data: venue } = await supabaseAdmin
    .from("venues")
    .select("user_id")
    .eq("id", booking.venue_id)
    .single();

  if (!venue?.user_id) return;

  const guardName = personnel.display_name || "Guard";
  const role = shift.role || "Security";
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let content: string;
  let metaType: string;

  if (newStatus === "checked_in") {
    content =
      `✅ **${guardName} has checked in**\n\n` +
      `${role} guard is now on duty (${time}). Check Live Check-In for location details.`;
    metaType = "shift_checkin_confirmed";
  } else {
    const hrs = extra?.hours_worked?.toFixed(1) ?? "?";
    content =
      `🏁 **${guardName} has checked out**\n\n` +
      `Shift complete at ${time} — ${hrs} hours worked. Payment processing will begin shortly.`;
    metaType = "shift_checkout_confirmed";
  }

  await supabaseAdmin.from("group_chat_messages").insert({
    group_chat_id: gc.id,
    sender_id: venue.user_id,
    content,
    message_type: "system",
    metadata: {
      type: metaType,
      shift_id: shift.id,
      booking_id: shift.booking_id,
      personnel_id: shift.personnel_id,
      status: newStatus,
    },
  });

  await supabaseAdmin
    .from("group_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", gc.id);
}
