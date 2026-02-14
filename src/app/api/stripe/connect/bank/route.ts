import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";

// Admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get user from either cookie or Bearer token (for mobile)
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) {
      return user;
    }
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
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST: Create a Custom connected account with bank details
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, sort_code, account_number } = body;

    // Validate inputs
    if (!full_name?.trim()) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    // Clean sort code (remove dashes/spaces)
    const cleanSortCode = (sort_code || "").replace(/[-\s]/g, "");
    if (!/^\d{6}$/.test(cleanSortCode)) {
      return NextResponse.json(
        { error: "Sort code must be 6 digits" },
        { status: 400 }
      );
    }

    // Clean account number
    const cleanAccountNumber = (account_number || "").replace(/\s/g, "");
    if (!/^\d{8}$/.test(cleanAccountNumber)) {
      return NextResponse.json(
        { error: "Account number must be 8 digits" },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, display_name, email")
      .eq("id", user.id)
      .single();

    if (!profile || !["agency", "personnel"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Only agencies and personnel can connect payment accounts" },
        { status: 400 }
      );
    }

    const stripe = await getStripe();

    // Check for existing account
    const { data: existingAccount } = await supabaseAdmin
      .from("stripe_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId: string;
    let needsNewAccount = true;

    if (existingAccount) {
      // Check if existing account is Custom type (can add bank details)
      try {
        const existingStripeAccount = await stripe.accounts.retrieve(existingAccount.stripe_account_id);
        if (existingStripeAccount.type === "custom") {
          // Existing Custom account - reuse it
          stripeAccountId = existingAccount.stripe_account_id;
          needsNewAccount = false;
        } else {
          // Existing Express account - delete old record, we'll create a new Custom one
          try {
            await stripe.accounts.del(existingAccount.stripe_account_id);
          } catch {
            // If we can't delete the Stripe account, that's OK - just remove our DB record
          }
          await supabaseAdmin
            .from("stripe_accounts")
            .delete()
            .eq("user_id", user.id);
        }
      } catch {
        // Account doesn't exist in Stripe anymore - clean up DB record
        await supabaseAdmin
          .from("stripe_accounts")
          .delete()
          .eq("user_id", user.id);
      }
    }

    if (needsNewAccount) {
      // Split the full name into first and last
      const nameParts = full_name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];

      // Create a Custom connected account
      const account = await stripe.accounts.create({
        type: "custom",
        country: "GB",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        individual: {
          first_name: firstName,
          last_name: lastName,
          email: user.email,
        },
        business_profile: {
          mcc: "7399", // Business services
          product_description: "Security personnel services",
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0",
        },
        metadata: {
          user_id: user.id,
          role: profile.role,
        },
      });

      stripeAccountId = account.id;

      // Save to database
      await supabaseAdmin.from("stripe_accounts").upsert({
        user_id: user.id,
        stripe_account_id: account.id,
        account_type: profile.role as "agency" | "personnel",
        details_submitted: true,
      });

      // Create wallet for user
      await supabaseAdmin.from("wallets").upsert({
        user_id: user.id,
        available_balance: 0,
        pending_balance: 0,
      });
    }

    // Add the bank account as an external account
    try {
      await stripe.accounts.createExternalAccount(stripeAccountId, {
        external_account: {
          object: "bank_account",
          country: "GB",
          currency: "gbp",
          routing_number: cleanSortCode,
          account_number: cleanAccountNumber,
          account_holder_name: full_name.trim(),
          account_holder_type: "individual",
        },
      });
    } catch (bankError: any) {
      // If bank account already exists or other Stripe error
      if (bankError.code === "bank_account_exists") {
        // That's fine, bank account already linked
      } else {
        console.error("Error adding bank account:", bankError);
        return NextResponse.json(
          { error: bankError.message || "Failed to add bank account" },
          { status: 400 }
        );
      }
    }

    // Retrieve updated account to check status
    const updatedAccount = await stripe.accounts.retrieve(stripeAccountId);

    // Update local record with latest status
    await supabaseAdmin
      .from("stripe_accounts")
      .update({
        charges_enabled: updatedAccount.charges_enabled,
        payouts_enabled: updatedAccount.payouts_enabled,
        details_submitted: updatedAccount.details_submitted,
        onboarding_complete: true, // Bank details submitted = onboarding complete for our purposes
        business_name: full_name.trim(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      account_id: stripeAccountId,
      charges_enabled: updatedAccount.charges_enabled,
      payouts_enabled: updatedAccount.payouts_enabled,
      onboarding_complete: true,
    });
  } catch (error: any) {
    console.error("Error creating bank account:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
