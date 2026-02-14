import Stripe from "stripe";

// Platform configuration
export const PLATFORM_CONFIG = {
  // Use Custom accounts for native in-app onboarding (bank details collected in-app)
  connectAccountType: "custom" as const,
  
  // Platform fee percentage (10%)
  platformFeePercent: 10,
  
  // URLs for Connect onboarding
  connectReturnUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/d/personnel/payments?success=true`,
  connectRefreshUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/d/personnel/payments?refresh=true`,
  
  // Currency
  currency: "gbp" as const,
};

// Singleton Stripe instance
let stripeInstance: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    
    stripeInstance = new Stripe(secretKey, {
      typescript: true,
    });
  }
  
  return stripeInstance;
}

// Helper to calculate platform fee (simple)
export function calculatePlatformFee(amountInPence: number): number {
  return Math.round(amountInPence * (PLATFORM_CONFIG.platformFeePercent / 100));
}

// Helper to calculate payment fees (returns breakdown)
export function calculatePaymentFees(grossAmountInPence: number): {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
} {
  const platformFee = Math.round(grossAmountInPence * (PLATFORM_CONFIG.platformFeePercent / 100));
  const netAmount = grossAmountInPence - platformFee;
  
  return {
    grossAmount: grossAmountInPence,
    platformFee,
    netAmount,
  };
}

// Helper to format currency
export function formatCurrency(amountInPence: number): string {
  return `£${(amountInPence / 100).toFixed(2)}`;
}
