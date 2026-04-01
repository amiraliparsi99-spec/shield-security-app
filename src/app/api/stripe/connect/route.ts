import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getStripe, PLATFORM_CONFIG } from "@/lib/stripe";

// Admin client to bypass RLS for Stripe account operations
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

// GET: Get onboarding status
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get existing Stripe account (using admin to bypass RLS)
    const { data: stripeAccount } = await supabaseAdmin
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!stripeAccount) {
      return NextResponse.json({
        has_stripe_account: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        onboarding_complete: false,
      });
    }

    // Get latest status from Stripe
    const stripe = await getStripe();
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

    // Check if bank account / external account is attached
    const hasExternalAccount = account.external_accounts?.data && account.external_accounts.data.length > 0;

    // Onboarding is complete if:
    // 1. Charges & payouts are both enabled (fully verified), OR
    // 2. Bank details have been submitted (Custom account with external account attached)
    // 3. Our DB already marks it as complete (bank endpoint set this)
    const isOnboardingComplete = 
      (account.charges_enabled && account.payouts_enabled) ||
      hasExternalAccount ||
      stripeAccount.onboarding_complete;

    // Update local record if needed
    if (
      account.charges_enabled !== stripeAccount.charges_enabled ||
      account.payouts_enabled !== stripeAccount.payouts_enabled ||
      account.details_submitted !== stripeAccount.details_submitted ||
      isOnboardingComplete !== stripeAccount.onboarding_complete
    ) {
      await supabaseAdmin
        .from("stripe_accounts")
        .update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          onboarding_complete: isOnboardingComplete,
          business_name: account.business_profile?.name || null,
        })
        .eq("id", stripeAccount.id);
    }

    return NextResponse.json({
      has_stripe_account: true,
      stripe_account_id: stripeAccount.stripe_account_id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_complete: isOnboardingComplete,
    });
  } catch (error: any) {
    console.error("Error getting connect status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create connected account and get onboarding link
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body for optional return URLs (for mobile)
    let customReturnUrl: string | undefined;
    let customRefreshUrl: string | undefined;
    
    try {
      const body = await request.json();
      customReturnUrl = body.return_url;
      customRefreshUrl = body.refresh_url;
    } catch {
      // No body provided, use defaults
    }

    // Get user profile to determine account type (using admin to bypass RLS)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .single();

    if (!profile || !["agency", "personnel"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Only agencies and personnel can connect payment accounts" },
        { status: 400 }
      );
    }

    // Check for existing account (using admin)
    const { data: existingAccount } = await supabaseAdmin
      .from("stripe_accounts")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId: string | undefined;

    const stripe = await getStripe();
    const isGuard = profile.role === "personnel";

    // Prefill guard details from their personnel record
    let individualPrefill: Record<string, any> | undefined;
    if (isGuard) {
      const { data: personnel, error: personnelError } = await supabaseAdmin
        .from("personnel")
        .select("first_name, last_name, address_line1, address_line2, city, postcode")
        .eq("user_id", user.id)
        .single();

      if (personnelError) {
        console.error("[Stripe Connect] Failed to load personnel data:", personnelError.message);
      }

      if (personnel) {
        individualPrefill = {
          ...(personnel.first_name ? { first_name: personnel.first_name } : {}),
          ...(personnel.last_name ? { last_name: personnel.last_name } : {}),
          email: user.email,
          ...(personnel.address_line1 ? {
            address: {
              line1: personnel.address_line1,
              ...(personnel.address_line2 ? { line2: personnel.address_line2 } : {}),
              city: personnel.city || undefined,
              postal_code: personnel.postcode || undefined,
              country: "GB",
            },
          } : {}),
        };
        console.log("[Stripe Connect] Individual prefill:", JSON.stringify(individualPrefill));
      } else {
        console.warn("[Stripe Connect] No personnel data found for user:", user.id);
      }
    }

    const capabilities = {
      card_payments: { requested: true },
      transfers: { requested: true },
    };

    if (existingAccount) {
      // Check if the existing Stripe account has individual data populated.
      // Express accounts can't be updated with individual data after creation,
      // so if it's missing we delete and recreate the account.
      const existingStripeAccount = await stripe.accounts.retrieve(existingAccount.stripe_account_id);

      if (
        isGuard &&
        individualPrefill &&
        !existingStripeAccount.details_submitted &&
        !existingStripeAccount.individual?.first_name
      ) {
        console.log("[Stripe Connect] Existing account missing individual data, recreating...");
        try {
          await stripe.accounts.del(existingAccount.stripe_account_id);
          await supabaseAdmin.from("stripe_accounts").delete().eq("id", existingAccount.id);
        } catch (e: any) {
          console.warn("[Stripe Connect] Failed to delete incomplete account:", e.message);
        }
        // Fall through to create a fresh account below
      } else {
        stripeAccountId = existingAccount.stripe_account_id;

        try {
          await stripe.accounts.update(stripeAccountId!, {
            business_profile: {
              mcc: "7399",
              product_description: "Security guard services provided through the Shield platform",
              url: "https://shieldapp.co.uk",
            },
          });
        } catch (e: any) {
          console.warn("[Stripe Connect] Non-critical: failed to update business_profile:", e.message);
        }
      }
    }

    if (!stripeAccountId) {
      console.log("[Stripe Connect] Creating new account for user:", user.id, "with individual:", !!individualPrefill);
      const account = await stripe.accounts.create({
        type: PLATFORM_CONFIG.connectAccountType,
        country: "GB",
        email: user.email,
        capabilities,
        business_type: isGuard ? "individual" : "company",
        business_profile: isGuard
          ? {
              mcc: "7399",
              product_description: "Security guard services provided through the Shield platform",
              url: "https://shieldapp.co.uk",
            }
          : undefined,
        ...(isGuard && individualPrefill ? { individual: individualPrefill } : {}),
        metadata: {
          user_id: user.id,
          role: profile.role,
        },
        settings: isGuard
          ? {
              payouts: {
                schedule: { interval: "manual" as const },
              },
            }
          : undefined,
      });

      stripeAccountId = account.id;

      await supabaseAdmin.from("stripe_accounts").insert({
        user_id: user.id,
        stripe_account_id: account.id,
        account_type: profile.role as "agency" | "personnel",
      });

      await supabaseAdmin.from("wallets").upsert({
        user_id: user.id,
        available_balance: 0,
        pending_balance: 0,
      });
    }

    // Create account link for onboarding
    // Use custom URLs if provided (for mobile), otherwise use defaults
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId!,
      refresh_url: customRefreshUrl || PLATFORM_CONFIG.connectRefreshUrl,
      return_url: customReturnUrl || PLATFORM_CONFIG.connectReturnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({
      account_id: stripeAccountId,
      onboarding_url: accountLink.url,
    });
  } catch (error: any) {
    console.error("Error creating connect account:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
