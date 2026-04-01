/**
 * Auto-Confirm Shifts Cron Job
 * 
 * Runs periodically to auto-confirm shifts that:
 * - Are completed (checked_out)
 * - Not yet confirmed by venue
 * - Not disputed
 * - More than 48 hours since checkout
 * 
 * This protects guards from venues who forget to confirm.
 * 
 * Recommended: Run every hour via Vercel Cron or similar
 * vercel.json: { "crons": [{ "path": "/api/cron/auto-confirm-shifts", "schedule": "0 * * * *" }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const cronSecret = process.env.CRON_SECRET;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" });

export async function GET(request: NextRequest) {
  // Verify cron secret (if configured)
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Call the database function to auto-confirm expired shifts
    const { data: count, error: dbError } = await supabase.rpc("auto_confirm_expired_shifts");
    
    if (dbError) {
      console.error("[AUTO-CONFIRM] DB error:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    console.log(`[AUTO-CONFIRM] Auto-confirmed ${count || 0} shifts`);

    // Now process payouts for all newly confirmed shifts
    const { data: pendingPayouts, error: payoutErr } = await supabase
      .from("escrow_transactions")
      .select(`
        id,
        shift_id,
        amount,
        shift_payments!inner (
          id,
          personnel_id,
          personnel:personnel_id (
            id,
            user_id,
            stripe_account_id
          )
        )
      `)
      .eq("transaction_type", "guard_payout")
      .eq("status", "pending")
      .limit(50); // Process in batches

    if (payoutErr) {
      console.error("[AUTO-CONFIRM] Payout query error:", payoutErr);
    }

    let payoutsProcessed = 0;
    let payoutsFailed = 0;

    for (const payout of pendingPayouts || []) {
      const payment = payout.shift_payments as any;
      const personnel = payment?.personnel as any;
      
      if (!personnel?.stripe_account_id || !payout.amount) {
        continue;
      }

      try {
        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: payout.amount,
          currency: "gbp",
          destination: personnel.stripe_account_id,
          metadata: {
            shift_id: payout.shift_id,
            escrow_transaction_id: payout.id,
            auto_confirmed: "true",
          },
        });

        // Update escrow transaction
        await supabase
          .from("escrow_transactions")
          .update({
            status: "completed",
            stripe_transfer_id: transfer.id,
            completed_at: new Date().toISOString(),
          })
          .eq("id", payout.id);

        // Update shift payment
        await supabase
          .from("shift_payments")
          .update({
            escrow_status: "released",
            stripe_transfer_id: transfer.id,
            payout_initiated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        // Notify guard
        if (personnel.user_id) {
          await supabase.from("notifications").insert({
            user_id: personnel.user_id,
            type: "payment",
            title: "💰 Payment Released!",
            body: `Your shift payment of £${(payout.amount / 100).toFixed(2)} has been auto-released.`,
            data: {
              shift_id: payout.shift_id,
              amount: payout.amount,
              auto_confirmed: true,
            },
          });
        }

        payoutsProcessed++;
      } catch (stripeErr: any) {
        console.error(`[AUTO-CONFIRM] Stripe error for ${payout.id}:`, stripeErr.message);
        payoutsFailed++;
      }
    }

    return NextResponse.json({
      success: true,
      shifts_auto_confirmed: count || 0,
      payouts_processed: payoutsProcessed,
      payouts_failed: payoutsFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[AUTO-CONFIRM] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
