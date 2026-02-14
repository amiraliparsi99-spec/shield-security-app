import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Personnel, Shift } from '../database.types';
import { checkPersonnelAvailabilityDetailed, type AvailabilityCheckResult } from './availability';

type TypedSupabaseClient = SupabaseClient<Database>;

export interface AssignmentCandidate {
  personnel: Personnel;
  availabilityInfo: AvailabilityCheckResult;
  score: number;
  breakdown: {
    shieldScore: number;
    distanceScore: number;
    skillScore: number;
    reliabilityScore: number;
    availabilityScore: number;
  };
}

export interface AssignmentResult {
  shiftId: string;
  personnelId: string | null;
  assigned: boolean;
  reason?: string;
  candidate?: AssignmentCandidate;
}

export interface AutoAssignmentOptions {
  prioritizeShieldScore?: boolean;
  prioritizeDistance?: boolean;
  prioritizeSkillMatch?: boolean;
  maxDistance?: number; // km
  minShieldScore?: number;
  preferredPersonnelIds?: string[];
  excludePersonnelIds?: string[];
}

/**
 * Calculate assignment score for a candidate
 */
function calculateAssignmentScore(
  personnel: Personnel,
  role: string,
  venueLocation?: { latitude: number; longitude: number },
  options?: AutoAssignmentOptions
): { score: number; breakdown: AssignmentCandidate['breakdown'] } {
  let shieldScore = 0;
  let distanceScore = 0;
  let skillScore = 0;
  let reliabilityScore = 0;
  let availabilityScore = 100; // Base availability score

  // Shield Score (0-100 points, max 30% weight)
  shieldScore = Math.min(100, (personnel.shield_score || 0));

  // Distance Score (0-100 points, max 20% weight)
  if (venueLocation && personnel.latitude && personnel.longitude) {
    const distance = calculateDistance(
      venueLocation.latitude,
      venueLocation.longitude,
      personnel.latitude,
      personnel.longitude
    );
    const maxDistance = options?.maxDistance || personnel.max_travel_distance || 30;
    if (distance <= maxDistance) {
      distanceScore = Math.max(0, 100 - (distance / maxDistance) * 100);
    } else {
      distanceScore = 0; // Too far
    }
  } else {
    distanceScore = 50; // Unknown distance, neutral score
  }

  // Skill Match Score (0-100 points, max 25% weight)
  const skills = personnel.skills || [];
  const roleKeywords = role.toLowerCase().split(/[\s_-]+/);
  const matchingSkills = skills.filter((skill: string) =>
    roleKeywords.some(keyword => skill.toLowerCase().includes(keyword))
  );
  skillScore = skills.length > 0 
    ? Math.min(100, (matchingSkills.length / Math.max(1, roleKeywords.length)) * 100)
    : 50;

  // Reliability Score (0-100 points, max 25% weight)
  reliabilityScore = personnel.reliability_score || 50;

  // Calculate weighted total
  const weights = {
    shield: options?.prioritizeShieldScore ? 0.35 : 0.25,
    distance: options?.prioritizeDistance ? 0.25 : 0.20,
    skill: options?.prioritizeSkillMatch ? 0.30 : 0.25,
    reliability: 0.20,
    availability: 0.10,
  };

  // Normalize weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / totalWeight])
  );

  const totalScore =
    shieldScore * normalizedWeights.shield +
    distanceScore * normalizedWeights.distance +
    skillScore * normalizedWeights.skill +
    reliabilityScore * normalizedWeights.reliability +
    availabilityScore * normalizedWeights.availability;

  return {
    score: Math.round(totalScore * 100) / 100,
    breakdown: {
      shieldScore: Math.round(shieldScore),
      distanceScore: Math.round(distanceScore),
      skillScore: Math.round(skillScore),
      reliabilityScore: Math.round(reliabilityScore),
      availabilityScore: Math.round(availabilityScore),
    },
  };
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Find best candidates for a shift
 */
export async function findCandidatesForShift(
  supabase: TypedSupabaseClient,
  shift: Shift,
  venueLocation?: { latitude: number; longitude: number },
  options?: AutoAssignmentOptions
): Promise<AssignmentCandidate[]> {
  // Get shift details
  const shiftDate = new Date(shift.scheduled_start).toISOString().split('T')[0];
  const startTime = new Date(shift.scheduled_start).toTimeString().slice(0, 5);
  const endTime = new Date(shift.scheduled_end).toTimeString().slice(0, 5);

  // Get all active personnel - be more lenient for testing
  let query = supabase
    .from('personnel')
    .select('*');

  // Only filter by is_active if they have the field set
  // This allows new personnel who haven't set up everything to still be found
  
  const { data: allPersonnel, error } = await query;

  if (error || !allPersonnel) {
    console.error('Error fetching personnel:', error);
    return [];
  }

  console.log(`Found ${allPersonnel.length} total personnel in database`);
  
  // Log personnel status for debugging
  allPersonnel.forEach(p => {
    console.log(`Personnel: ${p.display_name || p.id} - active: ${p.is_active}, available: ${p.is_available}, shield_score: ${p.shield_score}`);
  });
  
  // Filter to active/available (but be lenient - treat null as true for new accounts)
  const availablePersonnel = allPersonnel.filter(p => 
    (p.is_active === true || p.is_active === null) && 
    (p.is_available === true || p.is_available === null)
  );
  
  console.log(`${availablePersonnel.length} personnel are active/available`);

  // Filter and score candidates
  const candidates: AssignmentCandidate[] = [];

  for (const person of availablePersonnel) {
    // Skip excluded personnel
    if (options?.excludePersonnelIds?.includes(person.id)) {
      continue;
    }

    // Check availability - but be lenient for testing
    const availabilityInfo = await checkPersonnelAvailabilityDetailed(
      supabase,
      person.id,
      shiftDate,
      startTime,
      endTime
    );

    console.log(`Availability for ${person.display_name || person.id}:`, JSON.stringify(availabilityInfo));

    // Be lenient: skip availability check if they just haven't set it up yet
    // Only block if they have a conflicting shift or explicitly blocked the date
    const strictBlockReasons = [
      'Date is blocked',
      'Already has a shift at this time',
    ];
    
    if (!availabilityInfo.available) {
      const isStrictBlock = strictBlockReasons.some(r => availabilityInfo.reason?.includes(r));
      if (isStrictBlock) {
        console.log(`Skipping ${person.display_name} - hard block: ${availabilityInfo.reason}`);
        continue;
      }
      // For soft blocks (no availability set), continue anyway for testing
      console.log(`${person.display_name} has soft availability issue: ${availabilityInfo.reason} - including anyway for testing`);
    }

    // Calculate score
    const { score, breakdown } = calculateAssignmentScore(
      person,
      shift.role || 'Security',
      venueLocation,
      options
    );

    // Boost score for preferred personnel
    const finalScore = options?.preferredPersonnelIds?.includes(person.id)
      ? Math.min(100, score + 20)
      : score;

    candidates.push({
      personnel: person,
      availabilityInfo,
      score: finalScore,
      breakdown,
    });
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

/**
 * Auto-assign personnel to unassigned shifts for a booking
 */
export async function autoAssignShifts(
  supabase: TypedSupabaseClient,
  bookingId: string,
  options?: AutoAssignmentOptions
): Promise<AssignmentResult[]> {
  const results: AssignmentResult[] = [];
  const assignedPersonnelIds: string[] = [];

  // Get booking with venue info
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(*)
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('Error fetching booking:', JSON.stringify(bookingError, null, 2));
    console.error('Booking error details:', bookingError?.message, bookingError?.code);
    return [];
  }

  const venueLocation = booking.venue?.latitude && booking.venue?.longitude
    ? { latitude: booking.venue.latitude, longitude: booking.venue.longitude }
    : undefined;

  // Get unassigned shifts for this booking
  // Valid shift_status: 'pending', 'accepted', 'declined', 'checked_in', 'checked_out', 'no_show', 'cancelled'
  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('*')
    .eq('booking_id', bookingId)
    .is('personnel_id', null)
    .eq('status', 'pending');

  if (shiftsError) {
    console.error('Error fetching shifts:', JSON.stringify(shiftsError, null, 2));
    console.error('Shift error details:', shiftsError?.message, shiftsError?.code, shiftsError?.hint);
    return [];
  }
  
  if (!shifts || shifts.length === 0) {
    console.log('No unassigned shifts found for booking:', bookingId);
    return [];
  }

  // Process each shift
  for (const shift of shifts) {
    // Find candidates excluding already assigned personnel
    const candidates = await findCandidatesForShift(
      supabase,
      shift,
      venueLocation,
      {
        ...options,
        excludePersonnelIds: [
          ...(options?.excludePersonnelIds || []),
          ...assignedPersonnelIds,
        ],
      }
    );

    if (candidates.length === 0) {
      results.push({
        shiftId: shift.id,
        personnelId: null,
        assigned: false,
        reason: 'No available candidates found',
      });
      continue;
    }

    // Assign the best candidate
    const bestCandidate = candidates[0];
    
    // Valid status: 'pending' until personnel accepts (then 'accepted')
    const { error: updateError } = await supabase
      .from('shifts')
      .update({
        personnel_id: bestCandidate.personnel.id,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', shift.id);

    if (updateError) {
      results.push({
        shiftId: shift.id,
        personnelId: null,
        assigned: false,
        reason: `Failed to assign: ${updateError.message}`,
      });
      continue;
    }

    // Create notification for the assigned personnel
    await supabase.from('notifications').insert({
      user_id: bestCandidate.personnel.user_id,
      type: 'shift',
      title: 'New Shift Offer',
      body: `You have been offered a ${shift.role || 'Security'} shift on ${new Date(shift.scheduled_start).toLocaleDateString()}`,
      data: { booking_id: bookingId, shift_id: shift.id },
    });

    assignedPersonnelIds.push(bestCandidate.personnel.id);
    
    results.push({
      shiftId: shift.id,
      personnelId: bestCandidate.personnel.id,
      assigned: true,
      candidate: bestCandidate,
    });
  }

  return results;
}

/**
 * Suggest best replacements for a specific shift
 */
export async function suggestReplacements(
  supabase: TypedSupabaseClient,
  shiftId: string,
  limit: number = 5,
  options?: AutoAssignmentOptions
): Promise<AssignmentCandidate[]> {
  // Get shift details
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select(`
      *,
      booking:bookings(
        *,
        venue:venues(*)
      )
    `)
    .eq('id', shiftId)
    .single();

  if (shiftError || !shift) {
    console.error('Error fetching shift:', shiftError);
    return [];
  }

  const venueLocation = shift.booking?.venue?.latitude && shift.booking?.venue?.longitude
    ? { latitude: shift.booking.venue.latitude, longitude: shift.booking.venue.longitude }
    : undefined;

  // Get existing assigned personnel for this booking (to exclude)
  const { data: bookingShifts } = await supabase
    .from('shifts')
    .select('personnel_id')
    .eq('booking_id', shift.booking_id)
    .not('personnel_id', 'is', null);

  const excludeIds = bookingShifts?.map(s => s.personnel_id).filter(Boolean) as string[] || [];

  const candidates = await findCandidatesForShift(
    supabase,
    shift,
    venueLocation,
    {
      ...options,
      excludePersonnelIds: excludeIds,
    }
  );

  return candidates.slice(0, limit);
}

/**
 * Re-assign a shift to a new personnel
 */
export async function reassignShift(
  supabase: TypedSupabaseClient,
  shiftId: string,
  newPersonnelId: string,
  notifyPrevious: boolean = true
): Promise<boolean> {
  // Get current shift
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('*, booking:bookings(*)')
    .eq('id', shiftId)
    .single();

  if (shiftError || !shift) {
    console.error('Error fetching shift:', shiftError);
    return false;
  }

  const previousPersonnelId = shift.personnel_id;

  // Update shift - keep 'pending' until personnel accepts
  const { error: updateError } = await supabase
    .from('shifts')
    .update({
      personnel_id: newPersonnelId,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', shiftId);

  if (updateError) {
    console.error('Error updating shift:', updateError);
    return false;
  }

  // Get new personnel user_id
  const { data: newPersonnel } = await supabase
    .from('personnel')
    .select('user_id')
    .eq('id', newPersonnelId)
    .single();

  if (newPersonnel) {
    // Notify new personnel
    await supabase.from('notifications').insert({
      user_id: newPersonnel.user_id,
      type: 'shift',
      title: 'New Shift Offer',
      body: `You have been assigned a shift on ${new Date(shift.scheduled_start).toLocaleDateString()}`,
      data: { booking_id: shift.booking_id, shift_id: shiftId },
    });
  }

  // Notify previous personnel if requested
  if (notifyPrevious && previousPersonnelId) {
    const { data: prevPersonnel } = await supabase
      .from('personnel')
      .select('user_id')
      .eq('id', previousPersonnelId)
      .single();

    if (prevPersonnel) {
      await supabase.from('notifications').insert({
        user_id: prevPersonnel.user_id,
        type: 'shift',
        title: 'Shift Reassigned',
        body: `Your shift on ${new Date(shift.scheduled_start).toLocaleDateString()} has been reassigned`,
        data: { booking_id: shift.booking_id, shift_id: shiftId },
      });
    }
  }

  return true;
}
