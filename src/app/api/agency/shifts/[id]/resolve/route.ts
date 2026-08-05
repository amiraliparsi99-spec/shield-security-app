/**
 * Agency mid-shift resolution — cancel, close early, or find urgent cover.
 * POST /api/agency/shifts/[id]/resolve
 * Body: { action: "cancel" | "close_early" | "find_cover", reason?: string, force?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAgencyShiftContext } from "@/lib/agency/bookingAccess";
import {
  canAgencyOfferCover,
  isShiftInProgress,
  remainingMinutes,
} from "@/lib/shifts/marketplace";
import { kickoffCoverWave1 } from "@/lib/shifts/coverEngine";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { shiftHasRecordedWork } from "@/lib/shifts/shiftPay";
import { recordShiftPaymentAndCompleteBooking } from "@/lib/shifts/finalizeShiftWork";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ResolveAction = "cancel" | "close_early" | "find_cover";

type ShiftRow = {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  hourly_rate: number | null;
  cover_search_wave: number | null;
  cover_search_started_at: string | null;
};

async function notifyGuard(
  supabase: ReturnType<typeof createClient<any>>,
  personnelId: string | null,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!personnelId) return;
  const { data: guard } = await supabase
    .from("personnel")
    .select("user_id")
    .eq("id", personnelId)
    .maybeSingle();
  const guardUserId = (guard as { user_id?: string } | null)?.user_id;
  if (!guardUserId) return;

  try {
    await sendPushNotification({
      userId: guardUserId,
      type: "shift_reminder",
      title,
      body,
      data,
    });
  } catch {
    /* best-effort */
  }

  await supabase.from("notifications").insert({
    user_id: guardUserId,
    type: "shift_cancelled",
    title,
    body,
    data,
    is_read: false,
  });
}

async function checkoutGuardEarly(
  supabase: ReturnType<typeof createClient<any>>,
  shift: ShiftRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (shift.status !== "checked_in" || !shift.actual_start) {
    return { ok: true };
  }

  const nowMs = Date.now();
  const actualStart = new Date(shift.actual_start);
  const scheduledEndMs = new Date(shift.scheduled_end).getTime();
  const endMs = Number.isFinite(scheduledEndMs)
    ? Math.min(nowMs, scheduledEndMs)
    : nowMs;
  const safeEndMs = Math.max(endMs, actualStart.getTime());
  const actualEnd = new Date(safeEndMs);
  const hoursWorked =
    (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
  const totalPay = hoursWorked * Number(shift.hourly_rate ?? 0);

  const { error } = await supabase
    .from("shifts")
    .update({
      status: "checked_out",
      actual_end: actualEnd.toISOString(),
      hours_worked: Math.round(Math.max(0, hoursWorked) * 100) / 100,
      total_pay: Math.round(Math.max(0, totalPay) * 100) / 100,
      is_urgent: false,
      dispatcher_status: "none",
      cover_search_wave: 0,
      cover_search_started_at: null,
      cover_search_last_wave_at: null,
      updated_at: new Date(nowMs).toISOString(),
    })
    .eq("id", shift.id)
    .eq("status", "checked_in");

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordShiftPaymentAndCompleteBooking(supabase, shift.id);
  return { ok: true };
}

function clearCoverFlags(now: string): Record<string, unknown> {
  return {
    is_urgent: false,
    dispatcher_status: "none",
    cover_search_wave: 0,
    cover_search_started_at: null,
    cover_search_last_wave_at: null,
    updated_at: now,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shiftId } = await params;
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: ResolveAction;
      reason?: string;
      force?: boolean;
    };
    const action = body.action;
    if (!action || !["cancel", "close_early", "find_cover"].includes(action)) {
      return NextResponse.json(
        { error: "action must be cancel, close_early, or find_cover" },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ctx = await resolveAgencyShiftContext(supabase, user.id, shiftId);
    if (!ctx || ctx.access !== "owner") {
      return NextResponse.json({ error: "Shift not found or access denied" }, { status: 403 });
    }

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, actual_start, actual_end, hourly_rate, cover_search_wave, cover_search_started_at",
      )
      .eq("id", shiftId)
      .single();

    if (shiftErr || !shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const row = shift as ShiftRow;
    const now = new Date().toISOString();
    const reason = body.reason?.trim() || undefined;
    const eventName = ctx.booking.event_name ?? "your shift";
    const previousPersonnelId = row.personnel_id;

    if (row.status === "cancelled") {
      return NextResponse.json({ error: "This shift is already cancelled." }, { status: 409 });
    }

    if (action === "cancel") {
      if (row.status === "checked_in") {
        const checkout = await checkoutGuardEarly(supabase, row);
        if (!checkout.ok) {
          return NextResponse.json({ error: checkout.error }, { status: 500 });
        }
      }

      const { data: refreshed } = await supabase
        .from("shifts")
        .select(
          "id, booking_id, personnel_id, status, actual_start, actual_end, total_pay, hours_worked",
        )
        .eq("id", shiftId)
        .single();

      const worked =
        refreshed &&
        shiftHasRecordedWork({
          status: refreshed.status,
          actual_start: refreshed.actual_start,
        });

      if (worked) {
        await supabase
          .from("shifts")
          .update({
            cancellation_reason:
              reason ?? "Event ended early — pay is based on actual time worked",
            ...clearCoverFlags(now),
          })
          .eq("id", shiftId);

        await recordShiftPaymentAndCompleteBooking(supabase, shiftId);

        await notifyGuard(
          supabase,
          previousPersonnelId,
          "Shift completed",
          `Your work for "${eventName}" has been recorded. Pay is based on your actual time on site.`,
          { shift_id: shiftId, booking_id: row.booking_id, action: "work_preserved" },
        );

        return NextResponse.json({
          success: true,
          action: "work_preserved",
          message: "Guard's completed work and pay have been preserved.",
        });
      }

      const { error: updErr } = await supabase
        .from("shifts")
        .update({
          status: "cancelled",
          cancelled_at: now,
          cancelled_by: "agency",
          cancellation_reason: reason ?? "Cancelled by agency",
          ...clearCoverFlags(now),
        })
        .eq("id", shiftId);

      if (updErr) {
        return NextResponse.json({ error: "Failed to cancel shift" }, { status: 500 });
      }

      // Cancelling the last live shift can be what completes the booking.
      await recordShiftPaymentAndCompleteBooking(supabase, shiftId);

      await notifyGuard(
        supabase,
        previousPersonnelId,
        "Shift cancelled",
        `Your shift for "${eventName}" was cancelled.${reason ? ` ${reason}` : ""}`,
        { shift_id: shiftId, booking_id: row.booking_id, action: "cancel" },
      );

      return NextResponse.json({ success: true, action: "cancel" });
    }

    if (action === "close_early") {
      if (row.status === "checked_in") {
        const checkout = await checkoutGuardEarly(supabase, row);
        if (!checkout.ok) {
          return NextResponse.json({ error: checkout.error }, { status: 500 });
        }
        await recordShiftPaymentAndCompleteBooking(supabase, shiftId);

        await notifyGuard(
          supabase,
          previousPersonnelId,
          "Shift completed early",
          `Your shift for "${eventName}" ended early. Pay is based on your actual time on site.`,
          { shift_id: shiftId, booking_id: row.booking_id, action: "close_early" },
        );

        return NextResponse.json({
          success: true,
          action: "close_early",
          message: "Shift closed with pay for time worked.",
        });
      } else if (
        row.status === "accepted" ||
        (row.status === "pending" && previousPersonnelId)
      ) {
        const { error: updErr } = await supabase
          .from("shifts")
          .update({
            status: "cancelled",
            cancelled_at: now,
            cancelled_by: "agency",
            cancellation_reason: reason ?? "Closed early — coverage no longer required",
            personnel_id: null,
            ...clearCoverFlags(now),
          })
          .eq("id", shiftId);
        if (updErr) {
          return NextResponse.json({ error: "Failed to close shift" }, { status: 500 });
        }

        await recordShiftPaymentAndCompleteBooking(supabase, shiftId);

        await notifyGuard(
          supabase,
          previousPersonnelId,
          "Shift closed early",
          `Coverage for "${eventName}" has ended early.${reason ? ` ${reason}` : ""}`,
          { shift_id: shiftId, booking_id: row.booking_id, action: "close_early" },
        );

        return NextResponse.json({ success: true, action: "close_early" });
      }

      await supabase
        .from("shifts")
        .update(clearCoverFlags(now))
        .eq("id", shiftId);

      return NextResponse.json({ success: true, action: "close_early" });
    }

    // find_cover
    const minsLeft = remainingMinutes(row.scheduled_end);
    if (!canAgencyOfferCover(row.scheduled_end, Date.now(), body.force)) {
      return NextResponse.json(
        {
          error: `Only ${minsLeft} min remain — not enough time for urgent cover. Close the shift early instead, or pass force=true to override.`,
          minutes_remaining: minsLeft,
          code: "INSUFFICIENT_REMAINING_TIME",
        },
        { status: 422 },
      );
    }

    if (row.status === "checked_in") {
      const checkout = await checkoutGuardEarly(supabase, row);
      if (!checkout.ok) {
        return NextResponse.json({ error: checkout.error }, { status: 500 });
      }
    }

    const { error: reopenErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: null,
        status: "pending",
        accepted_at: null,
        original_personnel_id: previousPersonnelId,
        withdrawal_reason: reason ?? "Agency requested urgent cover",
        withdrawal_at: now,
        updated_at: now,
      })
      .eq("id", shiftId);

    if (reopenErr) {
      return NextResponse.json({ error: "Failed to reopen shift for cover" }, { status: 500 });
    }

    const { data: refreshed } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, cover_search_wave, cover_search_started_at",
      )
      .eq("id", shiftId)
      .single();

    const coverResult = await kickoffCoverWave1({
      supabase: supabase as any,
      shift: refreshed as ShiftRow,
      trigger: "manual",
      excludePersonnelIds: previousPersonnelId ? [previousPersonnelId] : [],
    });

    return NextResponse.json({
      success: true,
      action: "find_cover",
      minutes_remaining: minsLeft,
      in_progress: isShiftInProgress(row),
      cover: coverResult,
    });
  } catch (error) {
    console.error("[agency/shifts resolve]", error);
    return NextResponse.json({ error: "Failed to resolve shift" }, { status: 500 });
  }
}
