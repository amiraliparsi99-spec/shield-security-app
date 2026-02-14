// Payment system types

export type PaymentMethodType = "apple_pay" | "google_pay" | "card" | "bank_transfer";
export type PayoutMethod = "instant" | "standard";
export type TransactionType = "payment" | "payout" | "refund" | "adjustment";
export type TransactionStatus = 
  | "pending" 
  | "processing" 
  | "succeeded" 
  | "failed" 
  | "cancelled" 
  | "refunded" 
  | "disputed";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";

// Stripe Connected Account
export interface StripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_type: "agency" | "personnel";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  business_name?: string;
  country: string;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

// Wallet
export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number; // in pence
  pending_balance: number;   // in pence
  total_earned: number;      // in pence
  total_withdrawn: number;   // in pence
  currency: string;
  updated_at: string;
}

// Transaction
export interface Transaction {
  id: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  stripe_transfer_id?: string;
  stripe_payout_id?: string;
  payer_id?: string;
  payee_id?: string;
  booking_id?: string;
  gross_amount: number;
  platform_fee: number;
  stripe_fee: number;
  net_amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  payment_method_type?: PaymentMethodType;
  payment_method_brand?: string;
  payment_method_last4?: string;
  description?: string;
  metadata?: Record<string, any>;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

// Transaction with related data
export interface TransactionWithDetails extends Transaction {
  payer?: {
    id: string;
    display_name: string;
  };
  payee?: {
    id: string;
    display_name: string;
  };
  booking?: {
    id: string;
    start: string;
    end: string;
    venue?: {
      name: string;
    };
  };
}

// Payout Request
export interface PayoutRequest {
  id: string;
  user_id: string;
  stripe_payout_id?: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  payout_method: PayoutMethod;
  status: PayoutStatus;
  bank_name?: string;
  bank_last4?: string;
  estimated_arrival?: string;
  paid_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

// Saved Payment Method
export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  bank_name?: string;
  is_default: boolean;
  nickname?: string;
  created_at: string;
}

// API Request/Response types

export interface CreatePaymentIntentRequest {
  booking_id: string;
  amount: number; // in pence
  payee_id: string;
  description?: string;
}

export interface CreatePaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
}

export interface RequestPayoutRequest {
  amount: number; // in pence
  method: PayoutMethod;
}

export interface RequestPayoutResponse {
  payout_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  estimated_arrival?: string;
}

// Onboarding
export interface OnboardingStatus {
  has_stripe_account: boolean;
  stripe_account_id?: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  onboarding_url?: string;
  dashboard_url?: string;
}

// Dashboard Stats
export interface PaymentDashboardStats {
  wallet: Wallet;
  recent_transactions: TransactionWithDetails[];
  pending_payouts: PayoutRequest[];
  onboarding_status: OnboardingStatus;
}
