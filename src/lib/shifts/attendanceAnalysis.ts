import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceMeters } from "@/lib/geo/distance";

export type AttendanceFlagCode =
  | "no_gps_points"
  | "all_gps_far_from_venue"
  | "very_short_shift"
  | "instant_checkout"
  | "checkin_trail_mismatch";

export type AttendanceAnalysis = {
  confidence: number;
  suspicious: boolean;
  flags: AttendanceFlagCode[];
  summary: Record<string, unknown>;
};

export async function analyzeShiftAttendance(
  supabase: SupabaseClient,
  shiftId: string,
): Promise<AttendanceAnalysis> {
  const { data: shift } = await supabase
    .from("shifts")
    .select(
      "id, booking_id, status, scheduled_start, scheduled_end, actual_start, actual_end, check_in_latitude, check_in_longitude",
    )
    .eq("id", shiftId)
    .single();

  if (!shift) {
    return { confidence: 0, suspicious: true, flags: ["no_gps_points"], summary: { error: "shift_not_found" } };
  }

  const flags: AttendanceFlagCode[] = [];
  let confidence = 100;

  const { data: booking } = await supabase
    .from("bookings")
    .select("venue_id, site_latitude, site_longitude")
    .eq("id", shift.booking_id)
    .single();

  let venueLat: number | null = booking?.site_latitude != null ? Number(booking.site_latitude) : null;
  let venueLng: number | null = booking?.site_longitude != null ? Number(booking.site_longitude) : null;
  if ((venueLat == null || venueLng == null) && booking?.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("latitude, longitude")
      .eq("id", booking.venue_id)
      .single();
    venueLat = venue?.latitude != null ? Number(venue.latitude) : null;
    venueLng = venue?.longitude != null ? Number(venue.longitude) : null;
  }

  const { data: logs } = await supabase
    .from("shift_gps_log" as any)
    .select("lat, lng, recorded_at")
    .eq("shift_id", shiftId)
    .order("recorded_at", { ascending: true })
    .limit(3000);

  const gpsLogs = (logs ?? []) as Array<{ lat: number; lng: number; recorded_at: string }>;

  if (gpsLogs.length === 0) {
    flags.push("no_gps_points");
    confidence -= 35;
  }

  if (venueLat != null && venueLng != null && gpsLogs.length > 0) {
    const distances = gpsLogs.map((p) => distanceMeters(p.lat, p.lng, venueLat!, venueLng!));
    const allFar = distances.every((d) => d > 500);
    if (allFar) {
      flags.push("all_gps_far_from_venue");
      confidence -= 35;
    }

    if (shift.check_in_latitude != null && shift.check_in_longitude != null) {
      const centroid = gpsLogs.reduce(
        (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
        { lat: 0, lng: 0 },
      );
      const centroidLat = centroid.lat / gpsLogs.length;
      const centroidLng = centroid.lng / gpsLogs.length;
      const mismatch = distanceMeters(
        Number(shift.check_in_latitude),
        Number(shift.check_in_longitude),
        centroidLat,
        centroidLng,
      );
      if (mismatch > 1000) {
        flags.push("checkin_trail_mismatch");
        confidence -= 15;
      }
    }
  }

  const scheduledMinutes =
    (new Date(shift.scheduled_end).getTime() - new Date(shift.scheduled_start).getTime()) / 60000;
  const actualMinutes =
    shift.actual_start && shift.actual_end
      ? (new Date(shift.actual_end).getTime() - new Date(shift.actual_start).getTime()) / 60000
      : 0;

  if (actualMinutes > 0 && scheduledMinutes >= 120 && actualMinutes < 30) {
    flags.push("very_short_shift");
    confidence -= 20;
  }

  if (actualMinutes > 0 && actualMinutes <= 5) {
    flags.push("instant_checkout");
    confidence -= 30;
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    confidence,
    suspicious: flags.length > 0,
    flags,
    summary: {
      shift_id: shiftId,
      gps_points: gpsLogs.length,
      scheduled_minutes: Math.round(scheduledMinutes),
      actual_minutes: Math.round(actualMinutes),
      venue_coordinates_available: venueLat != null && venueLng != null,
    },
  };
}

