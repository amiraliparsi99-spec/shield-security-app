import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

// Use service role for webhooks (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ========================================
      // PAYMENT EVENTS
      // ========================================
      
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment succeeded:", paymentIntent.id);

        // Update transaction status
        await supabaseAdmin
          .from("transactions")
          .update({
            status: "succeeded",
            stripe_charge_id: paymentIntent.latest_charge as string,
            payment_method_type: paymentIntent.payment_method_types?.[0],
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        // Add to payee's pending balance
        const payeeId = paymentIntent.metadata.payee_id;
        const netAmount = parseInt(paymentIntent.metadata.net_amount || "0");

        if (payeeId && netAmount > 0) {
          await supabaseAdmin.rpc("update_wallet_balance", {
            p_user_id: payeeId,
            p_available_change: 0,
            p_pending_change: netAmount,
          });
        }

        // Update booking status
        if (paymentIntent.metadata.booking_id) {
          await supabaseAdmin
            .from("bookings")
            .update({ payment_status: "paid" })
            .eq("id", paymentIntent.metadata.booking_id);
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", paymentIntent.id);

        await supabaseAdmin
          .from("transactions")
          .update({
            status: "failed",
            failure_reason: paymentIntent.last_payment_error?.message,
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        break;
      }

      // ========================================
      // TRANSFER EVENTS (Platform → Connected Account)
      // ========================================

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        console.log("Transfer created:", transfer.id);

        // Update transaction with transfer ID
        if (transfer.source_transaction) {
          await supabaseAdmin
            .from("transactions")
            .update({ stripe_transfer_id: transfer.id })
            .eq("stripe_charge_id", transfer.source_transaction);
        }

        break;
      }

      // ========================================
      // PAYOUT EVENTS (Connected Account → Bank)
      // ========================================

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        console.log("Payout paid:", payout.id);

        // Update payout request
        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("stripe_payout_id", payout.id);

        // Update transaction
        await supabaseAdmin
          .from("transactions")
          .update({ status: "succeeded" })
          .eq("stripe_payout_id", payout.id);

        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        console.log("Payout failed:", payout.id);

        // Get the payout request to refund the amount
        const { data: payoutRequest } = await supabaseAdmin
          .from("payout_requests")
          .select("user_id, amount")
          .eq("stripe_payout_id", payout.id)
          .single();

        // Update payout request
        await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "failed",
            failure_reason: payout.failure_message || "Payout failed",
          })
          .eq("stripe_payout_id", payout.id);

        // Update transaction
        await supabaseAdmin
          .from("transactions")
          .update({
            status: "failed",
            failure_reason: payout.failure_message,
          })
          .eq("stripe_payout_id", payout.id);

        // Refund to wallet
        if (payoutRequest) {
          await supabaseAdmin.rpc("update_wallet_balance", {
            p_user_id: payoutRequest.user_id,
            p_available_change: payoutRequest.amount,
            p_pending_change: 0,
          });
        }

        break;
      }

      // ========================================
      // BALANCE EVENTS (Funds become available)
      // ========================================

      case "balance.available": {
        // This is triggered on the connected account
        // We use this to move funds from pending to available
        const balance = event.data.object as Stripe.Balance;
        const connectedAccountId = event.account;

        if (connectedAccountId) {
          // Get user for this connected account
          const { data: stripeAccount } = await supabaseAdmin
            .from("stripe_accounts")
            .select("user_id")
            .eq("stripe_account_id", connectedAccountId)
            .single();

          if (stripeAccount) {
            // Calculate available balance from Stripe
            const availableBalance = balance.available.reduce(
              (sum, b) => sum + (b.currency === "gbp" ? b.amount : 0),
              0
            );
            const pendingBalance = balance.pending.reduce(
              (sum, b) => sum + (b.currency === "gbp" ? b.amount : 0),
              0
            );

            // Sync wallet with Stripe balance
            await supabaseAdmin
              .from("wallets")
              .update({
                available_balance: availableBalance,
                pending_balance: pendingBalance,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", stripeAccount.user_id);
          }
        }

        break;
      }

      // ========================================
      // ACCOUNT EVENTS (Connect onboarding)
      // ========================================

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        console.log("Account updated:", account.id);

        await supabaseAdmin
          .from("stripe_accounts")
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            onboarding_complete: account.charges_enabled && account.payouts_enabled,
            business_name: account.business_profile?.name || null,
          })
          .eq("stripe_account_id", account.id);

        break;
      }

      // ========================================
      // REFUND EVENTS
      // ========================================

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log("Charge refunded:", charge.id);

        // Find original transaction
        const { data: transaction } = await supabaseAdmin
          .from("transactions")
          .select("*")
          .eq("stripe_charge_id", charge.id)
          .single();

        if (transaction) {
          // Update original transaction
          await supabaseAdmin
            .from("transactions")
            .update({ status: "refunded" })
            .eq("id", transaction.id);

          // Create refund transaction
          await supabaseAdmin.from("transactions").insert({
            payer_id: transaction.payee_id, // Reverse: payee returns money
            payee_id: transaction.payer_id, // Reverse: payer receives refund
            booking_id: transaction.booking_id,
            gross_amount: charge.amount_refunded,
            platform_fee: 0,
            net_amount: charge.amount_refunded,
            type: "refund",
            status: "succeeded",
            description: "Refund",
          });

          // Deduct from payee wallet
          if (transaction.payee_id) {
            await supabaseAdmin.rpc("update_wallet_balance", {
              p_user_id: transaction.payee_id,
              p_available_change: -charge.amount_refunded,
              p_pending_change: 0,
            });
          }
        }

        break;
      }

      // ========================================
      // DISPUTE EVENTS
      // ========================================

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        console.log("Dispute created:", dispute.id);

        await supabaseAdmin
          .from("transactions")
          .update({ status: "disputed" })
          .eq("stripe_charge_id", dispute.charge);

        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
