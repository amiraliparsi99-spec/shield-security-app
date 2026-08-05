/**
 * Respond to an Agency Scheduled Shift assignment — Accept or Decline.
 *
 * Called from the mobile "My Scheduled Shifts" surface. This is the roster
 * counterpart to /api/shifts/respond-offer (which handles ephemeral open-market
 * offers).
 *
 *   accept  -> shift.status = 'accepted'; assignment = 'accepted'; notify agency.
 *   decline -> shift returns to the agency unassigned (personnel_id = null,
 *              status = 'pending'); assignment = 'declined'; notify agency.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { resolvePersonnelByAuthOrProvidedId } from "@/lib/auth/resolvePersonnel";
import { devDebug } from "@/lib/api/debugPayload";

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

    const { shift_id, assignment_id, response, decline_reason, personnel_id } =
      (await request.json()) as {
        shift_id?: string;
        assignment_id?: string;
        response?: "accepted" | "declined";
        decline_reason?: string;
        personnel_id?: string;
      };

    if (response !== "accepted" && response !== "declined") {
      return NextResponse.json(
        { error: 'response must be "accepted" or "declined"' },
        { status: 400 },
      );
    }
    if (!shift_id && !assignment_id) {
      return NextResponse.json(
        { error: "shift_id or assignment_id is required" },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const personnel = (await resolvePersonnelByAuthOrProvidedId(
      supabase as any,
      user.id,
      "id, display_name",
      personnel_id ?? null,
    )) as { id: string; display_name: string | null } | null;
    if (!personnel) {
      return NextResponse.json(
        { error: "Could not resolve your guard profile." },
        { status: 404 },
      );
    }

    // Load the assignment for this guard.
    let assignmentQuery = supabase
      .from("shift_assignments")
      .select("id, shift_id, personnel_id, agency_id, booking_id, status, event_name");
    assignmentQuery = assignment_id
      ? assignmentQuery.eq("id", assignment_id)
      : assignmentQuery.eq("shift_id", shift_id as string);

    const { data: assignment } = await assignmentQuery.maybeSingle();
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (assignment.personnel_id !== personnel.id) {
      return NextResponse.json(
        { error: "This assignment does not belong to you." },
        { status: 403 },
      );
    }

    if (response === "accepted" && assignment.status !== "pending") {
      return NextResponse.json(
        { error: `You have already ${assignment.status} this shift.` },
        { status: 409 },
      );
    }
    if (
      response === "declined" &&
      !["pending", "accepted"].includes(assignment.status)
    ) {
      return NextResponse.json(
        { error: `You have already ${assignment.status} this shift.` },
        { status: 409 },
      );
    }

    const targetShiftId = assignment.shift_id;
    const now = new Date().toISOString();

    // Resolve the agency owner for notifications.
    const { data: agency } = await supabase
      .from("agencies")
      .select("user_id, name")
      .eq("id", assignment.agency_id)
      .maybeSingle();
    const agencyOwnerId = (agency as any)?.user_id ?? null;
    const guardName = personnel.display_name ?? "A guard";
    const eventName = (assignment as any).event_name ?? "a shift";

    if (response === "accepted") {
      // Atomic: confirm only if this guard is still the assigned, pending holder.
      const { data: updatedShift, error: acceptErr } = await supabase
        .from("shifts")
        .update({ status: "accepted", accepted_at: now, updated_at: now })
        .eq("id", targetShiftId)
        .eq("personnel_id", personnel.id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (acceptErr || !updatedShift) {
        return NextResponse.json(
          { error: "This shift is no longer awaiting your response." },
          { status: 409 },
        );
      }

      await supabase
        .from("shift_assignments")
        .update({ status: "accepted", responded_at: now })
        .eq("id", assignment.id);

      if (agencyOwnerId) {
        const title = "Shift accepted";
        const body = `${guardName} accepted the shift for ${eventName}.`;
        const data = { type: "shift_assignment_accepted", shift_id: targetShiftId, booking_id: assignment.booking_id };
        try {
          await sendPushNotification({ userId: agencyOwnerId, type: "booking_confirmed", title, body, data });
        } catch {
          // best-effort
        }
        await supabase.from("notifications").insert({
          user_id: agencyOwnerId,
          type: "shift" as const,
          title,
          body,
          data,
          is_read: false,
        });
      }

      return NextResponse.json({ success: true, shift_id: targetShiftId, status: "accepted" });
    }

    // ── DECLINE ── shift returns to the agency unassigned.
    const { error: declineShiftErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: null,
        status: "pending",
        accepted_at: null,
        declined_at: now,
        decline_reason: decline_reason?.trim() || null,
        updated_at: now,
      })
      .eq("id", targetShiftId)
      .eq("personnel_id", personnel.id);

    if (declineShiftErr) {
      console.error("[respond-assignment] decline failed:", declineShiftErr.message);
      return NextResponse.json(
        { error: "Could not decline this shift.", debug: devDebug({ db_error: declineShiftErr.message }) },
        { status: 500 },
      );
    }

    await supabase
      .from("shift_assignments")
      .update({
        status: "declined",
        responded_at: now,
        decline_reason: decline_reason?.trim() || null,
      })
      .eq("id", assignment.id);

    if (agencyOwnerId) {
      const title = "Shift declined — needs reassigning";
      const body = `${guardName} declined the shift for ${eventName}. It's back in your scheduler to reassign.`;
      const data = { type: "shift_assignment_declined", shift_id: targetShiftId, booking_id: assignment.booking_id };
      try {
        await sendPushNotification({ userId: agencyOwnerId, type: "booking_cancelled", title, body, data });
      } catch {
        // best-effort
      }
      await supabase.from("notifications").insert({
        user_id: agencyOwnerId,
        type: "shift" as const,
        title,
        body,
        data,
        is_read: false,
      });
    }

    return NextResponse.json({ success: true, shift_id: targetShiftId, status: "declined" });
  } catch (error) {
    console.error("[respond-assignment] Error:", error);
    return NextResponse.json({ error: "Failed to process your response" }, { status: 500 });
  }
}
