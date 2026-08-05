/**
 * Resolve the primary location label guards see on shift cards.
 * Agency-created bookings often have no `venues` row — use site_label / event instead.
 */

export type BookingDisplaySource = {
  event_name?: string | null;
  site_label?: string | null;
  site_address_text?: string | null;
  venue?: { name?: string | null } | null;
  venues?: { name?: string | null } | null;
  agency?: { name?: string | null } | null;
  agencies?: { name?: string | null } | null;
};

export function bookingDisplayName(
  booking: BookingDisplaySource | null | undefined,
): string {
  if (!booking) return "Unknown Venue";

  const siteLabel = booking.site_label?.trim();
  if (siteLabel) return siteLabel;

  const venueName = booking.venue?.name?.trim() || booking.venues?.name?.trim();
  if (venueName) return venueName;

  const eventName = booking.event_name?.trim();
  if (eventName) return eventName;

  const agencyName = booking.agency?.name?.trim() || booking.agencies?.name?.trim();
  if (agencyName) return agencyName;

  const address = booking.site_address_text?.trim();
  if (address) {
    const first = address.split(",")[0]?.trim();
    if (first) return first;
    return address;
  }

  return "Unknown Venue";
}

/** Subtitle line under the main site name — usually the event title. */
export function bookingDisplaySubtitle(
  booking: BookingDisplaySource | null | undefined,
): string | null {
  if (!booking?.event_name?.trim()) return null;
  const siteLabel = booking.site_label?.trim();
  const eventName = booking.event_name.trim();
  if (siteLabel && siteLabel !== eventName) return eventName;
  const venueName = booking.venue?.name?.trim() || booking.venues?.name?.trim();
  if (venueName && venueName !== eventName) return eventName;
  return null;
}
