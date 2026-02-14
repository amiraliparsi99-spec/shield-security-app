/**
 * Agency Shift Assignment Integration
 * Bridges agency staff assignments to the main shifts system
 */

import { SupabaseClient } from '@supabase/supabase-js';

type TypedSupabaseClient = SupabaseClient<any>;

export interface AgencyShiftAssignment {
  bookingId: string;
  personnelId: string;
  agencyId: string;
  agencyStaffId: string;
  role: string;
  hourlyRate: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface AssignmentResult {
  success: boolean;
  shiftId?: string;
  assignmentId?: string;
  error?: string;
}

/**
 * Assign agency staff to a booking by creating a shift
 * This creates both the shift record and the booking_assignment record
 */
export async function assignAgencyStaffToBooking(
  supabase: TypedSupabaseClient,
  params: AgencyShiftAssignment
): Promise<AssignmentResult> {
  const {
    bookingId,
    personnelId,
    agencyId,
    agencyStaffId,
    role,
    hourlyRate,
    scheduledStart,
    scheduledEnd,
  } = params;

  // Verify the agency staff exists and is active
  const { data: agencyStaff, error: staffError } = await supabase
    .from('agency_staff')
    .select('id, agency_id, personnel_id, status')
    .eq('id', agencyStaffId)
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .single();

  if (staffError || !agencyStaff) {
    return { success: false, error: 'Agency staff not found or inactive' };
  }

  // Get agency commission rate
  const { data: agency } = await supabase
    .from('agencies')
    .select('commission_rate')
    .eq('id', agencyId)
    .single();

  const commissionRate = agency?.commission_rate || 0.15;
  const agencyCommission = Math.round(hourlyRate * commissionRate * 100) / 100;

  // Create the shift (set to 'pending' until staff confirms)
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .insert({
      booking_id: bookingId,
      personnel_id: personnelId,
      agency_id: agencyId,
      role,
      hourly_rate: hourlyRate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: 'pending',
      agency_commission: agencyCommission,
    })
    .select('id')
    .single();

  if (shiftError) {
    console.error('Error creating shift:', shiftError);
    return { success: false, error: shiftError.message };
  }

  // Create the booking_assignment record for agency tracking
  const { data: assignment, error: assignmentError } = await supabase
    .from('booking_assignments')
    .insert({
      booking_id: bookingId,
      agency_staff_id: agencyStaffId,
      shift_id: shift.id,
      status: 'assigned',
    })
    .select('id')
    .single();

  if (assignmentError) {
    // Roll back the shift if assignment fails
    await supabase.from('shifts').delete().eq('id', shift.id);
    console.error('Error creating assignment:', assignmentError);
    return { success: false, error: assignmentError.message };
  }

  // Notify the personnel about the new shift
  const { data: personnel } = await supabase
    .from('personnel')
    .select('user_id')
    .eq('id', personnelId)
    .single();

  if (personnel?.user_id) {
    // Get booking details for notification
    const { data: booking } = await supabase
      .from('bookings')
      .select('event_name, venue:venues(name)')
      .eq('id', bookingId)
      .single();

    const venueName = (booking as any)?.venue?.name || 'Unknown Venue';
    const eventName = booking?.event_name || 'Shift';
    const shiftDate = new Date(scheduledStart).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const shiftTime = new Date(scheduledStart).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await supabase.from('notifications').insert({
      user_id: personnel.user_id,
      type: 'shift',
      title: '📋 New Shift Assignment',
      body: `You've been assigned to ${eventName} at ${venueName} on ${shiftDate} at ${shiftTime}. Please confirm.`,
      data: { 
        shift_id: shift.id, 
        booking_id: bookingId,
        agency_id: agencyId,
        action: 'confirm_shift',
      },
    });
  }

  return { 
    success: true, 
    shiftId: shift.id, 
    assignmentId: assignment.id 
  };
}

/**
 * Remove an agency staff assignment
 * Deletes both the shift and the booking_assignment
 */
export async function removeAgencyStaffAssignment(
  supabase: TypedSupabaseClient,
  assignmentId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Get the assignment with shift info
  const { data: assignment, error: fetchError } = await supabase
    .from('booking_assignments')
    .select('id, shift_id, agency_staff:agency_staff(personnel:personnel(user_id))')
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    return { success: false, error: 'Assignment not found' };
  }

  // Update the shift status to cancelled
  if (assignment.shift_id) {
    await supabase
      .from('shifts')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Unassigned by agency',
        cancelled_by: 'agency',
      })
      .eq('id', assignment.shift_id);

    // Notify the personnel
    const personnelUserId = (assignment as any)?.agency_staff?.personnel?.user_id;
    if (personnelUserId) {
      await supabase.from('notifications').insert({
        user_id: personnelUserId,
        type: 'shift',
        title: '🚫 Shift Cancelled',
        body: reason 
          ? `Your shift has been cancelled: ${reason}`
          : 'Your shift assignment has been removed by the agency.',
        data: { shift_id: assignment.shift_id },
      });
    }
  }

  // Delete the assignment record
  const { error: deleteError } = await supabase
    .from('booking_assignments')
    .delete()
    .eq('id', assignmentId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  return { success: true };
}

/**
 * Bulk assign multiple staff to a booking
 */
export async function bulkAssignAgencyStaff(
  supabase: TypedSupabaseClient,
  bookingId: string,
  agencyId: string,
  assignments: Array<{
    agencyStaffId: string;
    personnelId: string;
    role: string;
  }>,
  shiftDetails: {
    hourlyRate: number;
    scheduledStart: string;
    scheduledEnd: string;
  }
): Promise<{
  success: boolean;
  results: AssignmentResult[];
}> {
  const results: AssignmentResult[] = [];

  for (const assignment of assignments) {
    const result = await assignAgencyStaffToBooking(supabase, {
      bookingId,
      personnelId: assignment.personnelId,
      agencyId,
      agencyStaffId: assignment.agencyStaffId,
      role: assignment.role,
      hourlyRate: shiftDetails.hourlyRate,
      scheduledStart: shiftDetails.scheduledStart,
      scheduledEnd: shiftDetails.scheduledEnd,
    });
    results.push(result);
  }

  return {
    success: results.every(r => r.success),
    results,
  };
}

/**
 * Get agency's active assignments for a booking
 */
export async function getAgencyBookingAssignments(
  supabase: TypedSupabaseClient,
  agencyId: string,
  bookingId: string
): Promise<Array<{
  assignmentId: string;
  shiftId: string;
  status: string;
  personnel: {
    id: string;
    displayName: string;
    shieldScore: number;
  };
}>> {
  const { data, error } = await supabase
    .from('booking_assignments')
    .select(`
      id,
      status,
      shift_id,
      shifts(
        id,
        status,
        personnel:personnel(id, display_name, shield_score)
      ),
      agency_staff(
        id,
        personnel:personnel(id, display_name, shield_score)
      )
    `)
    .eq('booking_id', bookingId)
    .in('status', ['assigned', 'confirmed']);

  if (error || !data) {
    return [];
  }

  return data.map((a: any) => ({
    assignmentId: a.id,
    shiftId: a.shift_id,
    status: a.status,
    personnel: {
      id: a.agency_staff?.personnel?.id || a.shifts?.personnel?.id,
      displayName: a.agency_staff?.personnel?.display_name || 'Unknown',
      shieldScore: a.agency_staff?.personnel?.shield_score || 0,
    },
  }));
}
