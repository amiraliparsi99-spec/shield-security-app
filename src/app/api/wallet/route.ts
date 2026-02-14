import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// GET: Get wallet balance and recent transactions
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get wallet
    let { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Create wallet if doesn't exist
    if (!wallet) {
      const { data: newWallet, error } = await supabase
        .from("wallets")
        .insert({ user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      wallet = newWallet;
    }

    // Get recent transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select(`
        *,
        payer:profiles!transactions_payer_id_fkey(id, display_name),
        payee:profiles!transactions_payee_id_fkey(id, display_name)
      `)
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get pending payouts
    const { data: pendingPayouts } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false });

    // Get onboarding status
    const { data: stripeAccount } = await supabase
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      wallet,
      transactions: transactions || [],
      pending_payouts: pendingPayouts || [],
      onboarding_status: {
        has_stripe_account: !!stripeAccount,
        stripe_account_id: stripeAccount?.stripe_account_id,
        charges_enabled: stripeAccount?.charges_enabled || false,
        payouts_enabled: stripeAccount?.payouts_enabled || false,
        details_submitted: stripeAccount?.details_submitted || false,
        onboarding_complete: stripeAccount?.onboarding_complete || false,
      },
    });
  } catch (error: any) {
    console.error("Error getting wallet:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
