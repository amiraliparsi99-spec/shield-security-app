import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getStripe, PLATFORM_CONFIG, calculatePaymentFees } from "@/lib/stripe";

// Admin client to bypass RLS for transaction inserts
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get user from either cookie or Bearer token (for mobile)
async function getAuthenticatedUser(request: NextRequest) {
  // First, check for Bearer token (mobile app)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) {
      return user;
    }
  }

  // Fall back to cookie-based auth (web app)
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST: Create payment intent for a booking
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, amount, payee_id, description } = body;

    if (!booking_id || !amount || !payee_id) {
      return NextResponse.json(
        { error: "Missing required fields: booking_id, amount, payee_id" },
        { status: 400 }
      );
    }

    // Get payee's Stripe account (using admin to bypass RLS)
    const { data: payeeStripeAccount } = await supabaseAdmin
      .from("stripe_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("user_id", payee_id)
      .single();

    if (!payeeStripeAccount || !payeeStripeAccount.charges_enabled) {
      return NextResponse.json(
        { error: "Payee has not completed payment setup" },
        { status: 400 }
      );
    }

    // Calculate fees
    const fees = calculatePaymentFees(amount);

    // Create Payment Intent with automatic transfer to connected account
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fees.grossAmount,
      currency: PLATFORM_CONFIG.currency,
      automatic_payment_methods: {
        enabled: true,
      },
      application_fee_amount: fees.platformFee,
      transfer_data: {
        destination: payeeStripeAccount.stripe_account_id,
      },
      metadata: {
        booking_id,
        payer_id: user.id,
        payee_id,
        platform_fee: fees.platformFee.toString(),
        net_amount: fees.netAmount.toString(),
      },
      description: description || `Payment for booking ${booking_id}`,
    });

    // Create pending transaction record (using admin to bypass RLS)
    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      stripe_payment_intent_id: paymentIntent.id,
      payer_id: user.id,
      payee_id,
      booking_id,
      gross_amount: fees.grossAmount,
      platform_fee: fees.platformFee,
      net_amount: fees.netAmount,
      type: "payment",
      status: "pending",
      description: description || `Payment for booking`,
    });

    if (insertError) {
      console.error("Failed to create transaction record:", insertError);
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: fees.grossAmount,
      platform_fee: fees.platformFee,
      net_amount: fees.netAmount,
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Get payment status
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get("payment_intent_id");

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Missing payment_intent_id" },
        { status: 400 }
      );
    }

    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return NextResponse.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    });
  } catch (error: any) {
    console.error("Error getting payment status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
