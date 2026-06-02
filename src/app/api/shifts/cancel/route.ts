/**
 * Cancel Shift API
 * Allows both venues and security guards to cancel a shift
 * 
 * POST /api/shifts/cancel
 * Body: { shift_id: string, reason: string, cancelled_by: 'venue' | 'guard' }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyGuardsForBooking } from "@/lib/notifications/notify-guards";
import { insertMissionControlSystemMessage } from "@/lib/mission-control/shiftReminders";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ServiceClient = ReturnType<typeof createClient>;

/**
 * Reopen a shift for cover: clear guard assignment and return to board.
 * Tries progressively smaller patches so one bad column/trigger path cannot
 * block the core release (personnel cleared + status pending).
 */
async function reopenShiftForGuardCover(
  supabase: ServiceClient,
  shiftId: string,
  params: {
    previousPersonnelId: string | null;
    reason: string;
    now: Date;
    penaltyApplied: boolean;
  }
): Promise<{ strategy: number } | { error: unknown }> {
  const { previousPersonnelId, reason, now, penaltyApplied } = params;

  const strategies: Record<string, unknown>[] = [
    {
      personnel_id: null,
      status: "pending",
      accepted_at: null,
      declined_at: null,
      decline_reason: null,
      is_urgent: true,
      dispatcher_status: "searching",
      original_personnel_id: previousPersonnelId,
      surge_rate: null,
      withdrawal_reason: reason.trim(),
      withdrawal_at: now.toISOString(),
      cover_search_wave: 1,
      cover_search_started_at: now.toISOString(),
      cover_search_last_wave_at: now.toISOString(),
      cancelled_at: null,
      cancelled_by: null,
    },
    {
      personnel_id: null,
      status: "pending",
      accepted_at: null,
      declined_at: null,
      decline_reason: null,
      cancelled_at: null,
      cancelled_by: null,
    },
    {
      personnel_id: null,
      status: "pending",
    },
  ];

  let lastError: unknown = null;

  for (let i = 0; i < strategies.length; i++) {
    const { data, error } = await (supabase as any)
      .from("shifts")
      .update(strategies[i])
      .eq("id", shiftId)
      .select("id");

    const rowTouched = !error && Array.isArray(data) && data.length > 0;
      if (rowTouched) {
      if (i > 0) {
        const enrich = {
          is_urgent: true,
          dispatcher_status: "searching",
          withdrawal_reason: reason.trim(),
          withdrawal_at: now.toISOString(),
          cover_search_wave: 1,
          cover_search_started_at: now.toISOString(),
          cover_search_last_wave_at: now.toISOString(),
          original_personnel_id: previousPersonnelId,
          surge_rate: null,
        };
        const { error: enrichErr } = await (supabase as any)
          .from("shifts")
          .update(enrich)
          .eq("id", shiftId);
        if (enrichErr) {
          console.warn("[cancel] optional enrich after fallback failed:", enrichErr);
        }
      }
      return { strategy: i };
    }

    if (error) {
      lastError = error;
      console.error(`[cancel] guard reopen strategy ${i} failed:`, error);
    } else {
      lastError = { code: "NO_ROWS_UPDATED", message: "Shift update matched no rows" };
      console.error(`[cancel] guard reopen strategy ${i}: no rows updated for shift`, shiftId);
    }
  }

  return { error: lastError };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shift_id, reason, cancelled_by } = body;

    // Validate required fields
    if (!shift_id) {
      return NextResponse.json(
        { error: "shift_id is required" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A reason for cancellation is required (minimum 5 characters)" },
        { status: 400 }
      );
    }

    if (!cancelled_by || !["venue", "guard"].includes(cancelled_by)) {
      return NextResponse.json(
        { error: "cancelled_by must be 'venue' or 'guard'" },
        { status: 400 }
      );
    }

    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create user client to verify auth
    const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load shift without nested embeds — broken PostgREST relationships previously
    // surfaced as false "Shift not found" (entire select failed).
    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, hourly_rate"
      )
      .eq("id", shift_id)
      .single();

    if (shiftError) {
      if (shiftError.code === "PGRST116") {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }
      console.error("[cancel] shift lookup failed:", shiftError.code, shiftError.message);
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "development"
              ? `Shift lookup failed: ${shiftError.message}`
              : "Unable to look up this shift. Please try again.",
        },
        { status: 500 }
      );
    }

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const { data: bookingRow, error: bookingError } = await supabase
      .from("bookings")
      .select("id, venue_id")
      .eq("id", shift.booking_id)
      .single();

    if (bookingError || !bookingRow) {
      console.error("[cancel] booking for shift missing:", shift.booking_id, bookingError);
      return NextResponse.json(
        { error: "Shift data is inconsistent. Please contact support." },
        { status: 500 }
      );
    }

    const { data: venueRow, error: venueError } = await supabase
      .from("venues")
      .select("id, name, user_id")
      .eq("id", bookingRow.venue_id)
      .single();

    if (venueError || !venueRow) {
      console.error("[cancel] venue for booking missing:", bookingRow.venue_id, venueError);
      return NextResponse.json(
        { error: "Shift data is inconsistent. Please contact support." },
        { status: 500 }
      );
    }

    let personnelRow: { id: string; user_id: string; display_name: string | null } | null =
      null;
    if (shift.personnel_id) {
      const { data: p, error: personnelError } = await supabase
        .from("personnel")
        .select("id, user_id, display_name")
        .eq("id", shift.personnel_id)
        .single();
      if (personnelError || !p) {
        console.error("[cancel] personnel for shift missing:", shift.personnel_id, personnelError);
        return NextResponse.json(
          { error: "Shift assignment data is missing. Please contact support." },
          { status: 500 }
        );
      }
      personnelRow = p;
    }

    // Check if shift can be cancelled
    const cancellableStatuses = ["pending", "accepted"];
    if (!cancellableStatuses.includes(shift.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a shift with status '${shift.status}'. Only pending or accepted shifts can be cancelled.` },
        { status: 400 }
      );
    }

    if (cancelled_by === "venue") {
      if (venueRow.user_id !== user.id) {
        return NextResponse.json(
          { error: "You don't have permission to cancel this shift as a venue" },
          { status: 403 }
        );
      }
    } else if (cancelled_by === "guard") {
      if (personnelRow?.user_id !== user.id) {
        return NextResponse.json(
          { error: "You don't have permission to cancel this shift" },
          { status: 403 }
        );
      }
    }

    // Calculate cancellation fee/penalty based on timing
    const now = new Date();
    const shiftStart = new Date(shift.scheduled_start);
    const hoursUntilShift = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let cancellationNote = "";
    let penaltyApplied = false;

    if (hoursUntilShift < 24) {
      penaltyApplied = true;
      if (cancelled_by === "guard") {
        cancellationNote = "Late cancellation (less than 24 hours notice). This may affect your reliability rating.";
      } else {
        cancellationNote = "Late cancellation (less than 24 hours notice). Guard may be entitled to partial compensation.";
      }
    } else if (hoursUntilShift < 48) {
      cancellationNote = "Cancellation with less than 48 hours notice.";
    }

    const previousPersonnelId = shift.personnel_id as string | null;

    /**
     * Reopen accepted future shifts to board + urgent replacement search
     * (for both guard and venue initiated release). This keeps the slot live.
     */
    if (hoursUntilShift > 0 && shift.personnel_id) {
      const { error: offersErr } = await supabase
        .from("shift_offers")
        .delete()
        .eq("shift_id", shift_id);
      if (offersErr) {
        console.warn("[cancel] shift_offers delete (non-fatal):", offersErr);
      }

      const reopenResult = await reopenShiftForGuardCover(supabase as any, shift_id, {
        previousPersonnelId,
        reason: reason.trim(),
        now,
        penaltyApplied,
      });

      if ("error" in reopenResult) {
        const e = reopenResult.error as { code?: string; message?: string } | null;
        console.error("Error reopening shift for cover (all strategies):", reopenResult.error);
        return NextResponse.json(
          {
            error: "Failed to release shift for replacement",
            ...(process.env.NODE_ENV === "development" && e?.message
              ? { debug: `${e.code ?? ""} ${e.message}`.trim() }
              : {}),
          },
          { status: 500 }
        );
      }

      const reopenUsedFallback = reopenResult.strategy > 0;

      let notifyResult: Awaited<ReturnType<typeof notifyGuardsForBooking>> | null = null;
      try {
        // Wave 1 cover offers: tighter 5-mile radius via env (the legacy
        // URGENT_COVER_RADIUS_MILES is broader and is now used by the
        // wave-broadening cron as a fallback).
        const wave1RadiusMiles = Number(process.env.COVER_WAVE_1_RADIUS_MILES) > 0
          ? Number(process.env.COVER_WAVE_1_RADIUS_MILES)
          : 5;
        notifyResult = await notifyGuardsForBooking(shift.booking_id, wave1RadiusMiles, {
          urgent: true,
          excludePersonnelIds: previousPersonnelId ? [previousPersonnelId] : [],
        });

        // Audit the wave (best-effort — table may not exist on older schema).
        await (supabase as any).from("shift_cover_waves").insert({
          shift_id,
          wave: 1,
          radius_miles: wave1RadiusMiles,
          trigger: cancelled_by === "guard" ? "guard_withdrawal" : "venue_release",
          guards_notified: notifyResult?.guards_notified ?? 0,
          offers_created: notifyResult?.offers_created ?? 0,
          metadata: { reason: reason.trim() },
        });
      } catch (notifyErr) {
        console.error("[cancel] notifyGuardsForBooking failed:", notifyErr);
      }

      if (venueRow.user_id) {
        const releasedByLabel =
          cancelled_by === "guard"
            ? personnelRow?.display_name || "A guard"
            : "The venue";
        await supabase.from("notifications").insert({
          user_id: venueRow.user_id,
          type: "shift_needs_cover",
          title: "Guard released shift — finding cover",
          body: `${releasedByLabel} released this shift. We're notifying nearby guards (${notifyResult?.guards_notified ?? 0} alerted).`,
          data: {
            shift_id,
            booking_id: shift.booking_id,
            reason: reason.trim(),
            released_by: cancelled_by,
          },
        });
      }

      // Post operational visibility in Mission Control for venue teams.
      const { data: groupChat } = await supabase
        .from("group_chats")
        .select("id")
        .eq("booking_id", shift.booking_id)
        .eq("chat_type", "mission_control")
        .eq("is_active", true)
        .maybeSingle();

      if (groupChat?.id && venueRow.user_id && cancelled_by === "guard") {
        const guardName = personnelRow?.display_name || "The guard";
        await insertMissionControlSystemMessage({
          supabase: supabase as any,
          groupChatId: groupChat.id,
          senderId: venueRow.user_id,
          content:
            `⚠️ **Guard released this shift**\n\n` +
            `${guardName} selected “I can’t confirm” and released the shift.\n` +
            `**Reason:** ${reason.trim()}`,
          metadata: {
            type: "shift_released_by_guard_2h_confirmation",
            shift_id,
            booking_id: shift.booking_id,
            released_by: "guard",
            release_reason: reason.trim(),
          },
        });
      }

      if (cancelled_by === "venue" && personnelRow?.user_id) {
        await supabase.from("notifications").insert({
          user_id: personnelRow.user_id,
          type: "shift_cancelled",
          title: "Shift released by venue",
          body: `${venueRow.name || "The venue"} released your shift and is re-posting it for urgent cover.`,
          data: {
            shift_id,
            booking_id: shift.booking_id,
            cancelled_by,
            reason: reason.trim(),
            reopened_for_cover: true,
          },
        });
      }

      return NextResponse.json({
        success: true,
        mode: "reopened_for_cover",
        message:
          cancelled_by === "venue"
            ? "Shift released by venue. We're searching for nearby cover."
            : "Shift released. We're searching for nearby cover.",
        cancellation_note: cancellationNote || undefined,
        penalty_applied: penaltyApplied,
        schema_fallback_used: reopenUsedFallback || undefined,
        replacement_search: notifyResult
          ? {
              guards_notified: notifyResult.guards_notified,
              offers_created: notifyResult.offers_created ?? 0,
            }
          : null,
      });
    }

    // Venue: cancel the shift entirely
    const cancelledByForDb = cancelled_by === "guard" ? "personnel" : cancelled_by;
    let { error: updateError } = await supabase
      .from("shifts")
      .update({
        status: "cancelled",
        cancelled_at: now.toISOString(),
        cancelled_by: cancelledByForDb,
      })
      .eq("id", shift_id);

    if (updateError && cancelled_by === "guard") {
      const retry = await supabase
        .from("shifts")
        .update({
          status: "cancelled",
          cancelled_at: now.toISOString(),
          cancelled_by: "guard",
        })
        .eq("id", shift_id);
      updateError = retry.error;
    }

    if (updateError) {
      let { error: minimalErr } = await supabase
        .from("shifts")
        .update({ status: "cancelled" })
        .eq("id", shift_id);
      updateError = minimalErr;
    }

    if (updateError) {
      console.error("Error updating shift:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel shift" },
        { status: 500 }
      );
    }

    // Send notification to the other party
    const notificationRecipient =
      cancelled_by === "venue" ? personnelRow?.user_id : venueRow.user_id;

    if (notificationRecipient) {
      const notificationTitle = cancelled_by === "venue"
        ? "Shift Cancelled by Venue"
        : "Shift Cancelled by Guard";
      
      const notificationBody = cancelled_by === "venue"
        ? `Your shift at ${venueRow.name || "the venue"} has been cancelled. Reason: ${reason}`
        : `${personnelRow?.display_name || "A guard"} has cancelled their shift. Reason: ${reason}`;

      await supabase.from("notifications").insert({
        user_id: notificationRecipient,
        type: "shift_cancelled",
        title: notificationTitle,
        body: notificationBody,
        data: {
          shift_id: shift_id,
          booking_id: shift.booking_id,
          cancelled_by: cancelled_by,
          reason: reason,
          penalty_applied: penaltyApplied,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Shift cancelled successfully",
      cancellation_note: cancellationNote || undefined,
      penalty_applied: penaltyApplied,
    });

  } catch (error: any) {
    console.error("Cancel shift error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
