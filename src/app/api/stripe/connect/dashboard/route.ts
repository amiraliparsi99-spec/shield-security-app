import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";

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

// GET: Get Stripe Express Dashboard login link
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Stripe account
    const { data: stripeAccount } = await supabase
      .from("stripe_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (!stripeAccount) {
      return NextResponse.json(
        { error: "No connected account found" },
        { status: 404 }
      );
    }

    // Create login link to Stripe Express Dashboard
    const stripe = await getStripe();
    const loginLink = await stripe.accounts.createLoginLink(
      stripeAccount.stripe_account_id
    );

    return NextResponse.json({ url: loginLink.url });
  } catch (error: any) {
    console.error("Error creating dashboard link:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
