/**
 * Dispute Shift API
 * 
 * Called by venue to dispute a completed shift.
 * Holds funds in escrow pending review.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await admin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  try {
    const sb = await createServerClient();
    const { data: { session } } = await sb.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { shift_id, reason } = body;
    const raised_by = userId;

    if (!shift_id) {
      return NextResponse.json(
        { error: "shift_id is required" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a detailed reason for the dispute (min 10 characters)" },
        { status: 400 }
      );
    }

    // Get shift details
    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select(`
        *,
        booking:bookings (
          id,
          event_name,
          venue_id,
          venues (id, name)
        ),
        personnel:personnel_id (
          id,
          user_id,
          display_name
        )
      `)
      .eq("id", shift_id)
      .single();

    if (shiftErr || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Validate shift can be disputed
    if (shift.status !== "checked_out") {
      return NextResponse.json(
        { error: "Can only dispute completed shifts" },
        { status: 400 }
      );
    }

    if (shift.venue_confirmed) {
      return NextResponse.json(
        { error: "Cannot dispute an already confirmed shift" },
        { status: 400 }
      );
    }

    if (shift.dispute_status === "raised" || shift.dispute_status === "under_review") {
      return NextResponse.json(
        { error: "This shift already has an active dispute" },
        { status: 400 }
      );
    }

    // Call the database function
    const { data: result, error: disputeErr } = await supabase.rpc(
      "raise_shift_dispute",
      { 
        p_shift_id: shift_id, 
        p_reason: reason.trim(),
        p_raised_by: raised_by 
      }
    );

    if (disputeErr) {
      console.error("[DISPUTE-SHIFT] DB error:", disputeErr);
      return NextResponse.json(
        { error: "Failed to raise dispute" },
        { status: 500 }
      );
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Failed to raise dispute" },
        { status: 400 }
      );
    }

    // Notify the guard about the dispute
    const personnel = shift.personnel as any;
    if (personnel?.user_id) {
      const booking = shift.booking as any;
      await supabase.from("notifications").insert({
        user_id: personnel.user_id,
        type: "alert",
        title: "⚠️ Shift Disputed",
        body: `${booking?.venues?.name || "A venue"} has raised a concern about your shift for "${booking?.event_name}". Our team will review and contact you if needed.`,
        data: {
          shift_id,
          booking_id: shift.booking_id,
          dispute_reason: reason,
        },
      });
    }

    return NextResponse.json({
      success: true,
      shift_id,
      dispute_status: "raised",
      message: "Dispute raised successfully. Our team will review within 24-48 hours.",
    });
  } catch (error: any) {
    console.error("[DISPUTE-SHIFT] Error:", error);
    return NextResponse.json(
      { error: "Failed to raise dispute" },
      { status: 500 }
    );
  }
}
