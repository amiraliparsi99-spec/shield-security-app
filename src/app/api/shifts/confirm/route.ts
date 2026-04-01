/**
 * Confirm Shift & Release Payment API
 * 
 * Called by venue to confirm a completed shift.
 * This triggers the payout to the guard from escrow.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";

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
    const { shift_id } = body;
    const confirmed_by = userId;

    if (!shift_id) {
      return NextResponse.json(
        { error: "shift_id is required" },
        { status: 400 }
      );
    }

    // Get shift with payment details
    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select(`
        *,
        booking:bookings (
          id,
          venue_id,
          venues (id, name, user_id)
        ),
        personnel:personnel_id (
          id,
          user_id,
          display_name,
          stripe_account_id
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

    // Validate shift can be confirmed
    if (shift.status !== "checked_out") {
      return NextResponse.json(
        { error: "Shift must be completed (checked out) before confirmation" },
        { status: 400 }
      );
    }

    if (shift.venue_confirmed) {
      return NextResponse.json(
        { error: "Shift already confirmed" },
        { status: 400 }
      );
    }

    // Call the database function to confirm
    const { data: result, error: confirmErr } = await supabase.rpc(
      "confirm_shift_payment",
      { p_shift_id: shift_id, p_confirmed_by: confirmed_by }
    );

    if (confirmErr) {
      console.error("[CONFIRM-SHIFT] DB error:", confirmErr);
      return NextResponse.json(
        { error: "Failed to confirm shift" },
        { status: 500 }
      );
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Confirmation failed" },
        { status: 400 }
      );
    }

    // Get the shift payment record
    const { data: payment } = await supabase
      .from("shift_payments")
      .select("*")
      .eq("shift_id", shift_id)
      .single();

    // Trigger Stripe payout if guard has connected account
    const personnel = shift.personnel as any;
    if (personnel?.stripe_account_id && payment?.personnel_net) {
      try {
        // Create transfer to guard's connected account
        const transfer = await stripe.transfers.create({
          amount: payment.personnel_net, // Amount in pence
          currency: "gbp",
          destination: personnel.stripe_account_id,
          transfer_group: `booking_${shift.booking_id}`,
          metadata: {
            shift_id: shift_id,
            booking_id: shift.booking_id,
            personnel_id: personnel.id,
          },
        });

        // Update payment record with transfer ID
        await supabase
          .from("shift_payments")
          .update({
            escrow_status: "released",
            stripe_transfer_id: transfer.id,
            payout_initiated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        // Update escrow transaction
        await supabase
          .from("escrow_transactions")
          .update({
            status: "completed",
            stripe_transfer_id: transfer.id,
            completed_at: new Date().toISOString(),
          })
          .eq("shift_id", shift_id)
          .eq("transaction_type", "guard_payout");

        console.log(`[CONFIRM-SHIFT] Payout initiated: ${transfer.id} for £${(payment.personnel_net / 100).toFixed(2)}`);
      } catch (stripeErr: any) {
        console.error("[CONFIRM-SHIFT] Stripe transfer error:", stripeErr.message);
        // Don't fail the confirmation - payout can be retried
      }
    }

    // Notify guard
    if (personnel?.user_id) {
      const payAmount = payment?.personnel_net 
        ? `£${(payment.personnel_net / 100).toFixed(2)}`
        : "your earnings";

      await supabase.from("notifications").insert({
        user_id: personnel.user_id,
        type: "payment",
        title: "💰 Payment Confirmed!",
        body: `Your shift has been confirmed. ${payAmount} is on its way to your account.`,
        data: {
          shift_id,
          booking_id: shift.booking_id,
          amount: payment?.personnel_net,
        },
      });
    }

    return NextResponse.json({
      success: true,
      shift_id,
      confirmed_at: result.confirmed_at,
      payment_amount: result.payment_amount,
      message: "Shift confirmed and payment released",
    });
  } catch (error: any) {
    console.error("[CONFIRM-SHIFT] Error:", error);
    return NextResponse.json(
      { error: "Failed to confirm shift" },
      { status: 500 }
    );
  }
}
