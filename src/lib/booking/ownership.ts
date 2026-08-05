/**
 * Who is allowed to act on a booking.
 *
 * Routes that run with the service-role key bypass RLS entirely, so the
 * database will not stop one tenant acting on another's booking — this check
 * is the only thing that does. Keep it in one place: duplicated authorization
 * logic drifts, and the copy that drifts is the one that leaks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingOwner = { venue_id: string | null; agency_id?: string | null };

/**
 * True when the user is the venue that raised the booking, or the agency that
 * owns it. Agencies staffing a booking they do not own are deliberately
 * excluded — use `resolveAgencyBookingContext` where "assigned" access is
 * enough.
 *
 * @param admin Service-role client; the lookups must not be filtered by RLS.
 */
export async function userOwnsBooking(
  admin: SupabaseClient,
  userId: string,
  booking: BookingOwner,
): Promise<boolean> {
  if (booking.venue_id) {
    const { data: venue } = await admin
      .from("venues")
      .select("user_id")
      .eq("id", booking.venue_id)
      .maybeSingle();
    const venueUserId = (venue as { user_id?: string | null } | null)?.user_id ?? null;
    if (venueUserId && venueUserId === userId) return true;
  }

  if (booking.agency_id) {
    const { data: agency } = await admin
      .from("agencies")
      .select("id")
      .eq("user_id", userId)
      .eq("id", booking.agency_id)
      .maybeSingle();
    if (agency) return true;
  }

  return false;
}

/** Same check, starting from a booking id. Returns false if it does not exist. */
export async function userOwnsBookingId(
  admin: SupabaseClient,
  userId: string,
  bookingId: string,
): Promise<boolean> {
  const { data: booking } = await admin
    .from("bookings")
    .select("venue_id, agency_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return false;
  return userOwnsBooking(admin, userId, booking as BookingOwner);
}
