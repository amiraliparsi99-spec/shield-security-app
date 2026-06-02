/**
 * Pre-shift travel risk cron.
 *
 * Runs every 5 minutes (see vercel.json). For each `accepted` shift whose
 * scheduled_start sits inside a ±60 min window:
 *
 *   1. Resolves site coords (booking pin → venue centroid fallback)
 *   2. Resolves venue rural/critical flags + per-shift-type ladder
 *   3. Evaluates the ring engine (`evaluateTravelRisk`)
 *   4. On escalation: writes audit row, posts MC chat, sends pushes
 *   5. On R5: fires Wave 1 cover offers (auto-cover engine)
 *   6. On R6: flips shift to no_show + bumps cover to Wave 2
 *
 * Concept docs:
 *   - docs/PRE_SHIFT_ABSENCE_ESCALATION.md (detection rings)
 *   - docs/SHIFT_COVER_ESCALATION_PLAN.md (response: cover sourcing)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCronAuth } from "@/lib/auth/cronAuth";
import {
  REMINDER_KINDS,
  insertMissionControlSystemMessage,
  markReminderSent,
  reminderAlreadySent,
} from "@/lib/mission-control/shiftReminders";
import { sendPushNotification } from "@/lib/notifications/push-service";
import {
  adjustThresholdsForShiftType,
  evaluateTravelRisk,
  resolveThresholdsFromEnv,
  ringSeverity,
  ruralMultiplierFromEnv,
  type TravelRing,
} from "@/lib/shifts/travelRisk";
import {
  kickoffCoverWave1,
  markShiftNoShow,
} from "@/lib/shifts/coverEngine";
import { isMissingColumnError } from "@/lib/postgresErrors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const RING_KIND_MAP: Record<Exclude<TravelRing, "none">, string> = {
  R3: REMINDER_KINDS.ETA_R3_STATUS_UNCLEAR,
  R4: REMINDER_KINDS.ETA_R4_AMBER,
  R5: REMINDER_KINDS.ETA_R5_RED,
  R6: REMINDER_KINDS.ETA_R6_NO_SHOW,
};

type ShiftRow = {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  role: string | null;
  is_urgent?: boolean | null;
  travel_risk?: string | null;
  travel_risk_evaluated_at?: string | null;
  cover_search_wave?: number | null;
  cover_search_started_at?: string | null;
  cover_search_last_wave_at?: string | null;
};

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const lowerBound = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const upperBound = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  // Tolerantly select the new columns. If the migration hasn't run yet we
  // fall back to a basic select so the cron stays alive.
  const richSelect =
    "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, role, is_urgent, travel_risk, travel_risk_evaluated_at, cover_search_wave, cover_search_started_at, cover_search_last_wave_at";
  const basicSelect =
    "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, role";

  let shifts: ShiftRow[] | null = null;
  const richResp = await supabase
    .from("shifts")
    .select(richSelect)
    .eq("status", "accepted")
    .not("personnel_id", "is", null)
    .gte("scheduled_start", lowerBound)
    .lte("scheduled_start", upperBound);
  if (richResp.error) {
    if (isMissingColumnError(richResp.error)) {
      const fb = await supabase
        .from("shifts")
        .select(basicSelect)
        .eq("status", "accepted")
        .not("personnel_id", "is", null)
        .gte("scheduled_start", lowerBound)
        .lte("scheduled_start", upperBound);
      shifts = (fb.data as ShiftRow[]) ?? null;
    } else {
      console.error("[ETA-CRON] shifts query:", richResp.error);
      return NextResponse.json({ error: richResp.error.message }, { status: 500 });
    }
  } else {
    shifts = (richResp.data as ShiftRow[]) ?? null;
  }

  let evaluated = 0;
  let escalated = 0;
  const errors: string[] = [];

  for (const shift of shifts ?? []) {
    try {
      evaluated++;

      // Resolve the site coordinates: booking site pin first, venue centroid
      // as the fallback. This matches what the check-in API does.
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, venue_id, event_name, site_latitude, site_longitude")
        .eq("id", shift.booking_id)
        .single();

      if (!booking?.venue_id) continue;

      let siteLat: number | null =
        typeof booking.site_latitude === "number" ? booking.site_latitude : null;
      let siteLng: number | null =
        typeof booking.site_longitude === "number" ? booking.site_longitude : null;
      let venueName = "the venue";
      let venueIsRural = false;
      let venueIsCritical = false;

      // Try to read the rural/critical flags; fall back gracefully if the
      // migration hasn't run yet.
      type VenueRowLite = {
        name: string | null;
        latitude: number | null;
        longitude: number | null;
        user_id: string | null;
        is_rural?: boolean | null;
        is_critical?: boolean | null;
      };
      const venueResp = await supabase
        .from("venues")
        .select("name, latitude, longitude, user_id, is_rural, is_critical")
        .eq("id", booking.venue_id)
        .single();
      let venueRow: VenueRowLite | null = null;
      if (venueResp.error) {
        if (isMissingColumnError(venueResp.error)) {
          const fb = await supabase
            .from("venues")
            .select("name, latitude, longitude, user_id")
            .eq("id", booking.venue_id)
            .single();
          venueRow = (fb.data as unknown as VenueRowLite | null) ?? null;
        }
      } else {
        venueRow = venueResp.data as unknown as VenueRowLite | null;
      }

      if (venueRow?.name) venueName = venueRow.name;
      if (siteLat == null && typeof venueRow?.latitude === "number") siteLat = venueRow.latitude;
      if (siteLng == null && typeof venueRow?.longitude === "number") siteLng = venueRow.longitude;
      venueIsRural = venueRow?.is_rural === true;
      venueIsCritical = venueRow?.is_critical === true;

      // Latest GPS sample for this shift, if any.
      const { data: gpsRow } = await supabase
        .from("shift_gps_log")
        .select("lat, lng, accuracy, recorded_at")
        .eq("shift_id", shift.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle() as {
          data: {
            lat: number;
            lng: number;
            accuracy: number | null;
            recorded_at: string;
          } | null;
        };

      // Count peers on the same booking to decide which ladder to use.
      const { count: peerCount } = await supabase
        .from("shifts")
        .select("id", { head: true, count: "exact" })
        .eq("booking_id", shift.booking_id)
        .eq("status", "accepted");

      const totalAccepted = peerCount ?? 1;
      const baseThresholds = resolveThresholdsFromEnv();
      const thresholds = adjustThresholdsForShiftType(baseThresholds, {
        singleGuardDoor: totalAccepted <= 1 && !venueIsCritical,
        multiGuardEvent: totalAccepted >= 3,
        urgent: shift.is_urgent === true,
        criticalVenue: venueIsCritical,
        rural: venueIsRural,
        ruralMultiplier: ruralMultiplierFromEnv(),
      });

      const result = evaluateTravelRisk({
        now,
        scheduledStartIso: shift.scheduled_start,
        status: shift.status,
        site: siteLat != null && siteLng != null ? { lat: siteLat, lng: siteLng } : null,
        latestGps: gpsRow
          ? {
              lat: gpsRow.lat,
              lng: gpsRow.lng,
              accuracy_m: gpsRow.accuracy ?? undefined,
              recorded_at: gpsRow.recorded_at,
            }
          : null,
        thresholds,
      });

      // Persist the latest evaluation regardless of escalation, so the UI
      // can show "we last looked at HH:MM, ring=R3" rather than going stale.
      const { error: updErr } = await supabase
        .from("shifts")
        .update({
          travel_risk: result.ring,
          travel_risk_evaluated_at: now.toISOString(),
        })
        .eq("id", shift.id);
      if (updErr && !isMissingColumnError(updErr)) {
        errors.push(`update travel_risk ${shift.id}: ${updErr.message}`);
      }

      // No escalation needed if the engine says we're fine.
      if (result.ring === "none") continue;

      const previousRing = (shift.travel_risk as TravelRing | null) ?? "none";
      const escalating = ringSeverity(result.ring) > ringSeverity(previousRing);
      if (!escalating) continue;

      // Idempotency: each ring fires its messages at most once per shift.
      const reminderKind = RING_KIND_MAP[result.ring];
      if (await reminderAlreadySent(supabase, shift.id, reminderKind)) continue;

      // Resolve venue user + Mission Control chat for messaging.
      const { data: gc } = await supabase
        .from("group_chats")
        .select("id")
        .eq("booking_id", shift.booking_id)
        .eq("chat_type", "mission_control")
        .eq("is_active", true)
        .maybeSingle();

      const { data: persRow } = await supabase
        .from("personnel")
        .select("user_id, first_name, display_name")
        .eq("id", shift.personnel_id as string)
        .maybeSingle();

      const guardLabel =
        (persRow?.display_name?.trim() || persRow?.first_name?.trim() || "your guard") as string;

      // Audit row first — even if downstream sends fail, we have a record.
      const { error: auditErr } = await (supabase as any)
        .from("shift_travel_risk_events")
        .insert({
          shift_id: shift.id,
          personnel_id: shift.personnel_id,
          ring: result.ring,
          trigger_reason: result.reason,
          distance_m: result.distanceM,
          last_gps_at: gpsRow?.recorded_at ?? null,
          minutes_to_start: result.minutesToStart,
          metadata: {
            gps_age_seconds: result.gpsAgeSeconds,
            peer_count: totalAccepted,
            previous_ring: previousRing,
          },
        });
      if (auditErr) {
        console.error(`[ETA-CRON] audit insert failed (${shift.id}):`, auditErr.message);
        errors.push(`audit ${shift.id}: ${auditErr.message}`);
      }

      const venueUserId = venueRow?.user_id ?? null;
      const groupChatId = gc?.id ?? null;
      const ringCopy = buildRingCopy(result.ring, guardLabel, venueName, result);

      if (venueUserId && groupChatId && ringCopy.venueMessage) {
        await insertMissionControlSystemMessage({
          supabase,
          groupChatId,
          senderId: venueUserId,
          content: ringCopy.venueMessage,
          metadata: {
            type: "shift_travel_risk",
            ring: result.ring,
            shift_id: shift.id,
            booking_id: shift.booking_id,
            distance_m: result.distanceM,
            minutes_to_start: result.minutesToStart,
            live_check_in_path: "/d/venue/live",
          },
        });
      }

      if (venueUserId && ringCopy.venuePush) {
        await sendPushNotification({
          userId: venueUserId,
          type: "shift_reminder",
          title: ringCopy.venuePush.title,
          body: ringCopy.venuePush.body,
          data: {
            shift_id: shift.id,
            booking_id: shift.booking_id,
            ring: result.ring,
            reminder_kind: reminderKind,
          },
        });
      }

      if (persRow?.user_id && ringCopy.guardPush) {
        await sendPushNotification({
          userId: persRow.user_id,
          type: "shift_reminder",
          title: ringCopy.guardPush.title,
          body: ringCopy.guardPush.body,
          data: {
            shift_id: shift.id,
            booking_id: shift.booking_id,
            ring: result.ring,
            reminder_kind: reminderKind,
          },
        });
      }

      await markReminderSent(supabase, shift.id, reminderKind);
      escalated++;

      // ---- AUTO COVER ENGINE -----------------------------------------------
      // R5: source cover *while* the original guard still has a chance to
      // recover. Idempotent — if cover_search_wave is already >= 1, the
      // engine no-ops.
      if (result.ring === "R5") {
        try {
          await kickoffCoverWave1({
            supabase: supabase as any,
            shift: {
              id: shift.id,
              booking_id: shift.booking_id,
              personnel_id: shift.personnel_id,
              status: shift.status,
              scheduled_start: shift.scheduled_start,
              cover_search_wave: shift.cover_search_wave ?? 0,
              cover_search_started_at: shift.cover_search_started_at ?? null,
              cover_search_last_wave_at: shift.cover_search_last_wave_at ?? null,
            },
            trigger: "ring_r5",
            excludePersonnelIds: shift.personnel_id ? [shift.personnel_id] : [],
          });
        } catch (coverErr) {
          console.error(`[ETA-CRON] R5 kickoffCoverWave1 failed (${shift.id}):`, coverErr);
        }
      }

      // R6: shift didn't get a check-in by the no-show grace. Flip status to
      // no_show, clear personnel, then bump cover to wave 2 (or fire wave 1
      // fresh if R5 never ran for some reason).
      if (result.ring === "R6") {
        try {
          await markShiftNoShow({
            supabase: supabase as any,
            shift: {
              id: shift.id,
              booking_id: shift.booking_id,
              personnel_id: shift.personnel_id,
              status: shift.status,
              scheduled_start: shift.scheduled_start,
              cover_search_wave: shift.cover_search_wave ?? 0,
              cover_search_started_at: shift.cover_search_started_at ?? null,
              cover_search_last_wave_at: shift.cover_search_last_wave_at ?? null,
            },
          });
        } catch (coverErr) {
          console.error(`[ETA-CRON] R6 markShiftNoShow failed (${shift.id}):`, coverErr);
        }
      }
    } catch (e: any) {
      errors.push(`${shift.id}: ${e?.message ?? String(e)}`);
    }
  }

  return NextResponse.json({
    success: true,
    shifts_evaluated: evaluated,
    rings_escalated: escalated,
    errors: errors.length ? errors : undefined,
    at: now.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

/**
 * Per-ring copy for the venue Mission Control card and the push notifications.
 * Mirrors PRE_SHIFT_ABSENCE_ESCALATION.md §6 wording. Kept verbose on purpose
 * — copy is the product here.
 */
function buildRingCopy(
  ring: Exclude<TravelRing, "none">,
  guardLabel: string,
  venueName: string,
  result: { distanceM: number | null; minutesToStart: number; reason: string },
): {
  venueMessage: string | null;
  venuePush: { title: string; body: string } | null;
  guardPush: { title: string; body: string } | null;
} {
  const distanceText =
    result.distanceM == null
      ? "no location yet"
      : result.distanceM < 1000
        ? `${result.distanceM} m from site`
        : `${(result.distanceM / 1000).toFixed(1)} km from site`;

  switch (ring) {
    case "R3":
      return {
        venueMessage:
          `🟡 **En-route status unclear**\n\n` +
          `${guardLabel}'s location hasn't updated recently (${distanceText}). ` +
          `We've nudged them. You'll get another update if anything changes.`,
        venuePush: null,
        guardPush: {
          title: "Shift starts soon — tap to confirm you're en route",
          body: `Your shift at ${venueName} starts in around 30 minutes. Open the app so we know you're on the way.`,
        },
      };
    case "R4":
      return {
        venueMessage:
          `🟠 **Late-risk flagged**\n\n` +
          `${guardLabel} hasn't checked in and is currently ${distanceText}. ` +
          `We're watching this closely. Standby cover is ready to deploy if needed.`,
        venuePush: {
          title: "Late-risk flagged",
          body: `${guardLabel} may be running late at ${venueName}. We're monitoring.`,
        },
        guardPush: {
          title: "Are you on the way?",
          body: `Your shift at ${venueName} starts in 15 minutes. Tap to update us.`,
        },
      };
    case "R5":
      return {
        venueMessage:
          `🔴 **Likely no-show — sourcing cover**\n\n` +
          `${guardLabel} hasn't arrived yet (${distanceText}). ` +
          `We're contacting standby guards now. You'll be notified when cover is confirmed.`,
        venuePush: {
          title: "Sourcing cover",
          body: `${guardLabel} hasn't arrived at ${venueName}. We're actively sourcing cover.`,
        },
        guardPush: {
          title: "Last call — are you OK?",
          body: `Your shift at ${venueName} is starting. Reply now or we'll release the shift.`,
        },
      };
    case "R6":
      return {
        venueMessage:
          `❌ **Marked no-show in our records**\n\n` +
          `${guardLabel} did not check in. Our cover team has been notified to source a replacement on priority.`,
        venuePush: {
          title: "Guard marked no-show",
          body: `${guardLabel} didn't show at ${venueName}. Cover is being sourced.`,
        },
        guardPush: null,
      };
  }
}
