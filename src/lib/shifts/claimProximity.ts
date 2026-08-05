import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceMeters } from "@/lib/geo/distance";

type ClaimProximityParams = {
  supabase: SupabaseClient;
  bookingId: string;
  personnelId: string;
  guardLatitude: number | null;
  guardLongitude: number | null;
};

export type ClaimProximityResult =
  | {
      ok: true;
      distance_meters: number;
      max_distance_meters: number;
      venue_name: string;
    }
  | {
      ok: false;
      error: string;
      distance_meters?: number;
      max_distance_meters?: number;
      guard_coords?: { lat: number; lng: number } | null;
      venue_coords?: { lat: number; lng: number } | null;
    };

function maxAcceptDistanceMeters(): number {
  const n = Number(process.env.SHIFT_ACCEPT_MAX_DISTANCE_METERS);
  // Default to a tighter city-level radius unless explicitly overridden.
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

function formatMiles(miles: number): string {
  if (miles >= 10) return `${Math.round(miles)} miles`;
  if (miles >= 1) return `${miles.toFixed(1)} miles`;
  // Below 1 mile, still use miles but with two decimal places so "0" never shows.
  return `${Math.max(0.01, Number(miles.toFixed(2)))} miles`;
}

export async function validateClaimProximity({
  supabase,
  bookingId,
  personnelId,
  guardLatitude,
  guardLongitude,
}: ClaimProximityParams): Promise<ClaimProximityResult> {
  if (guardLatitude == null || guardLongitude == null) {
    return {
      ok: false,
      error:
        "Location is required to accept shifts. Please enable location and try again.",
    };
  }

  // Single joined query — pulls booking + its venue (name + fallback pin) in
  // one round-trip instead of two sequential ones. Significant latency win
  // on the claim hot path.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, venue_id, site_latitude, site_longitude, site_label, venues(id, name, latitude, longitude)",
    )
    .eq("id", bookingId)
    .single();

  // Agency-owned bookings have no venue_id — they carry their own site pin
  // (site_latitude/longitude/site_label), so only a missing row is fatal.
  if (!booking) {
    return { ok: false, error: "Booking details not found for this shift." };
  }

  // Supabase returns joined `venues` as either an object or array depending
  // on FK cardinality declaration — normalise.
  const joinedVenue: any = Array.isArray((booking as any).venues)
    ? (booking as any).venues[0]
    : (booking as any).venues;

  let venueLat =
    booking.site_latitude != null ? Number(booking.site_latitude) : null;
  let venueLng =
    booking.site_longitude != null ? Number(booking.site_longitude) : null;
  const venueName =
    (typeof booking.site_label === "string" && booking.site_label.trim()) ||
    joinedVenue?.name ||
    "the venue";

  if ((venueLat == null || venueLng == null) && joinedVenue) {
    venueLat =
      joinedVenue.latitude != null ? Number(joinedVenue.latitude) : null;
    venueLng =
      joinedVenue.longitude != null ? Number(joinedVenue.longitude) : null;
  }

  if (venueLat == null || venueLng == null) {
    return {
      ok: false,
      error:
        "This shift has no mapped location yet. Ask the venue to set a location pin before claiming.",
    };
  }

  const maxDistance = maxAcceptDistanceMeters();
  const distance = Math.round(
    distanceMeters(guardLatitude, guardLongitude, venueLat, venueLng),
  );

  if (distance > maxDistance) {
    const distanceMiles = metersToMiles(distance);
    const maxMiles = metersToMiles(maxDistance);
    return {
      ok: false,
      error: `You're about ${formatMiles(distanceMiles)} from ${venueName}. You must be within ${formatMiles(maxMiles)} to accept this shift.`,
      distance_meters: distance,
      max_distance_meters: maxDistance,
      guard_coords: { lat: guardLatitude, lng: guardLongitude },
      venue_coords: { lat: venueLat, lng: venueLng },
    };
  }

  // Persist the guard's location alongside the claim, but don't block the
  // response on it — it's a nice-to-have analytics/tracking write, not part
  // of the claim's correctness. Failure here is logged, never user-facing.
  void supabase
    .from("personnel")
    .update({
      latitude: guardLatitude,
      longitude: guardLongitude,
      updated_at: new Date().toISOString(),
    })
    .eq("id", personnelId)
    .then(({ error }) => {
      if (error) {
        console.warn(
          "[claimProximity] failed to persist guard location:",
          error,
        );
      }
    });

  return {
    ok: true,
    distance_meters: distance,
    max_distance_meters: maxDistance,
    venue_name: venueName,
  };
}
