/**
 * Shared notify-guards logic (Stripe webhook + HTTP API).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";

const EARTH_RADIUS_KM = 6371;
const MILES_TO_KM = 1.60934;
export const DEFAULT_SEARCH_RADIUS_MILES = 15;
const MAX_GUARDS_TO_NOTIFY = 20;
const OFFER_EXPIRY_SECONDS = 60;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type NotifyGuardsResult = {
  guards_notified: number;
  offers_created?: number;
  pushes_sent?: number;
  shifts_count?: number;
  booking_id: string;
  processing_time_ms: number;
};

/**
 * Notify nearby guards for a booking (after payment or manual trigger). Uses service role.
 */
export async function notifyGuardsForBooking(
  bookingId: string,
  radiusMiles: number = DEFAULT_SEARCH_RADIUS_MILES
): Promise<NotifyGuardsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);
  return runNotifyGuards(supabase, bookingId, radiusMiles);
}

async function runNotifyGuards(
  supabase: SupabaseClient,
  booking_id: string,
  searchRadiusMiles: number
): Promise<NotifyGuardsResult> {
  const runStarted = Date.now();
  const searchRadiusKm = searchRadiusMiles * MILES_TO_KM;

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("*, venues(id, name, user_id, address_line1, city, postcode, latitude, longitude)")
    .eq("id", booking_id)
    .single();

  if (bookingErr || !booking) {
    console.error("[NOTIFY-GUARDS] Booking lookup failed:", bookingErr?.message, "booking_id:", booking_id);
    throw new Error(bookingErr?.message || "Booking not found");
  }

  const venue = (booking as any).venues ?? (booking as any).venue;
  if (!venue) {
    console.log("[NOTIFY-GUARDS] Venue join failed, fetching separately. venue_id:", (booking as any).venue_id);
    const { data: venueFallback } = await supabase
      .from("venues")
      .select("id, name, user_id, address_line1, city, postcode, latitude, longitude")
      .eq("id", (booking as any).venue_id)
      .single();

    if (!venueFallback) {
      throw new Error("Venue not found for this booking");
    }
    Object.assign(booking, { _venue: venueFallback });
  }

  const resolvedVenue = venue ?? (booking as any)._venue;
  const eventName: string = (booking as any).event_name ?? "Security Shift";
  const venueName: string = resolvedVenue.name ?? "Unknown Venue";
  const eventVenueLabel = `${eventName} @ ${venueName}`;
  const venueAddress = [resolvedVenue.address_line1, resolvedVenue.city, resolvedVenue.postcode]
    .filter(Boolean)
    .join(", ");
  const venueLat: number | null = resolvedVenue.latitude;
  const venueLng: number | null = resolvedVenue.longitude;

  const { data: shifts, error: shiftsErr } = await supabase
    .from("shifts")
    .select("id, role, hourly_rate, scheduled_start, scheduled_end, status")
    .eq("booking_id", booking_id)
    .is("personnel_id", null)
    .in("status", ["pending"]);

  if (shiftsErr || !shifts || shifts.length === 0) {
    return {
      guards_notified: 0,
      booking_id,
      processing_time_ms: Date.now() - runStarted,
    };
  }

  let candidates: any[] = [];

  const { data: availableGuards, error: personnelErr } = await supabase
    .from("personnel")
    .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills, availability_times, available_days")
    .eq("is_active", true)
    .eq("is_available", true)
    .order("shield_score", { ascending: false })
    .limit(100);

  candidates = availableGuards ?? [];
  console.log(`[NOTIFY-GUARDS] Found ${candidates.length} active+available guards. Error: ${personnelErr?.message ?? "none"}`);

  if (candidates.length === 0) {
    const { data: activeGuards } = await supabase
      .from("personnel")
      .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills, availability_times, available_days")
      .eq("is_active", true)
      .order("shield_score", { ascending: false })
      .limit(50);

    candidates = activeGuards ?? [];
    console.log(`[NOTIFY-GUARDS] Fallback: found ${candidates.length} active guards (ignoring is_available).`);
  }

  if (candidates.length === 0) {
    const { data: allGuards } = await supabase
      .from("personnel")
      .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills, availability_times, available_days")
      .order("shield_score", { ascending: false })
      .limit(50);

    candidates = allGuards ?? [];
    console.log(`[NOTIFY-GUARDS] Last resort: found ${candidates.length} personnel total.`);
  }

  if (candidates.length === 0) {
    return {
      guards_notified: 0,
      booking_id,
      processing_time_ms: Date.now() - runStarted,
    };
  }

  const candidateIds = candidates.map((g) => g.id).filter(Boolean);
  if (candidateIds.length > 0) {
    const { data: verifiedRows, error: verifiedErr } = await supabase
      .from("verifications")
      .select("owner_id, status")
      .eq("owner_type", "personnel")
      .in("owner_id", candidateIds)
      .eq("status", "verified");

    if (verifiedErr) {
      console.warn("[NOTIFY-GUARDS] Verification lookup error:", verifiedErr.message);
    }

    const verifiedIds = new Set((verifiedRows ?? []).map((row) => row.owner_id));
    const beforeVerificationFilter = candidates.length;
    candidates = candidates.filter((g) => verifiedIds.has(g.id));
    console.log(
      `[NOTIFY-GUARDS] Verified filter: ${beforeVerificationFilter} -> ${candidates.length} guards`
    );
  }

  if (candidates.length === 0) {
    return {
      guards_notified: 0,
      booking_id,
      processing_time_ms: Date.now() - runStarted,
    };
  }

  let nearbyGuards = candidates;

  if (venueLat !== null && venueLng !== null) {
    const guardsWithCoords = candidates
      .filter((g) => g.latitude !== null && g.longitude !== null)
      .map((g) => ({
        ...g,
        distanceKm: haversineKm(venueLat, venueLng, g.latitude!, g.longitude!),
        distanceMiles: haversineKm(venueLat, venueLng, g.latitude!, g.longitude!) / MILES_TO_KM,
      }))
      .filter((g) => g.distanceKm <= searchRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (guardsWithCoords.length > 0) {
      nearbyGuards = guardsWithCoords;
    } else {
      console.log("[NOTIFY-GUARDS] No guards with coordinates in range. Notifying all candidates.");
    }
  } else {
    console.log("[NOTIFY-GUARDS] Venue has no coordinates. Skipping proximity filter.");
  }

  if (nearbyGuards.length > 0 && shifts.length > 0) {
    const shiftStartDate = new Date(shifts[0].scheduled_start);
    const shiftEndDate = new Date(shifts[0].scheduled_end);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const shiftDay = dayNames[shiftStartDate.getDay()];
    const shiftStartTime = shiftStartDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const shiftEndTime = shiftEndDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

    const beforeAvailFilter = nearbyGuards.length;
    nearbyGuards = nearbyGuards.filter((guard) => {
      if (!guard.availability_times || !Array.isArray(guard.availability_times) || guard.availability_times.length === 0) {
        return true;
      }

      const dayAvailability = guard.availability_times.find((a: any) => a.day === shiftDay && a.enabled);

      if (!dayAvailability) {
        console.log(`[NOTIFY-GUARDS] Guard ${guard.id} not available on ${shiftDay}`);
        return false;
      }

      if (dayAvailability.start_time && dayAvailability.end_time) {
        const availStart = dayAvailability.start_time;
        const availEnd = dayAvailability.end_time;

        if (shiftStartTime < availStart || shiftEndTime > availEnd) {
          console.log(`[NOTIFY-GUARDS] Guard ${guard.id} time ${shiftStartTime}-${shiftEndTime} outside availability ${availStart}-${availEnd}`);
          return false;
        }
      }

      return true;
    });

    console.log(`[NOTIFY-GUARDS] Availability filter: ${beforeAvailFilter} -> ${nearbyGuards.length} guards`);
  }

  if (nearbyGuards.length > 0 && shifts.length > 0) {
    const shiftStart = shifts[0].scheduled_start;
    const shiftEnd = shifts[0].scheduled_end;
    const guardIds = nearbyGuards.map((g) => g.id);

    const { data: busyShifts } = await supabase
      .from("shifts")
      .select("personnel_id")
      .in("personnel_id", guardIds)
      .in("status", ["accepted", "checked_in", "pending"])
      .lte("scheduled_start", shiftEnd)
      .gte("scheduled_end", shiftStart);

    const busyIds = new Set((busyShifts ?? []).map((s) => s.personnel_id));
    nearbyGuards = nearbyGuards.filter((g) => !busyIds.has(g.id));
  }

  const topGuards = nearbyGuards.slice(0, MAX_GUARDS_TO_NOTIFY);

  if (topGuards.length === 0) {
    return {
      guards_notified: 0,
      booking_id,
      processing_time_ms: Date.now() - runStarted,
    };
  }

  const expiresAt = new Date(Date.now() + OFFER_EXPIRY_SECONDS * 1000).toISOString();
  let totalOffers = 0;
  let totalPushes = 0;

  const representativeShift = shifts[0];
  const shiftDate = new Date(representativeShift.scheduled_start).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const shiftStartDisplay = new Date(representativeShift.scheduled_start).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const shiftEndDisplay = new Date(representativeShift.scheduled_end).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const avgRate = Math.round(shifts.reduce((sum, s) => sum + s.hourly_rate, 0) / shifts.length);
  const positionsText = shifts.length > 1 ? ` (${shifts.length} positions)` : "";

  const offerRecords = topGuards.map((guard) => ({
    shift_id: representativeShift.id,
    personnel_id: guard.id,
    status: "pending",
    hourly_rate: representativeShift.hourly_rate,
    venue_name: eventVenueLabel,
    venue_address: venueAddress || null,
    venue_latitude: venueLat,
    venue_longitude: venueLng,
    shift_date: shiftDate,
    start_time: shiftStartDisplay,
    end_time: shiftEndDisplay,
    distance_miles:
      "distanceMiles" in guard ? Math.round((guard as any).distanceMiles * 10) / 10 : null,
    expires_at: expiresAt,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("shift_offers")
    .upsert(offerRecords, { onConflict: "shift_id,personnel_id", ignoreDuplicates: true })
    .select("id, personnel_id");

  if (insertErr) {
    console.error("[NOTIFY-GUARDS] Error inserting offers:", insertErr.message);
  } else {
    totalOffers = inserted?.length ?? 0;
  }

  for (const guard of topGuards) {
    const distanceStr =
      "distanceMiles" in guard ? ` (${(guard as any).distanceMiles.toFixed(1)} mi away)` : "";

    try {
      await sendPushNotification({
        userId: guard.user_id,
        type: "new_booking",
        title: `📋 ${eventName}`,
        body: `${venueName} · £${avgRate}/hr · ${shiftDate} · ${shiftStartDisplay}-${shiftEndDisplay}${positionsText}${distanceStr}. Tap to accept!`,
        data: {
          type: "new_shift_offer",
          shift_id: representativeShift.id,
          booking_id: booking_id,
          event_name: eventName,
          venue_name: venueName,
          hourly_rate: avgRate,
          positions: shifts.length,
          action: "open_shift_offer",
        },
      });
      totalPushes++;
    } catch (pushErr) {
      console.warn(`[NOTIFY-GUARDS] Push failed for ${guard.user_id}:`, pushErr);
    }
  }

  const notificationRecords = topGuards.map((guard) => ({
    user_id: guard.user_id,
    type: "shift" as const,
    title: `📋 ${eventName}`,
    body: `${venueName} · £${avgRate}/hr · ${shiftDate} · ${shiftStartDisplay}-${shiftEndDisplay}${positionsText}. Tap to accept!`,
    data: {
      type: "new_shift_offer",
      shift_id: representativeShift.id,
      booking_id: booking_id,
      event_name: eventName,
      venue_name: venueName,
      hourly_rate: avgRate,
      positions: shifts.length,
      action: "open_shift_offer",
    },
    is_read: false,
  }));

  await supabase.from("notifications").insert(notificationRecords);

  console.log(
    `[NOTIFY-GUARDS] Created ${totalOffers} offers, sent ${totalPushes} push notifications for booking ${booking_id}`
  );

  return {
    booking_id,
    shifts_count: shifts.length,
    guards_notified: topGuards.length,
    offers_created: totalOffers,
    pushes_sent: totalPushes,
    processing_time_ms: Date.now() - runStarted,
  };
}
