import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Shift, 
  ShiftInsert, 
  ShiftUpdate,
  ShiftWithDetails,
  ShiftStatus 
} from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

// =====================================================
// SHIFT STATE MACHINE
// =====================================================

/**
 * Valid shift status transitions
 * Maps from current status to allowed next statuses
 */
export const VALID_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
  pending: ['accepted', 'declined', 'cancelled'],
  accepted: ['checked_in', 'no_show', 'cancelled'],
  declined: [], // Terminal state
  checked_in: ['checked_out', 'cancelled'],
  checked_out: [], // Terminal state
  no_show: [], // Terminal state
  cancelled: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  from: ShiftStatus,
  to: ShiftStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: ShiftStatus): string {
  const labels: Record<ShiftStatus, string> = {
    pending: 'Awaiting Response',
    accepted: 'Confirmed',
    declined: 'Declined',
    checked_in: 'On Shift',
    checked_out: 'Completed',
    no_show: 'No Show',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: ShiftStatus): { bg: string; text: string } {
  const colors: Record<ShiftStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    accepted: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    declined: { bg: 'bg-red-500/20', text: 'text-red-400' },
    checked_in: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    checked_out: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    no_show: { bg: 'bg-red-500/20', text: 'text-red-400' },
    cancelled: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
  };
  return colors[status] || colors.pending;
}

export interface ShiftTransitionResult {
  success: boolean;
  shift: Shift | null;
  error?: string;
}

export async function getShiftById(
  supabase: TypedSupabaseClient,
  shiftId: string
): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single();

  if (error) {
    console.error('Error fetching shift:', error);
    return null;
  }

  return data;
}

export async function createShift(
  supabase: TypedSupabaseClient,
  shift: ShiftInsert
): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .insert(shift)
    .select()
    .single();

  if (error) {
    console.error('Error creating shift:', error);
    return null;
  }

  return data;
}

export async function updateShift(
  supabase: TypedSupabaseClient,
  shiftId: string,
  updates: ShiftUpdate
): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', shiftId)
    .select()
    .single();

  if (error) {
    console.error('Error updating shift:', error);
    return null;
  }

  return data;
}

export async function getPersonnelShifts(
  supabase: TypedSupabaseClient,
  personnelId: string,
  options?: {
    status?: ShiftStatus | ShiftStatus[];
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<Shift[]> {
  let query = supabase
    .from('shifts')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('scheduled_start', { ascending: true });

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in('status', options.status);
    } else {
      query = query.eq('status', options.status);
    }
  }

  if (options?.fromDate) {
    query = query.gte('scheduled_start', options.fromDate);
  }

  if (options?.toDate) {
    query = query.lte('scheduled_start', options.toDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching personnel shifts:', error);
    return [];
  }

  return data || [];
}

export async function getBookingShifts(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('booking_id', bookingId)
    .order('scheduled_start', { ascending: true });

  if (error) {
    console.error('Error fetching booking shifts:', error);
    return [];
  }

  return data || [];
}

/**
 * Validate and transition shift status with proper error handling
 */
async function transitionShiftStatus(
  supabase: TypedSupabaseClient,
  shiftId: string,
  targetStatus: ShiftStatus,
  additionalUpdates: ShiftUpdate = {}
): Promise<ShiftTransitionResult> {
  // Get current shift
  const shift = await getShiftById(supabase, shiftId);
  if (!shift) {
    return { success: false, shift: null, error: 'Shift not found' };
  }

  // Validate transition
  if (!isValidTransition(shift.status, targetStatus)) {
    return {
      success: false,
      shift,
      error: `Invalid transition: ${shift.status} → ${targetStatus}. Allowed: ${VALID_TRANSITIONS[shift.status].join(', ') || 'none'}`,
    };
  }

  // Perform update
  const updatedShift = await updateShift(supabase, shiftId, {
    ...additionalUpdates,
    status: targetStatus,
  });

  if (!updatedShift) {
    return { success: false, shift, error: 'Failed to update shift' };
  }

  return { success: true, shift: updatedShift };
}

export async function acceptShift(
  supabase: TypedSupabaseClient,
  shiftId: string
): Promise<ShiftTransitionResult> {
  const result = await transitionShiftStatus(supabase, shiftId, 'accepted', {
    accepted_at: new Date().toISOString(),
  });

  if (result.success && result.shift) {
    // Notify venue that shift was accepted
    await notifyShiftStatusChange(supabase, result.shift, 'accepted');
  }

  return result;
}

export async function declineShift(
  supabase: TypedSupabaseClient,
  shiftId: string,
  reason?: string
): Promise<ShiftTransitionResult> {
  const result = await transitionShiftStatus(supabase, shiftId, 'declined', {
    declined_at: new Date().toISOString(),
    decline_reason: reason || null,
  });

  if (result.success && result.shift) {
    // Notify venue that shift was declined
    await notifyShiftStatusChange(supabase, result.shift, 'declined');
  }

  return result;
}

export async function checkInShift(
  supabase: TypedSupabaseClient,
  shiftId: string,
  latitude: number,
  longitude: number
): Promise<ShiftTransitionResult> {
  const result = await transitionShiftStatus(supabase, shiftId, 'checked_in', {
    actual_start: new Date().toISOString(),
    check_in_latitude: latitude,
    check_in_longitude: longitude,
  });

  if (result.success && result.shift) {
    // Notify venue that personnel checked in
    await notifyShiftStatusChange(supabase, result.shift, 'checked_in');
  }

  return result;
}

export async function checkOutShift(
  supabase: TypedSupabaseClient,
  shiftId: string,
  latitude: number,
  longitude: number
): Promise<ShiftTransitionResult> {
  // First get the shift to calculate hours
  const shift = await getShiftById(supabase, shiftId);
  if (!shift) {
    return { success: false, shift: null, error: 'Shift not found' };
  }
  
  if (!shift.actual_start) {
    return { success: false, shift, error: 'Cannot check out without checking in first' };
  }

  const actualEnd = new Date();
  const actualStart = new Date(shift.actual_start);
  const hoursWorked = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
  const totalPay = hoursWorked * shift.hourly_rate;

  const result = await transitionShiftStatus(supabase, shiftId, 'checked_out', {
    actual_end: actualEnd.toISOString(),
    check_out_latitude: latitude,
    check_out_longitude: longitude,
    hours_worked: Math.round(hoursWorked * 100) / 100,
    total_pay: Math.round(totalPay * 100) / 100,
  });

  if (result.success && result.shift) {
    // Notify venue that shift was completed
    await notifyShiftStatusChange(supabase, result.shift, 'checked_out');
    
    // Create payment record for the completed shift
    await createPaymentForShift(supabase, result.shift);
  }

  return result;
}

/**
 * Create a payment record when a shift is completed
 */
async function createPaymentForShift(
  supabase: TypedSupabaseClient,
  shift: Shift
): Promise<void> {
  // Import here to avoid circular dependency
  const { createShiftPayment } = await import('./payments');

  // Get booking with venue info
  const { data: booking } = await supabase
    .from('bookings')
    .select('venue_id, venues(id, owner_id)')
    .eq('id', shift.booking_id)
    .single();

  if (!booking) {
    console.error('Could not find booking for shift payment');
    return;
  }

  const venue = (booking as any).venues;
  if (!venue) {
    console.error('Could not find venue for shift payment');
    return;
  }

  // Get agency info if personnel is from an agency
  let agencyId: string | null = null;
  let agencyCommissionRate: number | undefined;

  if (shift.personnel_id) {
    const { data: personnel } = await supabase
      .from('personnel')
      .select('agency_id, agency_commission_rate')
      .eq('id', shift.personnel_id)
      .single();

    if (personnel?.agency_id) {
      agencyId = personnel.agency_id;
      // Get agency commission rate (default 15%)
      const { data: agency } = await supabase
        .from('agencies')
        .select('commission_rate')
        .eq('id', personnel.agency_id)
        .single();
      
      agencyCommissionRate = agency?.commission_rate || 0.15;
    }
  }

  // Create the payment
  await createShiftPayment(supabase, {
    shift,
    venueId: venue.id,
    venueOwnerId: venue.owner_id,
    agencyId,
    agencyCommissionRate,
  });
}

/**
 * Cancel a shift (can be done by venue or personnel depending on status)
 */
export async function cancelShift(
  supabase: TypedSupabaseClient,
  shiftId: string,
  cancelledBy: 'venue' | 'personnel' | 'agency',
  reason?: string
): Promise<ShiftTransitionResult> {
  const result = await transitionShiftStatus(supabase, shiftId, 'cancelled', {
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason || null,
    cancelled_by: cancelledBy,
  });

  if (result.success && result.shift) {
    // Notify affected parties
    await notifyShiftStatusChange(supabase, result.shift, 'cancelled', { 
      cancelledBy, 
      reason 
    });
  }

  return result;
}

/**
 * Mark a shift as no-show (typically called by venue or automatic process)
 */
export async function markNoShow(
  supabase: TypedSupabaseClient,
  shiftId: string,
  notes?: string
): Promise<ShiftTransitionResult> {
  const result = await transitionShiftStatus(supabase, shiftId, 'no_show', {
    no_show_at: new Date().toISOString(),
    no_show_notes: notes || null,
  });

  if (result.success && result.shift) {
    // Notify affected parties and potentially impact Shield Score
    await notifyShiftStatusChange(supabase, result.shift, 'no_show', { notes });
    
    // Impact Shield Score for no-shows (major negative event)
    if (result.shift.personnel_id) {
      await recordNoShowPenalty(supabase, result.shift);
    }
  }

  return result;
}

/**
 * Record a no-show penalty against personnel's Shield Score
 */
async function recordNoShowPenalty(
  supabase: TypedSupabaseClient,
  shift: Shift
): Promise<void> {
  if (!shift.personnel_id) return;

  // Get personnel to find user_id
  const { data: personnel } = await supabase
    .from('personnel')
    .select('user_id')
    .eq('id', shift.personnel_id)
    .single();

  if (!personnel?.user_id) return;

  // Record the no-show event in shield_score_history
  await supabase.from('shield_score_history').insert({
    personnel_id: shift.personnel_id,
    event_type: 'no_show',
    points_change: -25, // Significant penalty for no-show
    details: {
      shift_id: shift.id,
      booking_id: shift.booking_id,
      scheduled_start: shift.scheduled_start,
    },
    created_at: new Date().toISOString(),
  });

  // Update the personnel's shield score
  const { data: scoreData } = await supabase
    .from('personnel')
    .select('shield_score')
    .eq('id', shift.personnel_id)
    .single();

  if (scoreData) {
    const newScore = Math.max(0, (scoreData.shield_score || 100) - 25);
    await supabase
      .from('personnel')
      .update({ shield_score: newScore })
      .eq('id', shift.personnel_id);
  }
}

/**
 * Send notifications for shift status changes
 */
async function notifyShiftStatusChange(
  supabase: TypedSupabaseClient,
  shift: Shift,
  newStatus: ShiftStatus,
  extra?: { cancelledBy?: string; reason?: string; notes?: string }
): Promise<void> {
  // Get booking and venue info
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, event_name, venue_id, venues(id, name, owner_id)')
    .eq('id', shift.booking_id)
    .single();

  if (!booking) return;

  const venueName = (booking as any).venues?.name || 'Unknown Venue';
  const venueOwnerId = (booking as any).venues?.owner_id;

  // Get personnel info if assigned
  let personnelUserId: string | null = null;
  let personnelName = 'Unknown';
  
  if (shift.personnel_id) {
    const { data: personnel } = await supabase
      .from('personnel')
      .select('user_id, users(full_name)')
      .eq('id', shift.personnel_id)
      .single();
    
    if (personnel) {
      personnelUserId = personnel.user_id;
      personnelName = (personnel as any).users?.full_name || 'Unknown';
    }
  }

  const shiftDate = new Date(shift.scheduled_start).toLocaleDateString();

  // Send appropriate notifications based on status
  switch (newStatus) {
    case 'accepted':
      // Notify venue that personnel accepted
      if (venueOwnerId) {
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'shift',
          title: '✅ Shift Accepted',
          body: `${personnelName} accepted the shift for "${booking.event_name}" on ${shiftDate}`,
          data: { shift_id: shift.id, booking_id: booking.id },
        });
      }
      break;

    case 'declined':
      // Notify venue that personnel declined
      if (venueOwnerId) {
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'shift',
          title: '❌ Shift Declined',
          body: `${personnelName} declined the shift for "${booking.event_name}". Consider finding a replacement.`,
          data: { shift_id: shift.id, booking_id: booking.id },
        });
      }
      break;

    case 'checked_in':
      // Notify venue that personnel started shift
      if (venueOwnerId) {
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'shift',
          title: '🟢 Staff Checked In',
          body: `${personnelName} has started their shift at ${venueName}`,
          data: { shift_id: shift.id, booking_id: booking.id },
        });
      }
      break;

    case 'checked_out':
      // Notify venue that shift completed
      if (venueOwnerId) {
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'shift',
          title: '🏁 Shift Completed',
          body: `${personnelName} completed their shift (${shift.hours_worked?.toFixed(1)}h). Payment pending.`,
          data: { shift_id: shift.id, booking_id: booking.id, hours: shift.hours_worked },
        });
      }
      // Notify personnel to submit review
      if (personnelUserId) {
        await supabase.from('notifications').insert({
          user_id: personnelUserId,
          type: 'review',
          title: '⭐ Rate Your Experience',
          body: `How was your shift at ${venueName}? Leave a review.`,
          data: { shift_id: shift.id, venue_id: booking.venue_id },
        });
      }
      break;

    case 'cancelled':
      const cancelledByLabel = extra?.cancelledBy === 'venue' ? 'The venue' : 
                               extra?.cancelledBy === 'agency' ? 'The agency' : 'Personnel';
      
      // Notify personnel if cancelled by venue/agency
      if (extra?.cancelledBy !== 'personnel' && personnelUserId) {
        await supabase.from('notifications').insert({
          user_id: personnelUserId,
          type: 'shift',
          title: '🚫 Shift Cancelled',
          body: `${cancelledByLabel} cancelled your shift at ${venueName} on ${shiftDate}${extra?.reason ? `: ${extra.reason}` : ''}`,
          data: { shift_id: shift.id, booking_id: booking.id },
        });
      }
      // Notify venue if cancelled by personnel
      if (extra?.cancelledBy === 'personnel' && venueOwnerId) {
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'shift',
          title: '⚠️ Staff Cancelled',
          body: `${personnelName} cancelled their shift for "${booking.event_name}". Find a replacement.`,
          data: { shift_id: shift.id, booking_id: booking.id, needs_replacement: true },
        });
      }
      break;

    case 'no_show':
      // Notify venue
      if (venueOwnerId) {
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'alert',
          title: '🚨 No-Show Reported',
          body: `${personnelName} did not show up for "${booking.event_name}". Find a replacement immediately.`,
          data: { shift_id: shift.id, booking_id: booking.id, priority: 'high' },
        });
      }
      // Notify personnel
      if (personnelUserId) {
        await supabase.from('notifications').insert({
          user_id: personnelUserId,
          type: 'alert',
          title: '⚠️ No-Show Recorded',
          body: `You were marked as a no-show for ${venueName}. This affects your Shield Score.`,
          data: { shift_id: shift.id, shield_penalty: -25 },
        });
      }
      break;
  }
}

export async function getUpcomingShifts(
  supabase: TypedSupabaseClient,
  personnelId: string,
  limit: number = 5
): Promise<Shift[]> {
  const now = new Date().toISOString();
  
  return getPersonnelShifts(supabase, personnelId, {
    status: ['accepted', 'pending'],
    fromDate: now,
    limit,
  });
}

export async function getShiftHistory(
  supabase: TypedSupabaseClient,
  personnelId: string,
  limit: number = 20
): Promise<Shift[]> {
  return getPersonnelShifts(supabase, personnelId, {
    status: ['checked_out'],
    limit,
  });
}
