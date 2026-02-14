import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";

// Use service role for payment confirmation (bypasses RLS)
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

// POST: Confirm payment and update transaction status
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { payment_intent_id } = body;

    if (!payment_intent_id) {
      return NextResponse.json(
        { error: "Missing payment_intent_id" },
        { status: 400 }
      );
    }

    // Verify payment intent status with Stripe
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment has not succeeded", status: paymentIntent.status },
        { status: 400 }
      );
    }

    // Update transaction status to succeeded (using admin to bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "succeeded",
        stripe_charge_id: paymentIntent.latest_charge as string,
      })
      .eq("stripe_payment_intent_id", payment_intent_id);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
      return NextResponse.json(
        { error: "Failed to update transaction status" },
        { status: 500 }
      );
    }

    // Update booking payment status if available (using admin to bypass RLS)
    const bookingId = paymentIntent.metadata?.booking_id;
    if (bookingId) {
      // Try to add payment_status column if it doesn't exist, then update
      await supabaseAdmin
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("id", bookingId);
    }

    return NextResponse.json({
      success: true,
      status: "succeeded",
      booking_id: bookingId,
    });
  } catch (error: any) {
    console.error("Error confirming payment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
