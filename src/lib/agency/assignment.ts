/**
 * Smart Staff Assignment Algorithm
 * 
 * Ranks available staff based on:
 * 1. Availability (highest weight)
 * 2. Certification match
 * 3. Past performance/ratings
 * 4. Venue familiarity
 */

import { createClient } from "@/lib/supabase/client";
import type { AgencyStaffWithPersonnel, Booking } from "@/types/database";

interface StaffScore {
  staff: AgencyStaffWithPersonnel;
  score: number;
  breakdown: {
    availability: number;
    certifications: number;
    performance: number;
    venueFamiliarity: number;
  };
}

interface BookingRequirements {
  id: string;
  start: string;
  end: string;
  venue_id: string;
  certs_required?: string[];
}

/**
 * Check if a staff member is available for a given time slot
 */
async function checkAvailability(
  supabase: any,
  personnelId: string,
  start: Date,
  end: Date
): Promise<boolean> {
  // Check availability table
  const { data: availability } = await supabase
    .from("availability")
    .select("*")
    .eq("owner_type", "personnel")
    .eq("owner_id", personnelId)
    .lte("start", end.toISOString())
    .gte("end", start.toISOString());

  // If they have marked availability that includes this slot, they're available
  if (availability && availability.length > 0) {
    return true;
  }

  // Check for conflicting bookings
  const { data: conflicts } = await supabase
    .from("booking_assignments")
    .select(`
      id,
      booking:bookings(start, end)
    `)
    .eq("agency_staff_id", personnelId)
    .in("status", ["assigned", "confirmed"]);

  if (conflicts) {
    for (const assignment of conflicts) {
      const booking = assignment.booking;
      if (!booking) continue;

      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);

      // Check for overlap
      if (start < bookingEnd && end > bookingStart) {
        return false; // Conflict found
      }
    }
  }

  return true;
}

/**
 * Calculate certification match score
 */
function calculateCertMatch(staffCerts: string[], requiredCerts: string[]): number {
  if (!requiredCerts || requiredCerts.length === 0) {
    return 1; // Full score if no certs required
  }

  if (!staffCerts || staffCerts.length === 0) {
    return 0;
  }

  const staffCertsLower = staffCerts.map((c) => c.toLowerCase());
  const matches = requiredCerts.filter((cert) =>
    staffCertsLower.includes(cert.toLowerCase())
  ).length;

  return matches / requiredCerts.length;
}

/**
 * Get average rating for a personnel member
 */
async function getAverageRating(
  supabase: any,
  personnelId: string
): Promise<number> {
  const { data: reviews } = await supabase
    .from("personnel_reviews")
    .select("rating")
    .eq("personnel_id", personnelId);

  if (!reviews || reviews.length === 0) {
    return 3; // Default neutral rating
  }

  const sum = reviews.reduce((acc: number, r: any) => acc + r.rating, 0);
  return sum / reviews.length;
}

/**
 * Check if staff has worked at this venue before
 */
async function hasWorkedAtVenue(
  supabase: any,
  agencyStaffId: string,
  venueId: string
): Promise<boolean> {
  const { data: pastAssignments } = await supabase
    .from("booking_assignments")
    .select(`
      id,
      booking:bookings(venue_id)
    `)
    .eq("agency_staff_id", agencyStaffId)
    .eq("status", "completed");

  if (!pastAssignments) return false;

  return pastAssignments.some(
    (a: any) => a.booking?.venue_id === venueId
  );
}

/**
 * Calculate overall staff score for a booking
 */
async function calculateStaffScore(
  supabase: any,
  staff: AgencyStaffWithPersonnel,
  requirements: BookingRequirements
): Promise<StaffScore> {
  const start = new Date(requirements.start);
  const end = new Date(requirements.end);

  // Availability (50 points max)
  const isAvailable = await checkAvailability(
    supabase,
    staff.personnel_id,
    start,
    end
  );
  const availabilityScore = isAvailable ? 50 : 0;

  // Certification match (30 points max)
  const certMatch = calculateCertMatch(
    staff.personnel.certs || [],
    requirements.certs_required || []
  );
  const certScore = certMatch * 30;

  // Past performance (10 points max)
  const avgRating = await getAverageRating(supabase, staff.personnel_id);
  const performanceScore = (avgRating / 5) * 10;

  // Venue familiarity (10 points max)
  const familiar = await hasWorkedAtVenue(
    supabase,
    staff.id,
    requirements.venue_id
  );
  const familiarityScore = familiar ? 10 : 0;

  const totalScore = availabilityScore + certScore + performanceScore + familiarityScore;

  return {
    staff,
    score: totalScore,
    breakdown: {
      availability: availabilityScore,
      certifications: certScore,
      performance: performanceScore,
      venueFamiliarity: familiarityScore,
    },
  };
}

/**
 * Get available staff for a booking (not already assigned)
 */
export async function getAvailableStaff(
  agencyId: string,
  bookingId: string
): Promise<AgencyStaffWithPersonnel[]> {
  const supabase = createClient();

  // Get all active staff
  const { data: allStaff } = await supabase
    .from("agency_staff")
    .select(`
      *,
      personnel:personnel(*)
    `)
    .eq("agency_id", agencyId)
    .eq("status", "active");

  if (!allStaff) return [];

  // Get already assigned staff
  const { data: assignments } = await supabase
    .from("booking_assignments")
    .select("agency_staff_id")
    .eq("booking_id", bookingId);

  const assignedIds = new Set(
    (assignments || []).map((a) => a.agency_staff_id)
  );

  // Filter out assigned staff
  return allStaff.filter((s) => !assignedIds.has(s.id));
}

/**
 * Suggest best staff for a booking, ranked by score
 */
export async function suggestStaffForBooking(
  agencyId: string,
  bookingId: string,
  limit: number = 10
): Promise<StaffScore[]> {
  const supabase = createClient();

  // Get booking details
  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id,
      start,
      end,
      venue_id,
      request:requests(certs_required)
    `)
    .eq("id", bookingId)
    .single();

  if (!booking) return [];

  const requirements: BookingRequirements = {
    id: booking.id,
    start: booking.start,
    end: booking.end,
    venue_id: booking.venue_id,
    certs_required: booking.request?.certs_required,
  };

  // Get available staff
  const availableStaff = await getAvailableStaff(agencyId, bookingId);

  if (availableStaff.length === 0) return [];

  // Calculate scores for each staff member
  const scoredStaff = await Promise.all(
    availableStaff.map((staff) =>
      calculateStaffScore(supabase, staff, requirements)
    )
  );

  // Sort by score (highest first) and limit
  return scoredStaff
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Bulk assign staff to a booking
 */
export async function assignStaffToBooking(
  bookingId: string,
  agencyStaffIds: string[]
): Promise<{ success: boolean; assignmentIds: string[]; error?: string }> {
  const supabase = createClient();

  try {
    const assignments = agencyStaffIds.map((staffId) => ({
      booking_id: bookingId,
      agency_staff_id: staffId,
      status: "assigned" as const,
    }));

    const { data, error } = await supabase
      .from("booking_assignments")
      .insert(assignments)
      .select("id");

    if (error) {
      return { success: false, assignmentIds: [], error: error.message };
    }

    return {
      success: true,
      assignmentIds: data.map((a) => a.id),
    };
  } catch (error: any) {
    return {
      success: false,
      assignmentIds: [],
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Notify staff of their assignment (placeholder for future notification system)
 */
export async function notifyStaffOfAssignment(
  assignmentIds: string[]
): Promise<void> {
  // TODO: Implement notification system
  // This could send:
  // - Push notifications to mobile app
  // - In-app notifications
  // - SMS/Email (optional)
  
  console.log(`[Assignment Notification] Would notify for assignments: ${assignmentIds.join(", ")}`);
}

/**
 * Get assignment statistics for an agency
 */
export async function getAssignmentStats(agencyId: string) {
  const supabase = createClient();

  // Get all staff IDs for this agency
  const { data: staff } = await supabase
    .from("agency_staff")
    .select("id")
    .eq("agency_id", agencyId);

  if (!staff || staff.length === 0) {
    return {
      totalAssignments: 0,
      pendingConfirmations: 0,
      completedThisMonth: 0,
      noShows: 0,
    };
  }

  const staffIds = staff.map((s) => s.id);

  // Get all assignments for this agency's staff
  const { data: assignments } = await supabase
    .from("booking_assignments")
    .select("status, created_at")
    .in("agency_staff_id", staffIds);

  if (!assignments) {
    return {
      totalAssignments: 0,
      pendingConfirmations: 0,
      completedThisMonth: 0,
      noShows: 0,
    };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return {
    totalAssignments: assignments.length,
    pendingConfirmations: assignments.filter((a) => a.status === "assigned").length,
    completedThisMonth: assignments.filter(
      (a) =>
        a.status === "completed" &&
        new Date(a.created_at) >= startOfMonth
    ).length,
    noShows: assignments.filter((a) => a.status === "no_show").length,
  };
}
