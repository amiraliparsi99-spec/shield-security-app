/**
 * Notify Guards — Smart Matching API
 *
 * Called after a venue creates a booking with unassigned shifts.
 * Finds nearby, available, qualified guards and sends each one a
 * targeted push notification + creates a shift_offer record that
 * triggers a real-time Uber-style popup on the mobile app.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";

// ——— Environment ———
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ——— Constants ———
const EARTH_RADIUS_KM = 6371;
const MILES_TO_KM = 1.60934;
const DEFAULT_SEARCH_RADIUS_MILES = 15; // Wider radius for new job posts (not urgent)
const MAX_GUARDS_TO_NOTIFY = 20; // Notify up to 20 nearby guards
const OFFER_EXPIRY_SECONDS = 60; // 60 seconds to accept

/**
 * Haversine distance between two lat/lng pairs in kilometres.
 */
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Parse body ---
    const body = await request.json();
    const { booking_id, radius_miles } = body as {
      booking_id?: string;
      radius_miles?: number;
    };

    if (!booking_id || typeof booking_id !== "string") {
      return NextResponse.json(
        { error: "booking_id is required" },
        { status: 400 }
      );
    }

    const searchRadiusMiles = radius_miles ?? DEFAULT_SEARCH_RADIUS_MILES;
    const searchRadiusKm = searchRadiusMiles * MILES_TO_KM;

    // --- 1. Load booking + venue + unassigned shifts ---
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*, venues(id, name, user_id, address_line1, city, postcode, latitude, longitude)")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      console.error("[NOTIFY-GUARDS] Booking lookup failed:", bookingErr?.message, "booking_id:", booking_id);
      return NextResponse.json(
        { error: "Booking not found", details: bookingErr?.message },
        { status: 404 }
      );
    }

    // The venue join may come back as "venues" (plural) or as a nested object
    const venue = (booking as any).venues ?? (booking as any).venue;
    if (!venue) {
      // Fallback: query venue separately using venue_id
      console.log("[NOTIFY-GUARDS] Venue join failed, fetching separately. venue_id:", (booking as any).venue_id);
      const { data: venueFallback } = await supabase
        .from("venues")
        .select("id, name, owner_id, address_line1, city, postcode, latitude, longitude")
        .eq("id", (booking as any).venue_id)
        .single();

      if (!venueFallback) {
        return NextResponse.json(
          { error: "Venue not found for this booking" },
          { status: 404 }
        );
      }
      Object.assign(booking, { _venue: venueFallback });
    }

    const resolvedVenue = venue ?? (booking as any)._venue;
    const venueName: string = resolvedVenue.name ?? "Unknown Venue";
    const venueAddress = [resolvedVenue.address_line1, resolvedVenue.city, resolvedVenue.postcode]
      .filter(Boolean)
      .join(", ");
    const venueLat: number | null = resolvedVenue.latitude;
    const venueLng: number | null = resolvedVenue.longitude;

    // Get unassigned shifts for this booking
    const { data: shifts, error: shiftsErr } = await supabase
      .from("shifts")
      .select("id, role, hourly_rate, scheduled_start, scheduled_end, status")
      .eq("booking_id", booking_id)
      .is("personnel_id", null)
      .in("status", ["pending"]);

    if (shiftsErr || !shifts || shifts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unassigned shifts to notify about.",
        guards_notified: 0,
      });
    }

    // --- 2. Find candidate guards ---
    let candidates: any[] = [];

    // Try active + available first
    const { data: availableGuards, error: personnelErr } = await supabase
      .from("personnel")
      .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills")
      .eq("is_active", true)
      .eq("is_available", true)
      .order("shield_score", { ascending: false })
      .limit(100);

    candidates = availableGuards ?? [];
    console.log(`[NOTIFY-GUARDS] Found ${candidates.length} active+available guards. Error: ${personnelErr?.message ?? 'none'}`);

    // Fallback: if no available guards, try all active guards
    if (candidates.length === 0) {
      const { data: activeGuards } = await supabase
        .from("personnel")
        .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills")
        .eq("is_active", true)
        .order("shield_score", { ascending: false })
        .limit(50);

      candidates = activeGuards ?? [];
      console.log(`[NOTIFY-GUARDS] Fallback: found ${candidates.length} active guards (ignoring is_available).`);
    }

    // Last resort: try ALL personnel
    if (candidates.length === 0) {
      const { data: allGuards } = await supabase
        .from("personnel")
        .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score, skills")
        .order("shield_score", { ascending: false })
        .limit(50);

      candidates = allGuards ?? [];
      console.log(`[NOTIFY-GUARDS] Last resort: found ${candidates.length} personnel total.`);
    }

    if (candidates.length === 0) {
      console.log("[NOTIFY-GUARDS] No personnel found at all in the database.");
      return NextResponse.json({
        success: true,
        message: "No guards found in the system.",
        guards_notified: 0,
      });
    }

    // --- 3. Filter by proximity (skip if no coordinates) ---
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

      // If proximity filter found matches, use them. Otherwise keep all guards (no coords = notify everyone)
      if (guardsWithCoords.length > 0) {
        nearbyGuards = guardsWithCoords;
      } else {
        console.log("[NOTIFY-GUARDS] No guards with coordinates in range. Notifying all candidates.");
      }
    } else {
      console.log("[NOTIFY-GUARDS] Venue has no coordinates. Skipping proximity filter.");
    }

    // --- 4. Exclude guards already working at this time ---
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

    // --- 5. Take top N ---
    const topGuards = nearbyGuards.slice(0, MAX_GUARDS_TO_NOTIFY);

    if (topGuards.length === 0) {
      console.log("[NOTIFY-GUARDS] No nearby available guards after filtering.");
      return NextResponse.json({
        success: true,
        message: "No eligible guards found nearby.",
        guards_notified: 0,
      });
    }

    // --- 6. Create shift_offers + send push for each shift × guard ---
    const expiresAt = new Date(Date.now() + OFFER_EXPIRY_SECONDS * 1000).toISOString();
    let totalOffers = 0;
    let totalPushes = 0;

    // Use the first shift as the representative (for the notification)
    // but create offers for all unassigned shifts
    for (const shift of shifts) {
      const shiftDate = new Date(shift.scheduled_start).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const startTime = new Date(shift.scheduled_start).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTime = new Date(shift.scheduled_end).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Build offer records
      const offerRecords = topGuards.map((guard) => ({
        shift_id: shift.id,
        personnel_id: guard.id,
        status: "pending",
        hourly_rate: shift.hourly_rate,
        venue_name: venueName,
        venue_address: venueAddress || null,
        venue_latitude: venueLat,
        venue_longitude: venueLng,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        distance_miles:
          "distanceMiles" in guard
            ? Math.round((guard as any).distanceMiles * 10) / 10
            : null,
        expires_at: expiresAt,
      }));

      // Insert offers (ignore conflicts — guard may already have an offer for this shift)
      const { data: inserted, error: insertErr } = await supabase
        .from("shift_offers")
        .upsert(offerRecords, { onConflict: "shift_id,personnel_id", ignoreDuplicates: true })
        .select("id, personnel_id");

      if (insertErr) {
        console.error("[NOTIFY-GUARDS] Error inserting offers:", insertErr.message);
        continue;
      }

      totalOffers += inserted?.length ?? 0;

      // Send push notifications
      for (const guard of topGuards) {
        const distanceStr =
          "distanceMiles" in guard
            ? ` (${(guard as any).distanceMiles.toFixed(1)} mi away)`
            : "";

        try {
          await sendPushNotification({
            userId: guard.user_id,
            type: "new_booking",
            title: `📋 New Shift at ${venueName}`,
            body: `£${shift.hourly_rate}/hr · ${shiftDate} · ${startTime}-${endTime}${distanceStr}. Tap to accept!`,
            data: {
              type: "new_shift_offer",
              shift_id: shift.id,
              booking_id: booking_id,
              venue_name: venueName,
              hourly_rate: shift.hourly_rate,
              action: "open_shift_offer",
            },
          });
          totalPushes++;
        } catch (pushErr) {
          console.warn(`[NOTIFY-GUARDS] Push failed for ${guard.user_id}:`, pushErr);
        }
      }

      // Also save in-app notifications
      const notificationRecords = topGuards.map((guard) => ({
        user_id: guard.user_id,
        type: "shift" as const,
        title: `📋 New Shift at ${venueName}`,
        body: `£${shift.hourly_rate}/hr · ${shiftDate} · ${startTime}-${endTime}. Tap to accept!`,
        data: {
          type: "new_shift_offer",
          shift_id: shift.id,
          booking_id: booking_id,
          venue_name: venueName,
          hourly_rate: shift.hourly_rate,
          action: "open_shift_offer",
        },
        is_read: false,
      }));

      await supabase.from("notifications").insert(notificationRecords);
    }

    console.log(
      `[NOTIFY-GUARDS] Created ${totalOffers} offers, sent ${totalPushes} push notifications for booking ${booking_id}`
    );

    return NextResponse.json({
      success: true,
      booking_id,
      shifts_count: shifts.length,
      guards_notified: topGuards.length,
      offers_created: totalOffers,
      pushes_sent: totalPushes,
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[NOTIFY-GUARDS] Error:", error);
    return NextResponse.json(
      { error: "Failed to notify guards" },
      { status: 500 }
    );
  }
}
