/**
 * Payment database operations
 * Handles creating and managing payments for completed shifts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Shift } from '../database.types';
import { calculatePaymentFees, PLATFORM_CONFIG } from '../stripe';

type TypedSupabaseClient = SupabaseClient<Database>;

export type PaymentStatus = 'pending' | 'awaiting_payment' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface ShiftPayment {
  id: string;
  shift_id: string;
  booking_id: string;
  venue_id: string;
  personnel_id: string;
  agency_id: string | null;
  gross_amount: number;
  platform_fee: number;
  agency_commission: number | null;
  personnel_net: number;
  currency: string;
  status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateShiftPaymentParams {
  shift: Shift;
  venueId: string;
  venueOwnerId: string;
  agencyId?: string | null;
  agencyCommissionRate?: number; // e.g., 0.15 for 15%
}

/**
 * Create a payment record for a completed shift
 * Called automatically when a shift is checked out
 */
export async function createShiftPayment(
  supabase: TypedSupabaseClient,
  params: CreateShiftPaymentParams
): Promise<{ success: boolean; payment?: ShiftPayment; error?: string }> {
  const { shift, venueId, venueOwnerId, agencyId, agencyCommissionRate } = params;

  // Validate shift has required payment data
  if (!shift.total_pay || shift.total_pay <= 0) {
    return { success: false, error: 'Shift has no pay amount calculated' };
  }

  if (!shift.personnel_id) {
    return { success: false, error: 'Shift has no assigned personnel' };
  }

  // Calculate fees
  // gross_amount is what the venue pays
  const grossAmount = Math.round(shift.total_pay * 100); // Convert to pence
  const fees = calculatePaymentFees(grossAmount);
  
  // Agency commission (if applicable)
  let agencyCommission = 0;
  if (agencyId && agencyCommissionRate) {
    agencyCommission = Math.round(fees.netAmount * agencyCommissionRate);
  }

  // Personnel net is what they receive after platform fee and agency commission
  const personnelNet = fees.netAmount - agencyCommission;

  // Create the payment record
  const { data: payment, error } = await supabase
    .from('shift_payments')
    .insert({
      shift_id: shift.id,
      booking_id: shift.booking_id,
      venue_id: venueId,
      personnel_id: shift.personnel_id,
      agency_id: agencyId || null,
      gross_amount: grossAmount,
      platform_fee: fees.platformFee,
      agency_commission: agencyCommission || null,
      personnel_net: personnelNet,
      currency: PLATFORM_CONFIG.currency,
      status: 'awaiting_payment',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating shift payment:', error);
    return { success: false, error: error.message };
  }

  // Update the personnel's pending balance
  await updateWalletPendingBalance(supabase, shift.personnel_id, personnelNet);

  // Notify venue owner about pending payment
  await notifyPaymentDue(supabase, venueOwnerId, shift, grossAmount);

  // Notify personnel about incoming payment
  const { data: personnelData } = await supabase
    .from('personnel')
    .select('user_id')
    .eq('id', shift.personnel_id)
    .single();

  if (personnelData?.user_id) {
    await notifyPaymentPending(supabase, personnelData.user_id, shift, personnelNet);
  }

  return { success: true, payment: payment as ShiftPayment };
}

/**
 * Update a wallet's pending balance when a shift payment is created
 */
async function updateWalletPendingBalance(
  supabase: TypedSupabaseClient,
  personnelId: string,
  amount: number
): Promise<void> {
  // Get the user_id for the personnel
  const { data: personnel } = await supabase
    .from('personnel')
    .select('user_id')
    .eq('id', personnelId)
    .single();

  if (!personnel?.user_id) return;

  // Upsert wallet record
  const { data: existingWallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', personnel.user_id)
    .single();

  if (existingWallet) {
    await supabase
      .from('wallets')
      .update({
        pending_balance: (existingWallet.pending_balance || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', personnel.user_id);
  } else {
    await supabase.from('wallets').insert({
      user_id: personnel.user_id,
      available_balance: 0,
      pending_balance: amount,
      total_earned: 0,
      total_withdrawn: 0,
      currency: PLATFORM_CONFIG.currency,
    });
  }
}

/**
 * Process payment completion (called by webhook when Stripe payment succeeds)
 */
export async function markPaymentSucceeded(
  supabase: TypedSupabaseClient,
  paymentId: string,
  stripePaymentIntentId: string
): Promise<{ success: boolean; error?: string }> {
  // Get the payment record
  const { data: payment, error: fetchError } = await supabase
    .from('shift_payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (fetchError || !payment) {
    return { success: false, error: 'Payment not found' };
  }

  // Update payment status
  const { error: updateError } = await supabase
    .from('shift_payments')
    .update({
      status: 'succeeded',
      stripe_payment_intent_id: stripePaymentIntentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Move balance from pending to available
  const { data: personnel } = await supabase
    .from('personnel')
    .select('user_id')
    .eq('id', payment.personnel_id)
    .single();

  if (personnel?.user_id) {
    await supabase.rpc('transfer_pending_to_available', {
      p_user_id: personnel.user_id,
      p_amount: payment.personnel_net,
    });

    // Notify personnel
    await supabase.from('notifications').insert({
      user_id: personnel.user_id,
      type: 'payment',
      title: '💰 Payment Received',
      body: `£${(payment.personnel_net / 100).toFixed(2)} has been added to your available balance`,
      data: { payment_id: paymentId, amount: payment.personnel_net },
    });
  }

  // If agency involved, update their balance too
  if (payment.agency_id && payment.agency_commission) {
    await updateAgencyBalance(supabase, payment.agency_id, payment.agency_commission);
  }

  return { success: true };
}

/**
 * Update agency's commission balance
 */
async function updateAgencyBalance(
  supabase: TypedSupabaseClient,
  agencyId: string,
  amount: number
): Promise<void> {
  const { data: agency } = await supabase
    .from('agencies')
    .select('owner_id')
    .eq('id', agencyId)
    .single();

  if (!agency?.owner_id) return;

  const { data: existingWallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', agency.owner_id)
    .single();

  if (existingWallet) {
    await supabase
      .from('wallets')
      .update({
        available_balance: (existingWallet.available_balance || 0) + amount,
        total_earned: (existingWallet.total_earned || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', agency.owner_id);
  } else {
    await supabase.from('wallets').insert({
      user_id: agency.owner_id,
      available_balance: amount,
      pending_balance: 0,
      total_earned: amount,
      total_withdrawn: 0,
      currency: PLATFORM_CONFIG.currency,
    });
  }
}

/**
 * Get pending payments for a venue
 */
export async function getVenuePendingPayments(
  supabase: TypedSupabaseClient,
  venueId: string
): Promise<ShiftPayment[]> {
  const { data, error } = await supabase
    .from('shift_payments')
    .select('*')
    .eq('venue_id', venueId)
    .in('status', ['awaiting_payment', 'pending'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending payments:', error);
    return [];
  }

  return data as ShiftPayment[];
}

/**
 * Get payment history for personnel
 */
export async function getPersonnelPaymentHistory(
  supabase: TypedSupabaseClient,
  personnelId: string,
  limit = 20
): Promise<ShiftPayment[]> {
  const { data, error } = await supabase
    .from('shift_payments')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching payment history:', error);
    return [];
  }

  return data as ShiftPayment[];
}

/**
 * Notify venue owner that payment is due
 */
async function notifyPaymentDue(
  supabase: TypedSupabaseClient,
  venueOwnerId: string,
  shift: Shift,
  amount: number
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: venueOwnerId,
    type: 'payment',
    title: '💳 Payment Due',
    body: `Shift completed - £${(amount / 100).toFixed(2)} payment pending for ${shift.role} shift`,
    data: { shift_id: shift.id, amount, action: 'pay_now' },
  });
}

/**
 * Notify personnel that payment is pending
 */
async function notifyPaymentPending(
  supabase: TypedSupabaseClient,
  userId: string,
  shift: Shift,
  amount: number
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'payment',
    title: '⏳ Payment Processing',
    body: `£${(amount / 100).toFixed(2)} will be added to your balance once the venue completes payment`,
    data: { shift_id: shift.id, amount },
  });
}
