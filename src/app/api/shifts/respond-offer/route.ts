/**
 * Respond to Shift Offer — Accept or Decline
 *
 * Called when a guard taps Accept or Decline on the Uber-style popup.
 * Race-condition safe: uses atomic UPDATE with status check.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // --- Authenticate ---
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

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

    // --- Parse body ---
    const body = await request.json();
    const { shift_offer_id, response } = body as {
      shift_offer_id?: string;
      response?: "accepted" | "declined";
    };

    if (!shift_offer_id || typeof shift_offer_id !== "string") {
      return NextResponse.json({ error: "shift_offer_id is required" }, { status: 400 });
    }
    if (response !== "accepted" && response !== "declined") {
      return NextResponse.json(
        { error: 'response must be "accepted" or "declined"' },
        { status: 400 }
      );
    }

    // Use service role for atomic operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Load the offer ---
    const { data: offer, error: offerErr } = await supabase
      .from("shift_offers")
      .select("*, shifts(id, booking_id, personnel_id, hourly_rate, scheduled_start, scheduled_end, status, role, bookings(id, event_name, venue_id, venues(id, name, user_id)))")
      .eq("id", shift_offer_id)
      .single();

    if (offerErr || !offer) {
      return NextResponse.json({ error: "Shift offer not found" }, { status: 404 });
    }

    // Verify this offer belongs to the requesting user
    const { data: personnel } = await supabase
      .from("personnel")
      .select("id, display_name")
      .eq("user_id", user.id)
      .single();

    if (!personnel || personnel.id !== offer.personnel_id) {
      return NextResponse.json({ error: "This offer does not belong to you" }, { status: 403 });
    }

    // Check offer hasn't expired or already been responded to
    if (offer.status !== "pending") {
      return NextResponse.json(
        { error: `This offer has already been ${offer.status}.` },
        { status: 409 }
      );
    }

    const now = new Date();
    if (new Date(offer.expires_at) < now) {
      // Mark as expired
      await supabase
        .from("shift_offers")
        .update({ status: "expired", responded_at: now.toISOString() })
        .eq("id", shift_offer_id);

      return NextResponse.json(
        { error: "This offer has expired." },
        { status: 410 }
      );
    }

    // --- Handle DECLINE ---
    if (response === "declined") {
      await supabase
        .from("shift_offers")
        .update({ status: "declined", responded_at: now.toISOString() })
        .eq("id", shift_offer_id);

      return NextResponse.json({
        success: true,
        message: "Offer declined.",
        shift_offer_id,
      });
    }

    // --- Handle ACCEPT ---
    const shift = (offer as any).shifts;
    if (!shift) {
      return NextResponse.json({ error: "Associated shift not found" }, { status: 404 });
    }

    // Atomic: claim the shift only if it's still unassigned (or pending)
    // This handles the race condition where two guards accept at the same time
    const { data: updatedShift, error: claimErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: personnel.id,
        status: "accepted",
        accepted_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", shift.id)
      .eq("status", "pending")
      .is("personnel_id", null)
      .select("id")
      .single();

    if (claimErr || !updatedShift) {
      // Another guard beat them — mark this offer as expired
      await supabase
        .from("shift_offers")
        .update({ status: "expired", responded_at: now.toISOString() })
        .eq("id", shift_offer_id);

      return NextResponse.json(
        { error: "This shift has already been claimed by another guard." },
        { status: 409 }
      );
    }

    // Mark this offer as accepted
    await supabase
      .from("shift_offers")
      .update({ status: "accepted", responded_at: now.toISOString() })
      .eq("id", shift_offer_id);

    // Expire all other pending offers for this shift
    await supabase
      .from("shift_offers")
      .update({ status: "expired", responded_at: now.toISOString() })
      .eq("shift_id", shift.id)
      .eq("status", "pending")
      .neq("id", shift_offer_id);

    // --- Notify the venue owner ---
    const venue = shift.bookings?.venues;
    const venueOwnerId = venue?.owner_id ?? venue?.user_id;
    const venueName = venue?.name ?? offer.venue_name ?? "the venue";
    const guardName = personnel.display_name ?? "A guard";

    if (venueOwnerId) {
      try {
        await sendPushNotification({
          userId: venueOwnerId,
          type: "booking_confirmed",
          title: "✅ Shift Claimed!",
          body: `${guardName} accepted the shift at ${venueName}.`,
          data: {
            type: "shift_claimed",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            guard_name: guardName,
          },
        });
      } catch {
        // Non-blocking
      }

      await supabase.from("notifications").insert({
        user_id: venueOwnerId,
        type: "shift" as const,
        title: "✅ Shift Claimed!",
        body: `${guardName} accepted the shift at ${venueName}.`,
        data: {
          type: "shift_claimed",
          shift_id: shift.id,
          booking_id: shift.booking_id,
          guard_name: guardName,
        },
        is_read: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: `You've been assigned to ${venueName}!`,
      shift_offer_id,
      shift_id: shift.id,
      guard_name: guardName,
    });
  } catch (error) {
    console.error("[RESPOND-OFFER] Error:", error);
    return NextResponse.json(
      { error: "Failed to process offer response" },
      { status: 500 }
    );
  }
}
