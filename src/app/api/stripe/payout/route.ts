import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getStripe, PLATFORM_CONFIG, calculateInstantPayoutFee } from "@/lib/stripe";
import type { PayoutMethod } from "@/types/payments";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
}

// POST: Request a payout
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, method }: { amount: number; method: PayoutMethod } = body;

    if (!amount || !method) {
      return NextResponse.json(
        { error: "Missing required fields: amount, method" },
        { status: 400 }
      );
    }

    // Validate method
    if (!["instant", "standard"].includes(method)) {
      return NextResponse.json(
        { error: "Invalid payout method. Use 'instant' or 'standard'" },
        { status: 400 }
      );
    }

    // Check minimum amount
    if (amount < PLATFORM_CONFIG.minimumPayoutAmount) {
      return NextResponse.json(
        { error: `Minimum payout amount is £${PLATFORM_CONFIG.minimumPayoutAmount / 100}` },
        { status: 400 }
      );
    }

    // Get user's wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("available_balance")
      .eq("user_id", user.id)
      .single();

    if (!wallet || wallet.available_balance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Get user's Stripe account
    const { data: stripeAccount } = await supabase
      .from("stripe_accounts")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", user.id)
      .single();

    if (!stripeAccount || !stripeAccount.payouts_enabled) {
      return NextResponse.json(
        { error: "Payouts not enabled. Please complete account setup." },
        { status: 400 }
      );
    }

    // Calculate fee for instant payouts
    let fee = 0;
    let netAmount = amount;

    if (method === "instant") {
      const feeCalc = calculateInstantPayoutFee(amount);
      fee = feeCalc.fee;
      netAmount = feeCalc.netAmount;
    }

    // Create payout request record first
    const { data: payoutRequest, error: insertError } = await supabase
      .from("payout_requests")
      .insert({
        user_id: user.id,
        amount,
        fee,
        net_amount: netAmount,
        payout_method: method,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    try {
      // Create payout in Stripe
      const stripe = await getStripe();
      const payout = await stripe.payouts.create(
        {
          amount: netAmount,
          currency: PLATFORM_CONFIG.currency,
          method: method === "instant" ? "instant" : "standard",
          metadata: {
            user_id: user.id,
            payout_request_id: payoutRequest.id,
          },
        },
        {
          stripeAccount: stripeAccount.stripe_account_id,
        }
      );

      // Deduct from wallet
      const { error: walletError } = await supabase.rpc("process_payout", {
        p_user_id: user.id,
        p_amount: amount,
      });

      if (walletError) throw walletError;

      // Update payout request with Stripe info
      await supabase
        .from("payout_requests")
        .update({
          stripe_payout_id: payout.id,
          status: "processing",
          estimated_arrival: payout.arrival_date
            ? new Date(payout.arrival_date * 1000).toISOString()
            : null,
        })
        .eq("id", payoutRequest.id);

      // Create transaction record
      await supabase.from("transactions").insert({
        stripe_payout_id: payout.id,
        payee_id: user.id,
        gross_amount: amount,
        platform_fee: fee,
        net_amount: netAmount,
        type: "payout",
        status: "processing",
        description: `${method === "instant" ? "Instant" : "Standard"} payout`,
      });

      return NextResponse.json({
        payout_id: payoutRequest.id,
        stripe_payout_id: payout.id,
        amount,
        fee,
        net_amount: netAmount,
        method,
        status: "processing",
        estimated_arrival: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString()
          : null,
      });
    } catch (stripeError: any) {
      // If Stripe fails, update request as failed
      await supabase
        .from("payout_requests")
        .update({
          status: "failed",
          failure_reason: stripeError.message,
        })
        .eq("id", payoutRequest.id);

      throw stripeError;
    }
  } catch (error: any) {
    console.error("Error creating payout:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Get payout history
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data: payouts, error } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ payouts });
  } catch (error: any) {
    console.error("Error getting payouts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
