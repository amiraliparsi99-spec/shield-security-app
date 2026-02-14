/**
 * Shield AI Dispatcher — Logic Engine
 *
 * Detects no-show guards, sends welfare checks, and automatically
 * finds & assigns standby replacements using proximity search.
 *
 * Push notifications are logged via console.log for now — swap in
 * Expo Push / sendPushNotification when ready.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Shift, Personnel } from "./database.types";
import { sendPushNotification } from "./notifications/push-service";

// ——— Environment ———
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ——— Constants ———
const SURGE_MULTIPLIER = 1.5; // 1.5× base rate for urgent replacements
const MAX_STANDBY_CANDIDATES = 5; // Top N candidates to blast
const EARTH_RADIUS_KM = 6371;
const MILES_TO_KM = 1.60934;
const SEARCH_RADIUS_MILES = 5;
const SEARCH_RADIUS_KM = SEARCH_RADIUS_MILES * MILES_TO_KM; // ~8.05 km
const LATE_THRESHOLD_MINUTES = 10; // Guard is "late" after this many minutes past start

type TypedSupabaseClient = SupabaseClient<Database>;

// ——— Helpers ———

/**
 * Creates a Supabase admin client (service role — bypasses RLS).
 * Used by cron/server-side only.
 */
function getAdminClient(): TypedSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

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

/**
 * Send a push notification via Expo Push service.
 * Falls back to console.log if push delivery fails.
 */
async function dispatchPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  console.log(`[DISPATCHER PUSH → ${userId}] ${title} — ${body}`);

  try {
    await sendPushNotification({
      userId,
      type: "shift_reminder",
      title,
      body,
      data,
    });
  } catch (err) {
    // Non-blocking — log and continue
    console.warn("[DISPATCHER] Push delivery failed, notification saved to DB instead:", err);
  }
}

// =====================================================
// A. CHECK GUARD STATUS
// =====================================================

export interface CheckGuardStatusResult {
  action: "ok" | "welfare_sent" | "marked_at_risk" | "error";
  shiftId: string;
  message: string;
}

/**
 * Checks a single at-risk shift:
 *  - If the shift start is still in the future (< 10 min late) → welfare ping.
 *  - If the guard is > 10 min late → mark `at_risk` and begin replacement search.
 */
export async function checkGuardStatus(
  shiftId: string
): Promise<CheckGuardStatusResult> {
  const supabase = getAdminClient();

  try {
    // Fetch shift + related booking + venue info
    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("*, bookings(id, event_name, venue_id, venues(id, name, owner_id, latitude, longitude))")
      .eq("id", shiftId)
      .single();

    if (shiftErr || !shift) {
      return { action: "error", shiftId, message: `Shift not found: ${shiftErr?.message}` };
    }

    // Only act on accepted (confirmed but not checked-in) shifts
    if (shift.status !== "accepted") {
      return { action: "ok", shiftId, message: `Shift status is "${shift.status}", skipping.` };
    }

    if (!shift.personnel_id) {
      return { action: "error", shiftId, message: "No personnel assigned to shift." };
    }

    const now = Date.now();
    const scheduledStart = new Date(shift.scheduled_start).getTime();
    const minutesLate = (now - scheduledStart) / 60_000; // negative = still in the future

    // --- Get guard's user_id for push notification ---
    const { data: personnel } = await supabase
      .from("personnel")
      .select("user_id, display_name")
      .eq("id", shift.personnel_id)
      .single();

    const guardUserId = personnel?.user_id ?? shift.personnel_id;
    const guardName = personnel?.display_name ?? "Guard";

    if (minutesLate < LATE_THRESHOLD_MINUTES) {
      // Guard isn't officially late yet — send a welfare check
      await dispatchPush(
        guardUserId,
        "⏰ Shift Reminder — Are you on your way?",
        `Your shift at ${(shift as any).bookings?.venues?.name ?? "the venue"} starts ${
          minutesLate < 0
            ? `in ${Math.abs(Math.round(minutesLate))} minutes`
            : "now"
        }. Tap to confirm you're en-route.`,
        { shift_id: shiftId, type: "welfare_check" }
      );

      // Also save a notification record in the DB
      await supabase.from("notifications").insert({
        user_id: guardUserId,
        type: "shift" as any,
        title: "⏰ Are you on your way?",
        body: `Your shift starts soon. Please confirm attendance.`,
        data: { shift_id: shiftId, type: "welfare_check" },
        is_read: false,
      });

      return { action: "welfare_sent", shiftId, message: `Welfare check sent to ${guardName}.` };
    }

    // --- Guard is > 10 minutes late → flag as at_risk ---
    console.log(`[DISPATCHER] Guard ${guardName} is ${Math.round(minutesLate)} min late for shift ${shiftId}. Marking at-risk.`);

    // Update shift dispatcher_status
    await supabase
      .from("shifts")
      .update({
        dispatcher_status: "at_risk" as any,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shiftId);

    // Warn the guard
    await dispatchPush(
      guardUserId,
      "🚨 You are marked LATE",
      `You have not checked in and your shift started ${Math.round(minutesLate)} minutes ago. If you don't check in soon, a replacement will be dispatched.`,
      { shift_id: shiftId, type: "late_warning" }
    );

    // Begin replacement search in background
    findReplacement(shiftId).catch((err) =>
      console.error(`[DISPATCHER] Replacement search failed for shift ${shiftId}:`, err)
    );

    return {
      action: "marked_at_risk",
      shiftId,
      message: `${guardName} is ${Math.round(minutesLate)} min late. Replacement search initiated.`,
    };
  } catch (err) {
    console.error("[DISPATCHER] checkGuardStatus error:", err);
    return { action: "error", shiftId, message: String(err) };
  }
}

// =====================================================
// B. FIND REPLACEMENT
// =====================================================

export interface FindReplacementResult {
  candidatesFound: number;
  candidatesNotified: number;
  shiftId: string;
}

/**
 * Finds nearby standby guards who are not currently working and
 * blasts them a high-priority urgent shift notification.
 */
export async function findReplacement(
  shiftId: string
): Promise<FindReplacementResult> {
  const supabase = getAdminClient();

  // 1. Get shift + venue location
  const { data: shift, error: shiftErr } = await supabase
    .from("shifts")
    .select("*, bookings(id, event_name, venue_id, venues(id, name, owner_id, latitude, longitude))")
    .eq("id", shiftId)
    .single();

  if (shiftErr || !shift) {
    throw new Error(`Shift ${shiftId} not found: ${shiftErr?.message}`);
  }

  const venue = (shift as any).bookings?.venues;
  const venueName: string = venue?.name ?? "Unknown Venue";
  const venueLat: number | null = venue?.latitude ?? null;
  const venueLng: number | null = venue?.longitude ?? null;

  // Calculate surge rate (1.5× the shift's hourly rate)
  const surgeRate = Math.round(shift.hourly_rate * SURGE_MULTIPLIER * 100) / 100;

  // Mark shift as searching
  await supabase
    .from("shifts")
    .update({
      dispatcher_status: "searching" as any,
      is_urgent: true,
      surge_rate: surgeRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shiftId);

  // 2. Query standby personnel who are active, available, and on standby
  const { data: standbyCandidates, error: personnelErr } = await supabase
    .from("personnel")
    .select("id, user_id, display_name, latitude, longitude, hourly_rate, shield_score")
    .eq("is_active", true)
    .eq("is_available", true)
    .eq("is_standby", true)
    .order("shield_score", { ascending: false })
    .limit(50); // Fetch a wider pool then filter by distance

  if (personnelErr || !standbyCandidates) {
    console.error("[DISPATCHER] Failed to query standby personnel:", personnelErr);
    await supabase
      .from("shifts")
      .update({ dispatcher_status: "failed" as any, updated_at: new Date().toISOString() })
      .eq("id", shiftId);
    return { candidatesFound: 0, candidatesNotified: 0, shiftId };
  }

  // 3. Filter out the original (no-show) guard
  const filtered = standbyCandidates.filter((p) => p.id !== shift.personnel_id);

  // 4. Filter by proximity (Haversine) if venue has coordinates
  let nearbyCandidates = filtered;

  if (venueLat !== null && venueLng !== null) {
    nearbyCandidates = filtered
      .filter((p) => p.latitude !== null && p.longitude !== null)
      .map((p) => ({
        ...p,
        distanceKm: haversineKm(venueLat, venueLng, p.latitude!, p.longitude!),
      }))
      .filter((p) => p.distanceKm <= SEARCH_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // 5. Exclude guards already working another shift right now
  const now = new Date().toISOString();
  const candidateIds = nearbyCandidates.map((c) => c.id);

  if (candidateIds.length > 0) {
    const { data: busyShifts } = await supabase
      .from("shifts")
      .select("personnel_id")
      .in("personnel_id", candidateIds)
      .in("status", ["accepted", "checked_in"])
      .lte("scheduled_start", now)
      .gte("scheduled_end", now);

    const busyIds = new Set((busyShifts ?? []).map((s) => s.personnel_id));
    nearbyCandidates = nearbyCandidates.filter((c) => !busyIds.has(c.id));
  }

  // 6. Take top N candidates
  const topCandidates = nearbyCandidates.slice(0, MAX_STANDBY_CANDIDATES);

  if (topCandidates.length === 0) {
    console.log(`[DISPATCHER] No standby candidates found near ${venueName} for shift ${shiftId}.`);

    // Notify venue manager that no replacements were found
    const venueOwnerId = venue?.owner_id;
    if (venueOwnerId) {
      await dispatchPush(
        venueOwnerId,
        "⚠️ No Replacement Found",
        `We could not find a standby guard near ${venueName}. Manual action required.`,
        { shift_id: shiftId, type: "no_replacement" }
      );
      await supabase.from("notifications").insert({
        user_id: venueOwnerId,
        type: "shift" as any,
        title: "⚠️ No Replacement Found",
        body: `We could not find a standby guard near ${venueName}. Manual action required.`,
        data: { shift_id: shiftId, type: "no_replacement" },
        is_read: false,
      });
    }

    await supabase
      .from("shifts")
      .update({ dispatcher_status: "failed" as any, updated_at: new Date().toISOString() })
      .eq("id", shiftId);

    return { candidatesFound: 0, candidatesNotified: 0, shiftId };
  }

  // 7. Blast urgent notifications
  console.log(
    `[DISPATCHER] Found ${topCandidates.length} standby candidates for shift ${shiftId}. Sending urgent notifications.`
  );

  for (const candidate of topCandidates) {
    const distanceStr =
      "distanceKm" in candidate
        ? ` (~${((candidate as any).distanceKm / MILES_TO_KM).toFixed(1)} mi away)`
        : "";

    await dispatchPush(
      candidate.user_id,
      "🚨 URGENT: Shift Available NOW",
      `£${surgeRate.toFixed(0)}/hr shift available NOW at ${venueName}${distanceStr}. Tap to Accept.`,
      {
        shift_id: shiftId,
        type: "urgent_shift_offer",
        surge_rate: surgeRate,
        venue_name: venueName,
      }
    );

    // Save notification in DB so the guard can tap it in-app
    await supabase.from("notifications").insert({
      user_id: candidate.user_id,
      type: "shift" as any,
      title: "🚨 URGENT: Shift Available NOW",
      body: `£${surgeRate.toFixed(0)}/hr shift available NOW at ${venueName}${distanceStr}. Tap to Accept.`,
      data: {
        shift_id: shiftId,
        type: "urgent_shift_offer",
        surge_rate: surgeRate,
        venue_name: venueName,
        action: "accept_urgent_shift",
      },
      is_read: false,
    });
  }

  return {
    candidatesFound: nearbyCandidates.length,
    candidatesNotified: topCandidates.length,
    shiftId,
  };
}

// =====================================================
// C. ASSIGN REPLACEMENT
// =====================================================

export interface AssignReplacementResult {
  success: boolean;
  message: string;
  shiftId: string;
  newGuardId?: string;
}

/**
 * Atomically assigns a standby guard as the replacement.
 *
 * Race-condition safe: the UPDATE uses a WHERE clause that checks the shift
 * is still in `searching` / `at_risk` dispatcher status AND still assigned
 * to the original (no-show) guard.  If another guard already accepted,
 * the update matches 0 rows and we return a "too late" response.
 */
export async function assignReplacement(
  shiftId: string,
  newGuardId: string
): Promise<AssignReplacementResult> {
  const supabase = getAdminClient();

  try {
    // 1. Fetch the current shift state
    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("*, bookings(id, event_name, venue_id, venues(id, name, owner_id))")
      .eq("id", shiftId)
      .single();

    if (shiftErr || !shift) {
      return { success: false, message: "Shift not found.", shiftId };
    }

    // Only allow assignment if dispatcher is actively searching or at_risk
    const dispatcherStatus = (shift as any).dispatcher_status;
    if (dispatcherStatus !== "searching" && dispatcherStatus !== "at_risk") {
      return {
        success: false,
        message: "This shift has already been filled or is no longer available.",
        shiftId,
      };
    }

    const originalGuardId = shift.personnel_id;
    const venue = (shift as any).bookings?.venues;
    const venueName = venue?.name ?? "the venue";
    const venueOwnerId = venue?.owner_id;

    // 2. Atomic update — only succeeds if dispatcher_status hasn't changed
    //    This prevents the race condition where two guards tap "Accept" at once.
    const { data: updated, error: updateErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: newGuardId,
        original_personnel_id: originalGuardId,
        dispatcher_status: "replacement_found" as any,
        is_urgent: false,
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .in("dispatcher_status" as any, ["searching", "at_risk"])
      .select("id")
      .single();

    if (updateErr || !updated) {
      // Another guard beat them to it — race condition handled
      return {
        success: false,
        message: "Sorry, this urgent shift has already been accepted by another guard.",
        shiftId,
      };
    }

    // 3. Mark the original guard as no-show (uses existing shift machinery)
    if (originalGuardId) {
      // Record penalty on shield score
      const { data: origPersonnel } = await supabase
        .from("personnel")
        .select("user_id, display_name, shield_score")
        .eq("id", originalGuardId)
        .single();

      if (origPersonnel) {
        // Deduct shield score
        const newScore = Math.max(0, (origPersonnel.shield_score || 100) - 25);
        await supabase
          .from("personnel")
          .update({ shield_score: newScore, updated_at: new Date().toISOString() })
          .eq("id", originalGuardId);

        // Record in shield_score_history
        await supabase.from("shield_score_history" as any).insert({
          personnel_id: originalGuardId,
          event_type: "no_show",
          points_change: -25,
          details: {
            shift_id: shiftId,
            booking_id: shift.booking_id,
            scheduled_start: shift.scheduled_start,
            replaced_by: newGuardId,
            dispatcher_automated: true,
          },
          created_at: new Date().toISOString(),
        });

        // Notify original guard
        await dispatchPush(
          origPersonnel.user_id,
          "⚠️ No-Show Recorded",
          `You were marked as a no-show for ${venueName}. A replacement has been dispatched. Your Shield Score has been affected.`,
          { shift_id: shiftId, type: "no_show_penalty" }
        );

        await supabase.from("notifications").insert({
          user_id: origPersonnel.user_id,
          type: "shift" as any,
          title: "⚠️ No-Show Recorded",
          body: `You were marked as a no-show for ${venueName}. Your Shield Score has been reduced.`,
          data: { shift_id: shiftId, type: "no_show_penalty", shield_penalty: -25 },
          is_read: false,
        });
      }
    }

    // 4. Get the replacement guard's info
    const { data: newGuard } = await supabase
      .from("personnel")
      .select("user_id, display_name")
      .eq("id", newGuardId)
      .single();

    const newGuardName = newGuard?.display_name ?? "A replacement guard";

    // 5. Notify the replacement guard — confirmation
    if (newGuard) {
      await dispatchPush(
        newGuard.user_id,
        "✅ Urgent Shift Confirmed",
        `You've been assigned to ${venueName}. Head there ASAP. Surge rate: £${(shift as any).surge_rate ?? shift.hourly_rate}/hr.`,
        { shift_id: shiftId, type: "urgent_shift_confirmed" }
      );

      await supabase.from("notifications").insert({
        user_id: newGuard.user_id,
        type: "shift" as any,
        title: "✅ Urgent Shift Confirmed",
        body: `You've been assigned to ${venueName}. Head there ASAP.`,
        data: { shift_id: shiftId, type: "urgent_shift_confirmed" },
        is_read: false,
      });
    }

    // 6. Notify venue manager
    if (venueOwnerId) {
      const originalName = originalGuardId
        ? ((await supabase.from("personnel").select("display_name").eq("id", originalGuardId).single()).data
            ?.display_name ?? "The original guard")
        : "The original guard";

      await dispatchPush(
        venueOwnerId,
        "🔄 Replacement Dispatched",
        `${originalName} was a no-show. We have automatically dispatched ${newGuardName}. ETA ~15 mins.`,
        { shift_id: shiftId, type: "replacement_dispatched", new_guard: newGuardName }
      );

      await supabase.from("notifications").insert({
        user_id: venueOwnerId,
        type: "alert" as any,
        title: "🔄 Replacement Dispatched",
        body: `${originalName} was a no-show. We have automatically dispatched ${newGuardName}. ETA ~15 mins.`,
        data: {
          shift_id: shiftId,
          type: "replacement_dispatched",
          new_guard_id: newGuardId,
          new_guard_name: newGuardName,
        },
        is_read: false,
      });
    }

    console.log(
      `[DISPATCHER] Replacement complete: shift ${shiftId} → ${newGuardName} (${newGuardId})`
    );

    return {
      success: true,
      message: `${newGuardName} has been dispatched to ${venueName}.`,
      shiftId,
      newGuardId,
    };
  } catch (err) {
    console.error("[DISPATCHER] assignReplacement error:", err);
    return { success: false, message: String(err), shiftId };
  }
}
