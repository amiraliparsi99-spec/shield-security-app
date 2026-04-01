/**
 * Cancel Shift API
 * Allows both venues and security guards to cancel a shift
 * 
 * POST /api/shifts/cancel
 * Body: { shift_id: string, reason: string, cancelled_by: 'venue' | 'guard' }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    // Get the shift with related booking and venue info
    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select(`
        id,
        booking_id,
        personnel_id,
        status,
        scheduled_start,
        scheduled_end,
        hourly_rate,
        booking:bookings (
          id,
          venue_id,
          event_name,
          venues (
            id,
            name,
            user_id
          )
        ),
        personnel (
          id,
          user_id,
          display_name
        )
      `)
      .eq("id", shift_id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Check if shift can be cancelled
    const cancellableStatuses = ["pending", "accepted"];
    if (!cancellableStatuses.includes(shift.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a shift with status '${shift.status}'. Only pending or accepted shifts can be cancelled.` },
        { status: 400 }
      );
    }

    // Verify the user has permission to cancel
    const booking = shift.booking as any;
    const personnel = shift.personnel as any;
    const venue = booking?.venues;

    if (cancelled_by === "venue") {
      // Venue must own the booking
      if (venue?.user_id !== user.id) {
        return NextResponse.json(
          { error: "You don't have permission to cancel this shift as a venue" },
          { status: 403 }
        );
      }
    } else if (cancelled_by === "guard") {
      // Guard must be assigned to the shift
      if (personnel?.user_id !== user.id) {
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

    // Update the shift status
    const { error: updateError } = await supabase
      .from("shifts")
      .update({
        status: "cancelled",
        cancelled_at: now.toISOString(),
        cancelled_by: cancelled_by,
        cancellation_reason: reason.trim(),
        cancellation_penalty: penaltyApplied,
      })
      .eq("id", shift_id);

    if (updateError) {
      console.error("Error updating shift:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel shift" },
        { status: 500 }
      );
    }

    // Send notification to the other party
    const notificationRecipient = cancelled_by === "venue" 
      ? personnel?.user_id 
      : venue?.user_id;

    if (notificationRecipient) {
      const notificationTitle = cancelled_by === "venue"
        ? "Shift Cancelled by Venue"
        : "Shift Cancelled by Guard";
      
      const notificationBody = cancelled_by === "venue"
        ? `Your shift at ${venue?.name || "the venue"} has been cancelled. Reason: ${reason}`
        : `${personnel?.display_name || "A guard"} has cancelled their shift. Reason: ${reason}`;

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

    // If guard cancelled, we might want to notify other available guards
    if (cancelled_by === "guard" && hoursUntilShift > 0 && hoursUntilShift < 72) {
      // Could trigger the notify-guards API to find a replacement
      console.log("Guard cancelled shift - consider notifying replacement guards");
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
