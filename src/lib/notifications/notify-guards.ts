/**
 * Shared notify-guards logic (Stripe webhook + HTTP API).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { checkPersonnelAvailabilityDetailed } from "@/lib/db/availability";
import type { Database } from "@/lib/database.types";

const EARTH_RADIUS_KM = 6371;
const MILES_TO_KM = 1.60934;
export const DEFAULT_SEARCH_RADIUS_MILES = 15;
/** Wider radius when a guard just dropped and we need replacement fast */
export const URGENT_COVER_RADIUS_MILES = 25;
const MAX_GUARDS_TO_NOTIFY = 20;
const MAX_GUARDS_URGENT = 500;
// Keep offers active long enough for real-world mobile delivery/foreground delays.
const OFFER_EXPIRY_SECONDS = 5 * 60;
const URGENT_OFFER_EXPIRY_SECONDS = 120;

export type NotifyGuardsOptions = {
  /** Shorter copy + wider notify cap */
  urgent?: boolean;
  /** Do not offer to these personnel (e.g. guard who just withdrew) */
  excludePersonnelIds?: string[];
};

type TypedSupabase = SupabaseClient<Database>;

/** London calendar date + clock times for availability checks */
function shiftToLondonDateAndTimes(
  scheduledStartIso: string,
  scheduledEndIso: string
): { date: string; startTime: string; endTime: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = (d: Date) => fmt.formatToParts(d);
  const get = (p: Intl.DateTimeFormatPart[], t: string) => p.find((x) => x.type === t)?.value ?? "00";
  const s = new Date(scheduledStartIso);
  const e = new Date(scheduledEndIso);
  const ps = parts(s);
  const pe = parts(e);
  const date = `${get(ps, "year")}-${get(ps, "month")}-${get(ps, "day")}`;
  const startTime = `${get(ps, "hour")}:${get(ps, "minute")}`;
  const endTime = `${get(pe, "hour")}:${get(pe, "minute")}`;
  return { date, startTime, endTime };
}

function isWeekendLondon(iso: string): boolean {
  const w = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(new Date(iso));
  return w === "Sat" || w === "Sun";
}

/** Night = shift starts after 22:00 or before 06:00 (London local start time, HH:MM). */
function isNightShiftStart(startTimeHHMM: string): boolean {
  const [h, m] = startTimeHHMM.split(":").map((x) => parseInt(x, 10));
  const mins = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  return mins >= 22 * 60 || mins < 6 * 60;
}

function toHHMMSS(t: string): string {
  const [a, b] = t.split(":");
  const h = (a ?? "00").padStart(2, "0");
  const m = (b ?? "00").padStart(2, "0");
  return `${h}:${m}:00`;
}

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
  radiusMiles: number = DEFAULT_SEARCH_RADIUS_MILES,
  options?: NotifyGuardsOptions
): Promise<NotifyGuardsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);
  return runNotifyGuards(supabase, bookingId, radiusMiles, options);
}

async function runNotifyGuards(
  supabase: SupabaseClient,
  booking_id: string,
  searchRadiusMiles: number,
  options?: NotifyGuardsOptions
): Promise<NotifyGuardsResult> {
  const runStarted = Date.now();
  const urgent = Boolean(options?.urgent);
  const excludeIds = new Set((options?.excludePersonnelIds ?? []).filter(Boolean));
  const offerExpirySeconds = urgent ? URGENT_OFFER_EXPIRY_SECONDS : OFFER_EXPIRY_SECONDS;
  const maxGuards = urgent ? MAX_GUARDS_URGENT : MAX_GUARDS_TO_NOTIFY;

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
  const bookingSiteAddress = ((booking as any).site_address_text as string | null | undefined)?.trim();
  const venueAddress =
    bookingSiteAddress ||
    [resolvedVenue.address_line1, resolvedVenue.city, resolvedVenue.postcode]
      .filter(Boolean)
      .join(", ");
  const siteLatRaw = (booking as any).site_latitude;
  const siteLngRaw = (booking as any).site_longitude;
  const hasSiteCoords =
    siteLatRaw != null &&
    siteLngRaw != null &&
    Number.isFinite(Number(siteLatRaw)) &&
    Number.isFinite(Number(siteLngRaw));
  const venueLat: number | null = hasSiteCoords ? Number(siteLatRaw) : resolvedVenue.latitude;
  const venueLng: number | null = hasSiteCoords ? Number(siteLngRaw) : resolvedVenue.longitude;

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
    .select(
      "id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills, night_shifts_ok, weekend_only, max_travel_distance"
    )
    .eq("is_active", true)
    .eq("is_available", true)
    .order("shield_score", { ascending: false })
    .limit(100);

  candidates = availableGuards ?? [];
  console.log(`[NOTIFY-GUARDS] Found ${candidates.length} active+available guards. Error: ${personnelErr?.message ?? "none"}`);

  if (candidates.length === 0) {
    const { data: activeGuards } = await supabase
      .from("personnel")
      .select(
        "id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills, night_shifts_ok, weekend_only, max_travel_distance"
      )
      .eq("is_active", true)
      .order("shield_score", { ascending: false })
      .limit(50);

    candidates = activeGuards ?? [];
    console.log(`[NOTIFY-GUARDS] Fallback: found ${candidates.length} active guards (ignoring is_available).`);
  }

  if (candidates.length === 0) {
    const { data: allGuards } = await supabase
      .from("personnel")
      .select(
        "id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills, night_shifts_ok, weekend_only, max_travel_distance"
      )
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
  if (candidateIds.length > 0 && !urgent) {
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

  const verifiedCandidates = [...candidates];
  let nearbyGuards = candidates;
  const representativeShift = shifts[0];
  const { date: shiftDateStr, startTime: shiftStartLocal, endTime: shiftEndLocal } =
    shiftToLondonDateAndTimes(representativeShift.scheduled_start, representativeShift.scheduled_end);
  const startForCheck = toHHMMSS(shiftStartLocal);
  const endForCheck = toHHMMSS(shiftEndLocal);

  if (venueLat !== null && venueLng !== null) {
    const guardsWithCoords = candidates
      .filter((g) => g.latitude !== null && g.longitude !== null)
      .map((g) => {
        const distanceKm = haversineKm(venueLat, venueLng, g.latitude!, g.longitude!);
        const distanceMiles = distanceKm / MILES_TO_KM;
        const guardMaxMi =
          typeof g.max_travel_distance === "number" && g.max_travel_distance > 0
            ? g.max_travel_distance
            : DEFAULT_SEARCH_RADIUS_MILES;
        const effectiveMaxMi = Math.min(searchRadiusMiles, guardMaxMi);
        return {
          ...g,
          distanceKm,
          distanceMiles,
          effectiveMaxMi,
        };
      })
      .filter((g) => g.distanceKm <= g.effectiveMaxMi * MILES_TO_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const noCoords = candidates.filter((g) => g.latitude === null || g.longitude === null);

    if (guardsWithCoords.length > 0) {
      nearbyGuards = [...guardsWithCoords, ...noCoords];
    } else {
      console.log("[NOTIFY-GUARDS] No guards with coordinates in range. Notifying all candidates.");
    }
  } else {
    console.log("[NOTIFY-GUARDS] Venue has no coordinates. Skipping proximity filter.");
  }

  const typedSupabase = supabase as TypedSupabase;

  if (nearbyGuards.length > 0 && shifts.length > 0) {
    const beforePrefs = nearbyGuards.length;
    nearbyGuards = nearbyGuards.filter((guard) => {
      if (guard.weekend_only && !isWeekendLondon(representativeShift.scheduled_start)) {
        console.log(`[NOTIFY-GUARDS] Guard ${guard.id} skipped (weekend_only)`);
        return false;
      }
      if (isNightShiftStart(shiftStartLocal) && guard.night_shifts_ok === false) {
        console.log(`[NOTIFY-GUARDS] Guard ${guard.id} skipped (night_shifts_ok=false)`);
        return false;
      }
      return true;
    });
    console.log(`[NOTIFY-GUARDS] Preference filter: ${beforePrefs} -> ${nearbyGuards.length} guards`);

    const beforeDetailed = nearbyGuards.length;
    const detailedResults = await Promise.all(
      nearbyGuards.map(async (guard) => {
        const res = await checkPersonnelAvailabilityDetailed(
          typedSupabase,
          guard.id,
          shiftDateStr,
          startForCheck,
          endForCheck
        );
        if (!res.available) {
          console.log(
            `[NOTIFY-GUARDS] Guard ${guard.id} availability: ${res.reason ?? "unavailable"}`
          );
        }
        return { guard, ok: res.available };
      })
    );
    nearbyGuards = detailedResults.filter((r) => r.ok).map((r) => r.guard);
    console.log(`[NOTIFY-GUARDS] Normalized availability filter: ${beforeDetailed} -> ${nearbyGuards.length} guards`);
  }

  if (excludeIds.size > 0) {
    const before = nearbyGuards.length;
    nearbyGuards = nearbyGuards.filter((g) => !excludeIds.has(g.id));
    console.log(`[NOTIFY-GUARDS] Excluded withdrawn/unwanted personnel: ${before} -> ${nearbyGuards.length}`);
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

  // If strict radius/preference filters produced zero candidates, broaden dispatch.
  // We still enforce weekly/special availability + overlap checks.
  if (nearbyGuards.length === 0 && verifiedCandidates.length > 0) {
    console.log("[NOTIFY-GUARDS] Strict filters found zero guards; running broad availability fallback.");
    let broadGuards = verifiedCandidates.filter((g) => !excludeIds.has(g.id));

    const broadResults = await Promise.all(
      broadGuards.map(async (guard) => {
        const res = await checkPersonnelAvailabilityDetailed(
          typedSupabase,
          guard.id,
          shiftDateStr,
          startForCheck,
          endForCheck
        );
        return { guard, ok: res.available };
      })
    );
    broadGuards = broadResults.filter((r) => r.ok).map((r) => r.guard);

    if (broadGuards.length > 0) {
      const shiftStart = representativeShift.scheduled_start;
      const shiftEnd = representativeShift.scheduled_end;
      const guardIds = broadGuards.map((g) => g.id);

      const { data: busyShifts } = await supabase
        .from("shifts")
        .select("personnel_id")
        .in("personnel_id", guardIds)
        .in("status", ["accepted", "checked_in", "pending"])
        .lte("scheduled_start", shiftEnd)
        .gte("scheduled_end", shiftStart);

      const busyIds = new Set((busyShifts ?? []).map((s) => s.personnel_id));
      broadGuards = broadGuards.filter((g) => !busyIds.has(g.id));
    }

    console.log(`[NOTIFY-GUARDS] Broad fallback candidates: ${broadGuards.length}`);
    nearbyGuards = broadGuards;
  }

  const topGuards = nearbyGuards.slice(0, maxGuards);

  if (topGuards.length === 0) {
    return {
      guards_notified: 0,
      booking_id,
      processing_time_ms: Date.now() - runStarted,
    };
  }

  const expiresAt = new Date(Date.now() + offerExpirySeconds * 1000).toISOString();
  let totalOffers = 0;
  let totalPushes = 0;

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

  // Always refresh rows for this dispatch so mobile gets a fresh INSERT event.
  // Reused/upserted stale rows can keep old expiry and fail to re-trigger popup.
  const targetPersonnelIds = topGuards.map((g) => g.id);
  const { error: clearErr } = await supabase
    .from("shift_offers")
    .delete()
    .eq("shift_id", representativeShift.id)
    .in("personnel_id", targetPersonnelIds)
    .neq("status", "accepted");
  if (clearErr) {
    console.warn("[NOTIFY-GUARDS] Could not clear prior offers:", clearErr.message);
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("shift_offers")
    .insert(offerRecords)
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
        title: urgent ? `🚨 URGENT: Cover needed — ${eventName}` : `📋 ${eventName}`,
        body: urgent
          ? `${venueName} · £${avgRate}/hr · ${shiftDate} · ${shiftStartDisplay}-${shiftEndDisplay}${positionsText}${distanceStr}. Someone dropped — tap to claim!`
          : `${venueName} · £${avgRate}/hr · ${shiftDate} · ${shiftStartDisplay}-${shiftEndDisplay}${positionsText}${distanceStr}. Tap to accept!`,
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
    title: urgent ? `🚨 URGENT: Cover needed — ${eventName}` : `📋 ${eventName}`,
    body: urgent
      ? `${venueName} · £${avgRate}/hr · ${shiftDate} · ${shiftStartDisplay}-${shiftEndDisplay}${positionsText}. Tap to claim!`
      : `${venueName} · £${avgRate}/hr · ${shiftDate} · ${shiftStartDisplay}-${shiftEndDisplay}${positionsText}. Tap to accept!`,
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
