import type Stripe from "stripe";

// Server-side Stripe instance (lazy initialization to avoid errors when key is missing)
let _stripe: Stripe | null = null;

/**
 * Get the Stripe instance (lazy loaded)
 * Only call this in server-side code (API routes, server components, etc.)
 */
export async function getStripe(): Promise<Stripe> {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your .env.local file to enable payments."
      );
    }
    // Dynamic import to avoid loading Stripe on client side
    const { default: StripeLib } = await import("stripe");
    _stripe = new StripeLib(key, {
      apiVersion: "2024-12-18.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Platform configuration
export const PLATFORM_CONFIG = {
  // Fee settings
  platformFeePercent: 0.10, // 10%
  instantPayoutFeePercent: 0.01, // 1%
  instantPayoutMinFee: 50, // 50p minimum
  
  // Limits
  minimumPayoutAmount: 1000, // £10 minimum payout
  maximumPayoutAmount: 1000000, // £10,000 maximum single payout
  
  // Currency
  currency: "gbp" as const,
  
  // Stripe Connect settings
  connectAccountType: "express" as const, // or "standard" for more control
  
  // URLs
  connectReturnUrl: process.env.NEXT_PUBLIC_APP_URL + "/d/payments/setup/complete",
  connectRefreshUrl: process.env.NEXT_PUBLIC_APP_URL + "/d/payments/setup/refresh",
};

// Calculate fees for a booking payment
export function calculatePaymentFees(grossAmount: number) {
  const platformFee = Math.round(grossAmount * PLATFORM_CONFIG.platformFeePercent);
  const netAmount = grossAmount - platformFee;
  
  // Estimated Stripe fee (actual may vary slightly)
  // UK cards: 1.5% + 20p, EU cards: 2.5% + 20p
  const estimatedStripeFee = Math.round(grossAmount * 0.015) + 20;
  
  return {
    grossAmount,
    platformFee,
    netAmount,
    estimatedStripeFee,
    payeeReceives: netAmount,
  };
}

// Calculate instant payout fee
export function calculateInstantPayoutFee(amount: number) {
  const fee = Math.max(
    PLATFORM_CONFIG.instantPayoutMinFee,
    Math.round(amount * PLATFORM_CONFIG.instantPayoutFeePercent)
  );
  
  return {
    amount,
    fee,
    netAmount: amount - fee,
  };
}

// Format amount from pence to pounds string
export function formatCurrency(amountInPence: number, currency = "gbp"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInPence / 100);
}

// Parse amount from pounds to pence
export function toPence(pounds: number): number {
  return Math.round(pounds * 100);
}

// Parse amount from pence to pounds
export function toPounds(pence: number): number {
  return pence / 100;
}
