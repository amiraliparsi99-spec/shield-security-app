/**
 * Agency Shift Scheduler — remove a guard from an assigned shift slot.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { withRateLimit } from "@/lib/ratelimit/limiter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
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

    // Assign/unassign cycling would spam the guard's phone.
    const limited = await withRateLimit(request, "booking", user.id);
    if (!limited.success && limited.response) return limited.response;

    const { shift_id } = (await request.json()) as { shift_id?: string };
    if (!shift_id) {
      return NextResponse.json({ error: "shift_id is required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: agency } = await supabase
      .from("agencies")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!agency) {
      return NextResponse.json({ error: "Only agency accounts can unassign shifts." }, { status: 403 });
    }

    const { data: shift } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, status, role, agency_id, bookings(id, agency_id, event_name, self_managed)",
      )
      .eq("id", shift_id)
      .single();

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const booking = (shift as any).bookings;
    const ownsBooking = booking?.agency_id === agency.id;
    const providesShift = (shift as { agency_id?: string | null }).agency_id === agency.id;
    if (!booking || (!ownsBooking && !providesShift)) {
      return NextResponse.json({ error: "This shift does not belong to your agency." }, { status: 403 });
    }

    const previousPersonnelId = shift.personnel_id as string | null;
    if (!previousPersonnelId) {
      return NextResponse.json({ error: "This shift has no assigned guard." }, { status: 409 });
    }

    const { data: fullShift } = await supabase
      .from("shifts")
      .select("scheduled_start, scheduled_end, status")
      .eq("id", shift_id)
      .single();

    if (
      fullShift &&
      Date.now() >= new Date(fullShift.scheduled_start).getTime() &&
      new Date(fullShift.scheduled_end).getTime() > Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "This shift is already in progress. Use “Manage coverage” on the booking to cancel, close early, or find urgent cover.",
          code: "SHIFT_IN_PROGRESS",
          use_resolve: true,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    const { data: updatedShift, error: unassignErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: null,
        status: "pending",
        accepted_at: null,
        updated_at: now,
      })
      .eq("id", shift_id)
      .eq("personnel_id", previousPersonnelId)
      .select("id")
      .single();

    if (unassignErr || !updatedShift) {
      return NextResponse.json(
        { error: "Could not remove this guard from the shift." },
        { status: 500 },
      );
    }

    await supabase
      .from("shift_assignments")
      .update({ status: "cancelled", responded_at: now })
      .eq("shift_id", shift_id)
      .eq("personnel_id", previousPersonnelId);

    const { data: guard } = await supabase
      .from("personnel")
      .select("user_id, display_name")
      .eq("id", previousPersonnelId)
      .maybeSingle();

    if (guard?.user_id) {
      const title = "Removed from scheduled shift";
      const body = `${agency.name ?? "Your agency"} removed you from ${
        booking.event_name ?? "a shift"
      }.`;
      const data = {
        type: "shift_assignment_cancelled",
        shift_id,
        booking_id: shift.booking_id,
      };
      try {
        await sendPushNotification({
          userId: guard.user_id,
          type: "shift_reminder",
          title,
          body,
          data,
        });
      } catch {
        // best-effort
      }
      await supabase.from("notifications").insert({
        user_id: guard.user_id,
        type: "shift" as const,
        title,
        body,
        data,
        is_read: false,
      });
    }

    return NextResponse.json({ success: true, shift_id });
  } catch (error) {
    console.error("[unassign-shift] Error:", error);
    return NextResponse.json({ error: "Failed to unassign shift" }, { status: 500 });
  }
}
