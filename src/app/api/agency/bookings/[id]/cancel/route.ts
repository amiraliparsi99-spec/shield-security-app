/**
 * Agency cancel booking — cancels the booking and all open shifts, notifies guards.
 * POST /api/agency/bookings/[id]/cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAgencyBookingContext } from "@/lib/agency/bookingAccess";
import { sendPushNotification } from "@/lib/notifications/push-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CANCELLABLE_BOOKING_STATUSES = new Set(["pending", "confirmed"]);
const TERMINAL_SHIFT_STATUSES = new Set(["checked_in", "checked_out", "cancelled", "no_show"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params;
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
    const ctx = await resolveAgencyBookingContext(supabase, user.id, bookingId);
    if (!ctx) {
      return NextResponse.json({ error: "Booking not found or access denied" }, { status: 403 });
    }

    if (ctx.access !== "owner") {
      return NextResponse.json(
        { error: "Only the agency that created this booking can cancel it." },
        { status: 403 },
      );
    }

    if (!CANCELLABLE_BOOKING_STATUSES.has(ctx.booking.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a booking with status "${ctx.booking.status}".` },
        { status: 400 },
      );
    }

    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, status, personnel_id")
      .eq("booking_id", bookingId);

    const activeOnSite = (shifts ?? []).some((s) => s.status === "checked_in");
    if (activeOnSite) {
      return NextResponse.json(
        { error: "Cannot cancel while a guard is checked in on site." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const openShifts = (shifts ?? []).filter((s) => !TERMINAL_SHIFT_STATUSES.has(s.status));

    if (openShifts.length > 0) {
      await supabase
        .from("shifts")
        .update({
          status: "cancelled",
          cancelled_at: now,
          cancelled_by: "agency",
          updated_at: now,
        })
        .in(
          "id",
          openShifts.map((s) => s.id),
        );
    }

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: cancelReason,
        updated_at: now,
      })
      .eq("id", bookingId)
      .select("*")
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
    }

    const personnelIds = [
      ...new Set(
        openShifts.map((s) => s.personnel_id).filter((id): id is string => Boolean(id)),
      ),
    ];

    if (personnelIds.length > 0) {
      const { data: guards } = await supabase
        .from("personnel")
        .select("id, user_id, display_name")
        .in("id", personnelIds);

      for (const guard of guards ?? []) {
        if (!guard.user_id) continue;
        const title = "Shift cancelled";
        const body = `${ctx.agency.name ?? "Your agency"} cancelled "${ctx.booking.event_name}". ${cancelReason}`;
        try {
          await sendPushNotification({
            userId: guard.user_id,
            type: "booking_cancelled",
            title,
            body,
            data: { booking_id: bookingId, type: "booking_cancelled" },
          });
        } catch {
          /* best-effort */
        }
        await supabase.from("notifications").insert({
          user_id: guard.user_id,
          type: "booking_cancelled",
          title,
          body,
          data: { booking_id: bookingId },
          is_read: false,
        });
      }
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("[agency/bookings cancel]", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
