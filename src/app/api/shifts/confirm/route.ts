/**
 * Confirm Shift & Release Payment API
 *
 * Called by venue to confirm a completed shift.
 * Updates shift + shift_payments (no RPC), inserts escrow row, then Stripe transfer to Connect account.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { executeGuardPayoutTransfer } from "@/lib/shifts/guardPayoutRelease";
import { applyCleanShiftConfirmationReward } from "@/lib/shifts/shieldScoreEvents";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" });

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
    const {
      data: { session },
    } = await sb.auth.getSession();
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
    const { shift_id } = body;

    if (!shift_id) {
      return NextResponse.json({ error: "shift_id is required" }, { status: 400 });
    }

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", shift_id)
      .single();

    if (shiftErr || !shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, venue_id, stripe_payment_intent_id")
      .eq("id", shift.booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { data: venue, error: venueErr } = await supabase
      .from("venues")
      .select("id, user_id, name")
      .eq("id", booking.venue_id)
      .single();

    if (venueErr || !venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    if (venue.user_id !== userId) {
      return NextResponse.json(
        { error: "Only the venue owner can confirm this shift" },
        { status: 403 },
      );
    }

    if (shift.status !== "checked_out") {
      return NextResponse.json(
        { error: "Shift must be completed (checked out) before confirmation" },
        { status: 400 },
      );
    }

    if (shift.venue_confirmed) {
      return NextResponse.json({ error: "Shift already confirmed" }, { status: 400 });
    }

    const dispute = shift.dispute_status;
    if (dispute && dispute !== "none") {
      return NextResponse.json(
        { error: "Cannot confirm while this shift is in dispute" },
        { status: 400 },
      );
    }

    const confirmedAt = new Date().toISOString();

    const { error: shiftUpdateErr } = await supabase
      .from("shifts")
      .update({
        venue_confirmed: true,
        venue_confirmed_at: confirmedAt,
        updated_at: confirmedAt,
      })
      .eq("id", shift_id);

    if (shiftUpdateErr) {
      console.error("[CONFIRM-SHIFT] shift update:", shiftUpdateErr);
      return NextResponse.json(
        { error: "Failed to update shift" },
        { status: 500 },
      );
    }

    const { data: payment } = await supabase
      .from("shift_payments")
      .select("*")
      .eq("shift_id", shift_id)
      .maybeSingle();

    let escrowTxId: string | null = null;
    if (payment?.id) {
      await supabase
        .from("shift_payments")
        .update({
          escrow_status: "confirmed",
          venue_confirmed_at: confirmedAt,
          updated_at: confirmedAt,
        })
        .eq("id", payment.id);

      const { data: escrowIns } = await supabase
        .from("escrow_transactions")
        .insert({
          booking_id: shift.booking_id,
          shift_id,
          shift_payment_id: payment.id,
          transaction_type: "guard_payout",
          amount: payment.personnel_net ?? 0,
          currency: "gbp",
          from_account: "escrow",
          to_account: "guard",
          stripe_payment_intent_id: booking.stripe_payment_intent_id ?? null,
          status: "pending",
          notes: "Venue confirmed shift completion",
        })
        .select("id")
        .single();
      escrowTxId = escrowIns?.id ?? null;
    }

    const { data: personnel } = await supabase
      .from("personnel")
      .select("id, user_id, display_name")
      .eq("id", shift.personnel_id as string)
      .maybeSingle();

    let transferResult = await (async () => {
      if (!payment?.id || !personnel?.user_id) {
        return {
          ok: false as const,
          error: "No payment record or personnel",
          skipped: true as const,
        };
      }
      const tr = await executeGuardPayoutTransfer({
        supabase,
        stripe,
        shiftId: shift_id,
        bookingId: shift.booking_id,
        escrowTransactionId: escrowTxId,
        personnelAuthUserId: personnel.user_id,
        payment: {
          id: payment.id,
          personnel_net: payment.personnel_net ?? 0,
        },
      });
      if (!tr.ok && !tr.skipped) {
        console.error("[CONFIRM-SHIFT] Transfer failed:", tr.error);
      }
      return tr;
    })();

    if (personnel?.user_id) {
      const payAmount = payment?.personnel_net
        ? `£${(payment.personnel_net / 100).toFixed(2)}`
        : "your earnings";

      const bodyText = transferResult.ok
        ? `Your shift has been confirmed. ${payAmount} is on its way to your Stripe account.`
        : payment?.personnel_net
          ? `Your shift has been confirmed. ${payAmount} will be released once your payout account is ready.`
          : "Your shift has been confirmed.";

      await supabase.from("notifications").insert({
        user_id: personnel.user_id,
        type: "payment",
        title: "💰 Payment Confirmed!",
        body: bodyText,
        data: {
          shift_id,
          booking_id: shift.booking_id,
          amount: payment?.personnel_net,
          transfer_ok: transferResult.ok,
        },
      });
    }

    if (shift.personnel_id) {
      await applyCleanShiftConfirmationReward({
        supabase: supabase as any,
        shiftId: shift_id,
        personnelId: shift.personnel_id,
      });
    }

    return NextResponse.json({
      success: true,
      shift_id,
      confirmed_at: confirmedAt,
      payment_amount: payment?.personnel_net ?? 0,
      transfer: transferResult.ok ? { id: transferResult.transferId } : null,
      transfer_error: !transferResult.ok ? transferResult.error : null,
      message: "Shift confirmed",
    });
  } catch (error: unknown) {
    console.error("[CONFIRM-SHIFT] Error:", error);
    return NextResponse.json(
      { error: "Failed to confirm shift" },
      { status: 500 },
    );
  }
}
