/**
 * Agency Shift Scheduler — assign a roster guard to a shift slot.
 *
 * The agency picks one of its own `agency_staff` guards for an unassigned shift.
 * Because the agency is rostering its OWN employee, assigning places the guard
 * directly: we set the shift to `personnel_id` + status `accepted` (= Confirmed),
 * record an `accepted` `shift_assignments` row, and notify the guard. The guard
 * can still opt out ("Can't make it") from mobile, which returns the slot to the
 * agency for reassignment.
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

    // Every assignment pushes a notification to the guard's phone.
    const limited = await withRateLimit(request, "booking", user.id);
    if (!limited.success && limited.response) return limited.response;

    const { shift_id, personnel_id } = (await request.json()) as {
      shift_id?: string;
      personnel_id?: string;
    };
    if (!shift_id || !personnel_id) {
      return NextResponse.json(
        { error: "shift_id and personnel_id are required" },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve the caller's agency.
    const { data: agency } = await supabase
      .from("agencies")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!agency) {
      return NextResponse.json(
        { error: "Only agency accounts can assign shifts." },
        { status: 403 },
      );
    }

    // The guard must be on this agency's active roster.
    const { data: rosterRow } = await supabase
      .from("agency_staff")
      .select("id, personnel:personnel_id(id, user_id, display_name)")
      .eq("agency_id", agency.id)
      .eq("personnel_id", personnel_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!rosterRow) {
      return NextResponse.json(
        { error: "That guard is not on your active roster." },
        { status: 403 },
      );
    }
    const guard = (Array.isArray((rosterRow as any).personnel)
      ? (rosterRow as any).personnel[0]
      : (rosterRow as any).personnel) as {
      id: string;
      user_id: string | null;
      display_name: string | null;
    } | null;

    if (!guard?.user_id) {
      return NextResponse.json(
        {
          error:
            "That guard does not have a linked mobile app account yet. They must sign up on the app and join your roster before you can schedule them.",
        },
        { status: 409 },
      );
    }

    // Load the shift + booking, and verify the booking belongs to this agency.
    const { data: shift } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, status, role, hourly_rate, scheduled_start, scheduled_end, bookings(id, agency_id, event_name, site_label, site_address_text)",
      )
      .eq("id", shift_id)
      .single();
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    const booking = (shift as any).bookings;
    if (!booking || booking.agency_id !== agency.id) {
      return NextResponse.json(
        { error: "This shift does not belong to your agency." },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();

    // Atomically claim the slot only if still unassigned. The agency is placing
    // its own roster guard, so the shift is Confirmed immediately (opt-out model).
    const { data: updatedShift, error: assignErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: personnel_id,
        agency_id: agency.id,
        status: "accepted",
        accepted_at: now,
        declined_at: null,
        updated_at: now,
      })
      .eq("id", shift_id)
      .is("personnel_id", null)
      .select("id")
      .single();

    if (assignErr) {
      console.error("[assign-shift] update failed:", assignErr.message);
      return NextResponse.json(
        { error: "Could not assign this shift.", debug: { db_error: assignErr.message } },
        { status: 500 },
      );
    }
    if (!updatedShift) {
      return NextResponse.json(
        { error: "This slot is already assigned. Refresh and try another." },
        { status: 409 },
      );
    }

    const locationText: string | null =
      booking.site_label || booking.site_address_text || null;

    // Record the assignment lifecycle row (denormalized for the mobile list).
    const { data: assignment, error: assignmentErr } = await supabase
      .from("shift_assignments")
      .upsert(
        {
          shift_id: shift_id,
          personnel_id: personnel_id,
          agency_id: agency.id,
          booking_id: shift.booking_id,
          status: "accepted",
          event_name: booking.event_name ?? null,
          role: (shift as any).role ?? null,
          hourly_rate: (shift as any).hourly_rate ?? null,
          scheduled_start: (shift as any).scheduled_start ?? null,
          scheduled_end: (shift as any).scheduled_end ?? null,
          location_text: locationText,
          agency_name: agency.name ?? null,
          assigned_by: user.id,
          assigned_at: now,
          responded_at: now,
          decline_reason: null,
        },
        { onConflict: "shift_id,personnel_id" },
      )
      .select("id")
      .single();

    if (assignmentErr || !assignment) {
      console.error("[assign-shift] assignment upsert failed:", assignmentErr?.message);
      await supabase
        .from("shifts")
        .update({
          personnel_id: null,
          status: "pending",
          accepted_at: null,
          updated_at: now,
        })
        .eq("id", shift_id);
      return NextResponse.json(
        {
          error:
            "Could not record this assignment for the guard's app. Try again — if it keeps failing, contact support.",
          debug: { db_error: assignmentErr?.message },
        },
        { status: 500 },
      );
    }

    // Notify the guard.
    if (guard.user_id) {
      const title = "You've been scheduled for a shift";
      const body = `${agency.name ?? "Your agency"} placed you on ${
        booking.event_name ?? "a shift"
      }. Tap to view — let them know if you can't make it.`;
      const data = {
        type: "shift_assignment",
        shift_id,
        booking_id: shift.booking_id,
        assignment_id: assignment?.id ?? null,
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
        // Push is best-effort.
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

    return NextResponse.json({
      success: true,
      shift_id,
      assignment_id: assignment?.id ?? null,
    });
  } catch (error) {
    console.error("[assign-shift] Error:", error);
    return NextResponse.json({ error: "Failed to assign shift" }, { status: 500 });
  }
}
