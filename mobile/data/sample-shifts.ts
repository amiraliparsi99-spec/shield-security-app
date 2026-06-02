/**
 * Sample shifts shown on guest-gate splashes and the Explore tab to give
 * signed-out users a realistic preview of the kind of work available.
 *
 * These are NOT real bookings. We disclose this in the feed's header info
 * tooltip and on the signup screen. The data is tuned to feel authentic:
 *
 *   - Venue names are generic UK pub/hotel/club names that exist all over
 *     the country, never trademarked / never copying real-business names.
 *   - Hourly rates are mostly non-round (£14.50 / £18.25 / £21.75).
 *   - Posted timestamps are spread from "just posted" to "yesterday".
 *   - Some cards are anonymised ("Confidential venue") to mirror real
 *     marketplace conventions and create curiosity for signup.
 *   - Optional rating / reviewCount / spotsLeft / postedBy fields add the
 *     texture you'd expect on a real job board.
 *
 * The pre-baked latitude/longitude are kept only as documentation; rendering
 * always uses `scatteredCoords()` so the shifts cluster around the user's
 * actual location (or a sensible fallback).
 */

export type SampleShift = {
  id: string;
  /** Displayed unless `confidential` is true. */
  venue: string;
  role: string;
  area: string;
  postcode: string;
  /** Human-friendly day label, e.g. "Tonight", "Tomorrow", "Sat". */
  dayLabel: string;
  /** Human-friendly time window, e.g. "8pm – 2am". */
  timeLabel: string;
  hours: number;
  /** Hourly rate in GBP — usually two decimals for realism. */
  rate: number;
  /** Marks the shift as starting soon — used for urgent styling. */
  isUrgent?: boolean;
  /** Minutes since this shift was "posted" — used to compute the live label. */
  postedMinutesAgo: number;
  /** Static London-centric coords (documentation only — runtime uses scatter). */
  latitude: number;
  longitude: number;
  /** Day offset from today (0 = today, 1 = tomorrow). */
  dayOffset: number;
  /** Local start hour (24h). */
  startHour: number;
  /** Average venue rating (e.g. 4.7). Omit to hide rating on this card. */
  rating?: number;
  /** Total reviews — only meaningful when `rating` is set. */
  reviewCount?: number;
  /** Number of remaining spots; omit to hide the badge. */
  spotsLeft?: number;
  /** Source label: "Direct hire" | "Shield HQ" | agency name. */
  postedBy?: string;
  /** If true, venue name is hidden behind a lock and a "Sign up to reveal" CTA. */
  confidential?: boolean;
};

export const SAMPLE_SHIFTS: SampleShift[] = [
  {
    id: "sample-001",
    venue: "The Royal Oak",
    role: "Door Supervisor",
    area: "Camden",
    postcode: "NW1",
    dayLabel: "Tonight",
    timeLabel: "8pm – 2am",
    hours: 6,
    rate: 17.50,
    isUrgent: true,
    postedMinutesAgo: 3,
    latitude: 51.539,
    longitude: -0.1426,
    dayOffset: 0,
    startHour: 20,
    rating: 4.7,
    reviewCount: 124,
    spotsLeft: 2,
    postedBy: "Direct hire",
  },
  {
    id: "sample-002",
    venue: "The Crown",
    role: "Event Security",
    area: "Shoreditch",
    postcode: "EC2",
    dayLabel: "Fri",
    timeLabel: "10pm – 4am",
    hours: 6,
    rate: 19.25,
    postedMinutesAgo: 18,
    latitude: 51.5247,
    longitude: -0.0784,
    dayOffset: 4,
    startHour: 22,
    rating: 4.5,
    reviewCount: 61,
    spotsLeft: 3,
    postedBy: "ProGuard Services",
  },
  {
    id: "sample-003",
    venue: "Riverside Hall",
    role: "Static Guard",
    area: "Greenwich",
    postcode: "SE10",
    dayLabel: "Sat",
    timeLabel: "4pm – 11pm",
    hours: 7,
    rate: 16.75,
    postedMinutesAgo: 47,
    latitude: 51.4824,
    longitude: -0.0044,
    dayOffset: 5,
    startHour: 16,
    spotsLeft: 1,
    postedBy: "Direct hire",
  },
  {
    id: "sample-004",
    venue: "",
    role: "VIP Security",
    area: "Mayfair",
    postcode: "W1",
    dayLabel: "Tonight",
    timeLabel: "9pm – 3am",
    hours: 6,
    rate: 22.50,
    isUrgent: true,
    postedMinutesAgo: 11,
    latitude: 51.5097,
    longitude: -0.1467,
    dayOffset: 0,
    startHour: 21,
    rating: 4.9,
    reviewCount: 47,
    spotsLeft: 1,
    confidential: true,
  },
  {
    id: "sample-005",
    venue: "Three Crowns",
    role: "Door Supervisor",
    area: "Hackney",
    postcode: "E8",
    dayLabel: "Tonight",
    timeLabel: "9pm – 3am",
    hours: 6,
    rate: 18.00,
    isUrgent: true,
    postedMinutesAgo: 9,
    latitude: 51.5450,
    longitude: -0.0635,
    dayOffset: 0,
    startHour: 21,
    rating: 4.4,
    reviewCount: 32,
    postedBy: "Capital Security Co",
  },
  {
    id: "sample-006",
    venue: "Whitelaw Department Store",
    role: "Retail Security",
    area: "Stratford",
    postcode: "E20",
    dayLabel: "Mon",
    timeLabel: "9am – 6pm",
    hours: 9,
    rate: 14.50,
    postedMinutesAgo: 95,
    latitude: 51.5436,
    longitude: -0.0066,
    dayOffset: 1,
    startHour: 9,
    rating: 4.3,
    reviewCount: 18,
    postedBy: "Shield HQ",
    spotsLeft: 5,
  },
  {
    id: "sample-007",
    venue: "The Anchor",
    role: "Door Supervisor",
    area: "Soho",
    postcode: "W1",
    dayLabel: "Tomorrow",
    timeLabel: "7pm – 1am",
    hours: 6,
    rate: 18.25,
    postedMinutesAgo: 180,
    latitude: 51.5137,
    longitude: -0.1366,
    dayOffset: 1,
    startHour: 19,
    rating: 4.6,
    reviewCount: 89,
    postedBy: "Direct hire",
  },
  {
    id: "sample-008",
    venue: "",
    role: "Concierge Security",
    area: "Canary Wharf",
    postcode: "E14",
    dayLabel: "Mon",
    timeLabel: "7am – 7pm",
    hours: 12,
    rate: 17.75,
    postedMinutesAgo: 270,
    latitude: 51.5054,
    longitude: -0.0235,
    dayOffset: 1,
    startHour: 7,
    rating: 4.8,
    reviewCount: 210,
    spotsLeft: 2,
    confidential: true,
  },
  {
    id: "sample-009",
    venue: "The Globe Boutique Hotel",
    role: "Night Concierge",
    area: "Bloomsbury",
    postcode: "WC1",
    dayLabel: "Wed",
    timeLabel: "11pm – 7am",
    hours: 8,
    rate: 16.50,
    postedMinutesAgo: 480,
    latitude: 51.5219,
    longitude: -0.1276,
    dayOffset: 0,
    startHour: 23,
    rating: 4.5,
    reviewCount: 73,
    postedBy: "Direct hire",
    spotsLeft: 1,
  },
  {
    id: "sample-010",
    venue: "Aspire Conference Centre",
    role: "Crowd Steward",
    area: "Kensington",
    postcode: "SW7",
    dayLabel: "Sat",
    timeLabel: "5pm – 11pm",
    hours: 6,
    rate: 15.75,
    postedMinutesAgo: 720,
    latitude: 51.5009,
    longitude: -0.1773,
    dayOffset: 5,
    startHour: 17,
    rating: 4.7,
    reviewCount: 142,
    spotsLeft: 8,
    postedBy: "Shield HQ",
  },
  {
    id: "sample-011",
    venue: "The Red Lion",
    role: "Door Supervisor",
    area: "Brixton",
    postcode: "SW9",
    dayLabel: "Tonight",
    timeLabel: "8pm – 2am",
    hours: 6,
    rate: 17.00,
    isUrgent: true,
    postedMinutesAgo: 24,
    latitude: 51.4626,
    longitude: -0.1145,
    dayOffset: 0,
    startHour: 20,
    spotsLeft: 4,
    postedBy: "ProGuard Services",
  },
  {
    id: "sample-012",
    venue: "Edenfield Outlet Park",
    role: "Loss Prevention Officer",
    area: "Hammersmith",
    postcode: "W6",
    dayLabel: "Sat",
    timeLabel: "12pm – 8pm",
    hours: 8,
    rate: 16.25,
    postedMinutesAgo: 1440,
    latitude: 51.4927,
    longitude: -0.2339,
    dayOffset: 5,
    startHour: 12,
    rating: 4.4,
    reviewCount: 56,
    postedBy: "Direct hire",
  },
];

/** Centre point for sample shifts (Central London) — used as map fallback. */
export const SAMPLE_SHIFTS_CENTER = { lat: 51.515, lng: -0.108 };

export type SampleMapJob = {
  booking_id: string;
  role: string;
  event_name: string;
  venue_name: string;
  venue_city: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  positions_available: number;
  shift_ids: string[];
  latitude: number | null;
  longitude: number | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Deterministically scatter shift `index` around `center` using a golden-angle
 * (sunflower) distribution. Same shift + same centre always produces the same
 * coords, so the feed and the map agree on a shift's position.
 */
export function scatteredCoords(
  index: number,
  center: { lat: number; lng: number }
): { lat: number; lng: number } {
  const lngScale = 1 / Math.cos((center.lat * Math.PI) / 180);
  const angle = (index * 137.508 * Math.PI) / 180;
  const radius = 0.004 + ((index * 7) % 9) * 0.0018;
  const dlat = Math.cos(angle) * radius;
  const dlng = Math.sin(angle) * radius * lngScale;
  return { lat: center.lat + dlat, lng: center.lng + dlng };
}

/** Great-circle distance between two coords, in miles. */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Format a miles-from-user value for display, e.g. "0.4 mi", "3.2 mi". */
export function formatDistanceLabel(miles: number): string {
  if (miles < 0.1) return "<0.1 mi";
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Format a "posted X ago" label from minutes. */
export function formatPostedAgo(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    return `${h}h ago`;
  }
  const days = Math.floor(minutes / (60 * 24));
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

/** Format an hourly rate for display, e.g. "£18.25", "£17". */
export function formatRate(rate: number): string {
  return Number.isInteger(rate) ? `£${rate}` : `£${rate.toFixed(2)}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Map-shape helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert the static sample data into ShiftsMapView-compatible jobs with real
 * ISO timestamps. Uses the baked-in London coordinates. Kept for compatibility;
 * most callers should use `sampleShiftsAroundCenter` instead.
 */
export function sampleShiftsAsMapJobs(): SampleMapJob[] {
  return SAMPLE_SHIFTS.map((s, i) => buildJob(s, i, null, null));
}

/**
 * Distribute the sample shift templates around an arbitrary centre point so
 * guests see jobs clustered near where they actually are.
 *
 * If `cityLabel` is provided (e.g. reverse-geocoded "Manchester"), each card's
 * neighbourhood is replaced with that label so the result feels local.
 */
export function sampleShiftsAroundCenter(
  center: { lat: number; lng: number },
  cityLabel?: string | null
): SampleMapJob[] {
  const clean = cityLabel?.trim() || null;
  return SAMPLE_SHIFTS.map((s, i) => {
    const coords = scatteredCoords(i, center);
    return buildJob(s, i, clean, coords);
  });
}

function buildJob(
  s: SampleShift,
  index: number,
  cityOverride: string | null,
  coords: { lat: number; lng: number } | null
): SampleMapJob {
  const start = new Date();
  start.setDate(start.getDate() + s.dayOffset);
  start.setHours(s.startHour, 0, 0, 0);
  const end = new Date(start.getTime() + s.hours * 3600_000);

  const venueCity = cityOverride ? cityOverride : `${s.area}, ${s.postcode}`;
  const venueName = s.confidential ? "Confidential venue" : s.venue;
  const lat = coords ? coords.lat : s.latitude;
  const lng = coords ? coords.lng : s.longitude;

  return {
    booking_id: s.id,
    role: s.role,
    event_name: `${s.role} at ${venueName}`,
    venue_name: venueName,
    venue_city: venueCity,
    hourly_rate: s.rate,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    positions_available: s.spotsLeft ?? 1,
    shift_ids: [s.id],
    latitude: lat,
    longitude: lng,
  };
}
