/**
 * Agency cancel a single shift slot.
 * POST /api/agency/shifts/[id]/cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAgencyShiftContext } from "@/lib/agency/bookingAccess";
import { sendPushNotification } from "@/lib/notifications/push-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CANCELLABLE = new Set(["pending", "accepted", "offered"]);

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

    const { reason } = (await request.json()) as { reason?: string };
    const cancelReason = reason?.trim() || "Cancelled by agency";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ctx = await resolveAgencyShiftContext(supabase, user.id, shiftId);
    if (!ctx) {
      return NextResponse.json({ error: "Shift not found or access denied" }, { status: 403 });
    }

    if (ctx.access !== "owner") {
      return NextResponse.json(
        {
          error:
            "You cannot cancel individual shift slots on a venue contract. Remove your guard instead, or contact the venue.",
        },
        { status: 403 },
      );
    }

    if (!CANCELLABLE.has(ctx.shift.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a shift with status "${ctx.shift.status}".` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { data: shift, error: updErr } = await supabase
      .from("shifts")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: "agency",
        updated_at: now,
      })
      .eq("id", shiftId)
      .select("*")
      .single();

    if (updErr || !shift) {
      return NextResponse.json({ error: "Failed to cancel shift" }, { status: 500 });
    }

    if (ctx.shift.personnel_id) {
      const { data: guard } = await supabase
        .from("personnel")
        .select("user_id, display_name")
        .eq("id", ctx.shift.personnel_id)
        .maybeSingle();

      if (guard?.user_id) {
        const title = "Shift cancelled";
        const body = `Your shift for "${ctx.booking.event_name}" was cancelled. ${cancelReason}`;
        try {
          await sendPushNotification({
            userId: guard.user_id,
            type: "shift_reminder",
            title,
            body,
            data: { shift_id: shiftId, booking_id: ctx.booking.id },
          });
        } catch {
          /* best-effort */
        }
        await supabase.from("notifications").insert({
          user_id: guard.user_id,
          type: "shift_cancelled",
          title,
          body,
          data: { shift_id: shiftId, booking_id: ctx.booking.id, reason: cancelReason },
          is_read: false,
        });
      }
    }

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error("[agency/shifts cancel]", error);
    return NextResponse.json({ error: "Failed to cancel shift" }, { status: 500 });
  }
}
