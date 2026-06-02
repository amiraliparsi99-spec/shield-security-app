import { appendPostcodeIfMissing } from "./addressFormat";

type VenueLoc = {
  label?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postcode?: string | null;
} | null;

type VenueRow = {
  address_line1?: string | null;
  city?: string | null;
  postcode?: string | null;
} | null;

/**
 * Single "where to go" line for guards: booking snapshot first, then saved site row,
 * then venue profile, then site label (non–main-address jobs only).
 */
export function bookingDirectionsLine(booking: {
  site_address_text?: string | null;
  venue_location?: VenueLoc;
  site_label?: string | null;
  venue?: VenueRow;
}): string {
  const snap = booking.site_address_text?.trim();
  if (snap) {
    // Only merge saved-site postcode — never venue HQ postcode (wrong for off-site jobs).
    const pc = booking.venue_location?.postcode?.trim();
    return appendPostcodeIfMissing(snap, pc || undefined);
  }

  const vl = booking.venue_location;
  if (vl && typeof vl === "object") {
    const line = [vl.address_line1, vl.city, vl.postcode]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(", ");
    if (line) return line;
    const lab = vl.label?.trim();
    if (lab) return lab;
  }

  const v = booking.venue;
  const venueLine = [v?.address_line1, v?.city, v?.postcode]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (venueLine) return venueLine;

  const sl = booking.site_label?.trim();
  if (sl && !sl.toLowerCase().includes("main account address")) return sl;

  return "Address not available";
}
