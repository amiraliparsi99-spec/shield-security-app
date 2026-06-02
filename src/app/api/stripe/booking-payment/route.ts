import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getStripe, PLATFORM_CONFIG, calculatePaymentFees } from "@/lib/stripe";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) return user;
  }

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
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Creates a PaymentIntent for an upfront booking payment.
 * Money is collected to the platform account; transfers to guards
 * happen later when shifts are completed.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount_pence, event_name, venue_id } = body;

    if (!amount_pence || amount_pence < 100) {
      return NextResponse.json(
        { error: "Amount must be at least £1.00" },
        { status: 400 },
      );
    }

    const fees = calculatePaymentFees(amount_pence);

    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fees.grossAmount,
      currency: PLATFORM_CONFIG.currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "booking_upfront",
        venue_id: venue_id || "",
        payer_id: user.id,
        event_name: event_name || "",
        platform_fee: fees.platformFee.toString(),
      },
      description: `Booking payment: ${event_name || "Security booking"}`,
    });

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: fees.grossAmount,
      platform_fee: fees.platformFee,
    });
  } catch (error: any) {
    console.error("Error creating booking payment intent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
