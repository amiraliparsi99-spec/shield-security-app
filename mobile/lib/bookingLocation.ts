import { Linking, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { bookingDisplayName } from "./bookingDisplay";
import { bookingDirectionsLine } from "./bookingDirections";

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

type VenueLoc = {
  label?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postcode?: string | null;
} | null;

type VenueRow = {
  name?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
} | null;

export type BookingLocationSource = {
  event_name?: string | null;
  site_label?: string | null;
  site_address_text?: string | null;
  site_latitude?: number | null;
  site_longitude?: number | null;
  venue_location?: VenueLoc;
  venue?: VenueRow;
  venues?: VenueRow;
};

export type ResolvedBookingLocation = {
  /** Building / site name guards recognise, e.g. "Starbucks Tribe". */
  siteName: string;
  /** Parent venue when different from the site, e.g. chain HQ. */
  venueName: string | null;
  streetAddress: string | null;
  city: string | null;
  postcode: string | null;
  /** Multi-line address for display. */
  addressLines: string[];
  /** Single-line fallback from legacy helper. */
  fullLine: string;
  latitude: number | null;
  longitude: number | null;
  hasStreetAddress: boolean;
  hasCoordinates: boolean;
  directionsQuery: string | null;
};

function normalizeVenueLoc(raw: VenueLoc | VenueLoc[] | undefined): VenueLoc {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function normalizeVenue(raw: VenueRow | VenueRow[] | undefined): VenueRow {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

/** Split a comma-separated UK address into street, city, and postcode. */
export function parseUkAddressParts(text: string | null | undefined): {
  street: string;
  city: string;
  postcode: string;
} {
  if (!text?.trim()) return { street: "", city: "", postcode: "" };

  let remainder = text.trim();
  let postcode = "";
  const inlinePc = remainder.match(UK_POSTCODE);
  if (inlinePc) {
    postcode = inlinePc[1].replace(/\s+/g, " ").toUpperCase();
  }

  const parts = remainder.split(",").map((s) => s.trim()).filter(Boolean);

  while (parts.length > 0 && UK_POSTCODE.test(parts[parts.length - 1])) {
    if (!postcode) {
      postcode = parts[parts.length - 1].replace(/\s+/g, " ").toUpperCase();
    }
    parts.pop();
  }

  let city = "";
  if (parts.length >= 2) {
    city = parts[parts.length - 1];
    parts.pop();
  }

  const street = parts.join(", ");
  return { street, city, postcode };
}

export function resolveBookingLocation(
  booking: BookingLocationSource | null | undefined,
): ResolvedBookingLocation {
  if (!booking) {
    return {
      siteName: "Unknown location",
      venueName: null,
      streetAddress: null,
      city: null,
      postcode: null,
      addressLines: [],
      fullLine: "Address not available",
      latitude: null,
      longitude: null,
      hasStreetAddress: false,
      hasCoordinates: false,
      directionsQuery: null,
    };
  }

  const venueLoc = normalizeVenueLoc(booking.venue_location as VenueLoc | VenueLoc[]);
  const venue = normalizeVenue(booking.venue ?? booking.venues);
  const siteLabel = booking.site_label?.trim() || null;

  const snap = parseUkAddressParts(booking.site_address_text);
  let street = snap.street;
  let city = snap.city;
  let postcode = snap.postcode;

  if (!street && venueLoc?.address_line1?.trim()) street = venueLoc.address_line1.trim();
  if (!city && venueLoc?.city?.trim()) city = venueLoc.city.trim();
  if (!postcode && venueLoc?.postcode?.trim()) postcode = venueLoc.postcode.trim();

  if (!street && venue?.address_line1?.trim()) street = venue.address_line1.trim();
  if (!city && venue?.city?.trim()) city = venue.city.trim();
  if (!postcode && venue?.postcode?.trim()) postcode = venue.postcode.trim();

  const siteName =
    siteLabel ||
    venueLoc?.label?.trim() ||
    bookingDisplayName(booking);

  const venueName = venue?.name?.trim() || null;
  const showVenueName =
    venueName &&
    venueName.toLowerCase() !== siteName.toLowerCase() &&
    !siteName.toLowerCase().includes(venueName.toLowerCase());

  const addressLines: string[] = [];
  if (street) addressLines.push(street);
  if (city) addressLines.push(city);
  if (postcode) addressLines.push(postcode);

  const fullLine = bookingDirectionsLine({
    site_address_text: booking.site_address_text,
    venue_location: venueLoc,
    site_label: booking.site_label,
    venue,
  });

  const lat =
    typeof booking.site_latitude === "number"
      ? booking.site_latitude
      : venue?.latitude ?? null;
  const lng =
    typeof booking.site_longitude === "number"
      ? booking.site_longitude
      : venue?.longitude ?? null;

  const hasCoordinates = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const hasStreetAddress = Boolean(street);

  let directionsQuery: string | null = null;
  if (hasCoordinates) {
    directionsQuery = `${lat},${lng}`;
  } else if (addressLines.length > 0) {
    directionsQuery = addressLines.join(", ");
  } else if (fullLine && fullLine !== "Address not available") {
    directionsQuery = fullLine;
  } else if (siteName && siteName !== "Unknown Venue") {
    directionsQuery = siteName;
  }

  return {
    siteName,
    venueName: showVenueName ? venueName : null,
    streetAddress: street || null,
    city: city || null,
    postcode: postcode || null,
    addressLines,
    fullLine,
    latitude: hasCoordinates ? lat : null,
    longitude: hasCoordinates ? lng : null,
    hasStreetAddress,
    hasCoordinates,
    directionsQuery,
  };
}

/** One-line address for list cards and previews. */
export function locationSummaryOneLine(
  booking: BookingLocationSource | null | undefined,
  maxLen = 80,
): string | null {
  const loc = resolveBookingLocation(booking);
  const parts: string[] = [];
  if (loc.streetAddress) parts.push(loc.streetAddress);
  if (loc.city) parts.push(loc.city);
  if (loc.postcode) parts.push(loc.postcode);

  let line = parts.join(", ");
  if (!line && loc.fullLine !== "Address not available") line = loc.fullLine;
  if (!line && loc.siteName && loc.siteName !== "Unknown Venue") line = loc.siteName;
  if (!line) return null;

  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1).trim()}…`;
}

export function formatAddressForCopy(loc: ResolvedBookingLocation): string {
  const lines = [loc.siteName];
  if (loc.venueName) lines.push(loc.venueName);
  if (loc.streetAddress) lines.push(loc.streetAddress);
  if (loc.city) lines.push(loc.city);
  if (loc.postcode) lines.push(loc.postcode);
  return lines.filter(Boolean).join("\n");
}

export async function openBookingDirections(loc: ResolvedBookingLocation): Promise<boolean> {
  if (!loc.directionsQuery) return false;

  const encoded = encodeURIComponent(loc.directionsQuery);
  let url: string;

  if (loc.hasCoordinates && loc.latitude != null && loc.longitude != null) {
    url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${loc.latitude},${loc.longitude}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`;
  } else {
    url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${encoded}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }

  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function copyBookingAddress(loc: ResolvedBookingLocation): Promise<void> {
  await Clipboard.setStringAsync(formatAddressForCopy(loc));
}
