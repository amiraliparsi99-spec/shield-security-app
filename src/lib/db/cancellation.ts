/**
 * Cancellation Handling with Auto-Replacement
 * Handles shift cancellations and automatically finds replacement personnel
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { autoAssignShifts, type AssignmentResult } from './assignment';

type TypedSupabaseClient = SupabaseClient<any>;

export interface CancellationRequest {
  shiftId: string;
  cancelledBy: 'venue' | 'personnel' | 'agency';
  reason?: string;
  findReplacement?: boolean;
  notificationHours?: number; // Hours of notice given
}

export interface CancellationResult {
  success: boolean;
  shiftCancelled: boolean;
  replacementFound: boolean;
  replacementShiftId?: string;
  replacementPersonnelName?: string;
  error?: string;
  penaltyApplied?: boolean;
  refundIssued?: boolean;
}

/**
 * Handle a shift cancellation with optional auto-replacement
 */
export async function handleShiftCancellation(
  supabase: TypedSupabaseClient,
  request: CancellationRequest
): Promise<CancellationResult> {
  const { shiftId, cancelledBy, reason, findReplacement = true, notificationHours } = request;

  // Get the shift details
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select(`
      id,
      booking_id,
      personnel_id,
      agency_id,
      role,
      hourly_rate,
      scheduled_start,
      scheduled_end,
      status,
      personnel:personnel(id, user_id, display_name),
      booking:bookings(
        id,
        event_name,
        venue_id,
        venues(id, name, owner_id)
      )
    `)
    .eq('id', shiftId)
    .single();

  if (shiftError || !shift) {
    return { 
      success: false, 
      shiftCancelled: false, 
      replacementFound: false, 
      error: 'Shift not found' 
    };
  }

  // Check if shift can be cancelled
  if (['checked_out', 'cancelled', 'no_show'].includes(shift.status)) {
    return { 
      success: false, 
      shiftCancelled: false, 
      replacementFound: false, 
      error: `Cannot cancel shift with status: ${shift.status}` 
    };
  }

  // Calculate hours until shift
  const now = new Date();
  const shiftStart = new Date(shift.scheduled_start);
  const hoursUntilShift = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  const actualNoticeHours = notificationHours ?? hoursUntilShift;

  // Apply cancellation
  const { error: cancelError } = await supabase
    .from('shifts')
    .update({
      status: 'cancelled',
      cancelled_at: now.toISOString(),
      cancellation_reason: reason || null,
      cancelled_by: cancelledBy,
    })
    .eq('id', shiftId);

  if (cancelError) {
    return { 
      success: false, 
      shiftCancelled: false, 
      replacementFound: false, 
      error: cancelError.message 
    };
  }

  const result: CancellationResult = {
    success: true,
    shiftCancelled: true,
    replacementFound: false,
  };

  // Apply penalties if cancellation is late
  if (cancelledBy === 'personnel' && shift.personnel_id) {
    result.penaltyApplied = await applyLatePersonnelCancellationPenalty(
      supabase,
      shift.personnel_id,
      actualNoticeHours
    );
  }

  // Notify affected parties
  await sendCancellationNotifications(supabase, shift, cancelledBy, reason, actualNoticeHours);

  // Try to find replacement if requested and shift hasn't started yet
  if (findReplacement && hoursUntilShift > 0) {
    const replacementResult = await findReplacementPersonnel(supabase, shift);
    
    if (replacementResult.success && replacementResult.shiftId) {
      result.replacementFound = true;
      result.replacementShiftId = replacementResult.shiftId;
      result.replacementPersonnelName = replacementResult.personnelName;
    }
  }

  return result;
}

/**
 * Apply penalty to personnel for late cancellation
 */
async function applyLatePersonnelCancellationPenalty(
  supabase: TypedSupabaseClient,
  personnelId: string,
  hoursNotice: number
): Promise<boolean> {
  // Penalty tiers:
  // 48+ hours: No penalty
  // 24-48 hours: -5 Shield Score
  // 12-24 hours: -10 Shield Score
  // 6-12 hours: -15 Shield Score
  // <6 hours: -20 Shield Score

  let pointsChange = 0;
  if (hoursNotice < 6) {
    pointsChange = -20;
  } else if (hoursNotice < 12) {
    pointsChange = -15;
  } else if (hoursNotice < 24) {
    pointsChange = -10;
  } else if (hoursNotice < 48) {
    pointsChange = -5;
  }

  if (pointsChange === 0) {
    return false; // No penalty for adequate notice
  }

  // Record in shield score history
  await supabase.from('shield_score_history').insert({
    personnel_id: personnelId,
    event_type: 'late_cancellation',
    points_change: pointsChange,
    details: {
      hours_notice: Math.round(hoursNotice * 10) / 10,
    },
    created_at: new Date().toISOString(),
  });

  // Update personnel's shield score
  const { data: currentScore } = await supabase
    .from('personnel')
    .select('shield_score')
    .eq('id', personnelId)
    .single();

  if (currentScore) {
    const newScore = Math.max(0, (currentScore.shield_score || 50) + pointsChange);
    await supabase
      .from('personnel')
      .update({ shield_score: newScore })
      .eq('id', personnelId);
  }

  return true;
}

/**
 * Send notifications for a cancellation
 */
async function sendCancellationNotifications(
  supabase: TypedSupabaseClient,
  shift: any,
  cancelledBy: string,
  reason: string | undefined,
  hoursNotice: number
): Promise<void> {
  const venueName = shift.booking?.venues?.name || 'Unknown Venue';
  const venueOwnerId = shift.booking?.venues?.owner_id;
  const eventName = shift.booking?.event_name || 'Shift';
  const personnelUserId = shift.personnel?.user_id;
  const personnelName = shift.personnel?.display_name || 'Unknown';
  const shiftDate = new Date(shift.scheduled_start).toLocaleDateString('en-GB');

  const isUrgent = hoursNotice < 6;
  const urgencyPrefix = isUrgent ? '🚨 URGENT: ' : '⚠️ ';

  // Notify venue if personnel cancelled
  if (cancelledBy === 'personnel' && venueOwnerId) {
    await supabase.from('notifications').insert({
      user_id: venueOwnerId,
      type: 'alert',
      title: `${urgencyPrefix}Staff Cancelled`,
      body: `${personnelName} cancelled their shift for "${eventName}" on ${shiftDate}${reason ? `. Reason: ${reason}` : ''}. ${isUrgent ? 'Finding replacement urgently.' : 'Finding replacement.'}`,
      data: {
        shift_id: shift.id,
        booking_id: shift.booking_id,
        priority: isUrgent ? 'high' : 'normal',
        needs_replacement: true,
      },
    });
  }

  // Notify personnel if venue/agency cancelled
  if (cancelledBy !== 'personnel' && personnelUserId) {
    const cancellerLabel = cancelledBy === 'venue' ? 'The venue' : 'Your agency';
    await supabase.from('notifications').insert({
      user_id: personnelUserId,
      type: 'shift',
      title: '🚫 Shift Cancelled',
      body: `${cancellerLabel} cancelled your shift at ${venueName} on ${shiftDate}${reason ? `. Reason: ${reason}` : ''}`,
      data: {
        shift_id: shift.id,
        booking_id: shift.booking_id,
      },
    });
  }
}

/**
 * Find and assign replacement personnel for a cancelled shift
 */
async function findReplacementPersonnel(
  supabase: TypedSupabaseClient,
  originalShift: any
): Promise<{
  success: boolean;
  shiftId?: string;
  personnelName?: string;
}> {
  const bookingId = originalShift.booking_id;

  // Use the auto-assignment system to find a replacement
  // It will prioritize available personnel with good Shield Scores
  const results = await autoAssignShifts(supabase, bookingId, {
    minShieldScore: 40, // Accept slightly lower scores for urgent replacement
    prioritizeDistance: true,
  });

  // Find if any shifts got assigned (there should be at least one open slot now)
  const successfulAssignment = results.find((r: AssignmentResult) => r.assigned);

  if (successfulAssignment) {
    // Get the personnel name for the notification
    const { data: newShift } = await supabase
      .from('shifts')
      .select('id, personnel:personnel(display_name)')
      .eq('id', successfulAssignment.shiftId)
      .single();

    if (newShift) {
      // Notify venue about successful replacement
      const venueOwnerId = originalShift.booking?.venues?.owner_id;
      if (venueOwnerId) {
        const personnelName = (newShift as any).personnel?.display_name || 'A new guard';
        await supabase.from('notifications').insert({
          user_id: venueOwnerId,
          type: 'shift',
          title: '✅ Replacement Found',
          body: `${personnelName} has been assigned to cover the cancelled shift.`,
          data: {
            shift_id: newShift.id,
            booking_id: bookingId,
            is_replacement: true,
          },
        });
      }

      return {
        success: true,
        shiftId: newShift.id,
        personnelName: (newShift as any).personnel?.display_name,
      };
    }
  }

  // No automatic replacement found - notify venue to manually fill
  const venueOwnerId = originalShift.booking?.venues?.owner_id;
  if (venueOwnerId) {
    await supabase.from('notifications').insert({
      user_id: venueOwnerId,
      type: 'alert',
      title: '⚠️ No Replacement Found',
      body: 'We couldn\'t automatically find a replacement. Please post to the marketplace or contact staff directly.',
      data: {
        booking_id: bookingId,
        needs_manual_assignment: true,
      },
    });
  }

  return { success: false };
}

/**
 * Get cancellation policy text based on hours until shift
 */
export function getCancellationPolicy(hoursUntilShift: number): {
  canCancel: boolean;
  penaltyLevel: 'none' | 'low' | 'medium' | 'high' | 'severe';
  penaltyDescription: string;
  shieldScoreImpact: number;
} {
  if (hoursUntilShift >= 48) {
    return {
      canCancel: true,
      penaltyLevel: 'none',
      penaltyDescription: 'No penalty - adequate notice provided',
      shieldScoreImpact: 0,
    };
  } else if (hoursUntilShift >= 24) {
    return {
      canCancel: true,
      penaltyLevel: 'low',
      penaltyDescription: 'Minor penalty for late notice',
      shieldScoreImpact: -5,
    };
  } else if (hoursUntilShift >= 12) {
    return {
      canCancel: true,
      penaltyLevel: 'medium',
      penaltyDescription: 'Moderate penalty for short notice',
      shieldScoreImpact: -10,
    };
  } else if (hoursUntilShift >= 6) {
    return {
      canCancel: true,
      penaltyLevel: 'high',
      penaltyDescription: 'Significant penalty for very short notice',
      shieldScoreImpact: -15,
    };
  } else if (hoursUntilShift > 0) {
    return {
      canCancel: true,
      penaltyLevel: 'severe',
      penaltyDescription: 'Severe penalty - emergency cancellation',
      shieldScoreImpact: -20,
    };
  } else {
    return {
      canCancel: false,
      penaltyLevel: 'severe',
      penaltyDescription: 'Cannot cancel - shift already started',
      shieldScoreImpact: -25,
    };
  }
}

/**
 * Check if a booking has unfilled shifts and alert the venue
 */
export async function checkBookingCoverage(
  supabase: TypedSupabaseClient,
  bookingId: string
): Promise<{
  fullyStaffed: boolean;
  assignedCount: number;
  requiredCount: number;
  openSlots: number;
}> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('staff_requirements')
    .eq('id', bookingId)
    .single();

  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, status')
    .eq('booking_id', bookingId)
    .in('status', ['pending', 'accepted', 'checked_in']);

  // Calculate required from staff_requirements
  const requirements = booking?.staff_requirements || [];
  const requiredCount = (requirements as any[]).reduce((sum, req) => sum + (req.count || 0), 0);
  const assignedCount = shifts?.length || 0;
  const openSlots = Math.max(0, requiredCount - assignedCount);

  return {
    fullyStaffed: openSlots === 0,
    assignedCount,
    requiredCount,
    openSlots,
  };
}
