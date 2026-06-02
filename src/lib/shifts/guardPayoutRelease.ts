/**
 * Shared logic: Stripe Connect transfer to guard after shift confirmation,
 * plus DB updates and wallet pending → available.
 */

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPersonnelStripeConnectAccountId(
  supabase: SupabaseClient,
  personnelAuthUserId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("stripe_accounts")
    .select("stripe_account_id")
    .eq("user_id", personnelAuthUserId)
    .eq("account_type", "personnel")
    .maybeSingle();

  return data?.stripe_account_id ?? null;
}

export type GuardPayoutTransferParams = {
  supabase: SupabaseClient;
  stripe: Stripe;
  shiftId: string;
  bookingId: string;
  personnelAuthUserId: string;
  /** When set, only this escrow row is marked completed (avoids ambiguous updates). */
  escrowTransactionId?: string | null;
  payment: {
    id: string;
    personnel_net: number;
  };
};

export type GuardPayoutTransferResult =
  | { ok: true; transferId: string }
  | { ok: false; error: string; skipped?: boolean };

/**
 * Executes Stripe transfer from platform balance to the guard's connected account,
 * updates shift_payments + escrow_transactions, and moves wallet pending → available.
 */
export async function executeGuardPayoutTransfer(
  params: GuardPayoutTransferParams,
): Promise<GuardPayoutTransferResult> {
  const {
    supabase,
    stripe,
    shiftId,
    bookingId,
    personnelAuthUserId,
    escrowTransactionId,
    payment,
  } = params;

  if (!payment.personnel_net || payment.personnel_net <= 0) {
    return { ok: false, error: "No payout amount", skipped: true };
  }

  const destination = await getPersonnelStripeConnectAccountId(
    supabase,
    personnelAuthUserId,
  );

  if (!destination) {
    console.warn(
      "[guardPayoutRelease] No Stripe Connect account for user",
      personnelAuthUserId,
    );
    return {
      ok: false,
      error: "Guard has not completed Stripe Connect onboarding",
      skipped: true,
    };
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: payment.personnel_net,
      currency: "gbp",
      destination,
      transfer_group: `booking_${bookingId}`,
      metadata: {
        shift_id: shiftId,
        booking_id: bookingId,
        shift_payment_id: payment.id,
      },
    });

    await supabase
      .from("shift_payments")
      .update({
        escrow_status: "released",
        stripe_transfer_id: transfer.id,
        payout_initiated_at: new Date().toISOString(),
        status: "succeeded",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    const escrowUpdate = {
      status: "completed" as const,
      stripe_transfer_id: transfer.id,
      completed_at: new Date().toISOString(),
    };
    if (escrowTransactionId) {
      await supabase
        .from("escrow_transactions")
        .update(escrowUpdate)
        .eq("id", escrowTransactionId);
    } else {
      await supabase
        .from("escrow_transactions")
        .update(escrowUpdate)
        .eq("shift_id", shiftId)
        .eq("transaction_type", "guard_payout")
        .eq("status", "pending");
    }

    const { error: walletErr } = await supabase.rpc("transfer_pending_to_available", {
      p_user_id: personnelAuthUserId,
      p_amount: payment.personnel_net,
    });

    if (walletErr) {
      console.error(
        "[guardPayoutRelease] transfer_pending_to_available failed:",
        walletErr,
      );
    }

    return { ok: true, transferId: transfer.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[guardPayoutRelease] Stripe transfer error:", message);
    return { ok: false, error: message };
  }
}
