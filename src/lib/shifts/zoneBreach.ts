/**
 * Mid-shift zone-breach detection.
 *
 * For each guard who is checked in and on duty, compares their latest GPS fix
 * against the booking's drawn geofence. If they've left the zone (beyond a small
 * buffer) with a fresh fix, the venue/agency is alerted once per shift — this
 * catches an abandoned post, which the pre-shift travel-risk engine doesn't.
 *
 * Polygon-only: bookings using the legacy pin + radius are skipped here (the
 * auto-checkout path already handles the 300m radius case).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceToPolygonMeters, isValidPolygon } from "@/lib/geo/polygon";
import { sendPushNotification } from "@/lib/notifications/push-service";
import {
  insertMissionControlSystemMessage,
  markReminderSent,
  reminderAlreadySent,
} from "@/lib/mission-control/shiftReminders";

const ZONE_BREACH_KIND = "zone_breach";

function breachBufferMeters(): number {
  const n = Number(process.env.ZONE_BREACH_BUFFER_METERS);
  return Number.isFinite(n) && n >= 0 ? n : 75;
}

function gpsFreshSeconds(): number {
  const n = Number(process.env.ZONE_BREACH_GPS_FRESH_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 600; // 10 min
}

// How long a guard must be continuously outside the zone before the venue is
// alerted. Brief absences (a food run) never flag.
function breachGraceMinutes(): number {
  const n = Number(process.env.ZONE_BREACH_GRACE_MINUTES);
  return Number.isFinite(n) && n >= 0 ? n : 15;
}

type Supa = SupabaseClient<any>;

type ShiftRow = {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  role: string | null;
  scheduled_end: string;
  status: string;
  zone_left_at?: string | null;
};

export async function detectZoneBreaches(params: {
  supabase: Supa;
  now: Date;
}): Promise<{ checked: number; alerted: number; errors: string[] }> {
  const { supabase, now } = params;
  const errors: string[] = [];
  let checked = 0;
  let alerted = 0;

  // On-duty guards: checked in, shift not long past its end.
  const graceFloor = new Date(now.getTime() - 30 * 60_000).toISOString();
  const richSelect =
    "id, booking_id, personnel_id, role, scheduled_end, status, zone_left_at";
  const basicSelect =
    "id, booking_id, personnel_id, role, scheduled_end, status";

  let shifts: ShiftRow[] | null = null;
  const resp = await supabase
    .from("shifts")
    .select(richSelect)
    .eq("status", "checked_in")
    .gte("scheduled_end", graceFloor);
  if (resp.error) {
    // zone_left_at column may not exist yet (pre-0060) — fall back.
    const fb = await supabase
      .from("shifts")
      .select(basicSelect)
      .eq("status", "checked_in")
      .gte("scheduled_end", graceFloor);
    if (fb.error) {
      errors.push(`shifts query: ${fb.error.message}`);
      return { checked, alerted, errors };
    }
    shifts = (fb.data as ShiftRow[]) ?? null;
  } else {
    shifts = (resp.data as ShiftRow[]) ?? null;
  }
  if (!shifts) return { checked, alerted, errors };

  const buffer = breachBufferMeters();
  const freshMs = gpsFreshSeconds() * 1000;
  const graceMin = breachGraceMinutes();

  for (const shift of shifts) {
    try {
      checked++;

      // Resolve the booking's polygon (snapshot → saved site). Skip if none.
      const { data: booking } = await supabase
        .from("bookings")
        .select("venue_id, venue_location_id, event_name")
        .eq("id", shift.booking_id)
        .maybeSingle();
      if (!booking?.venue_id) continue;

      let polygon: unknown = null;
      const polyResp = await supabase
        .from("bookings")
        .select("site_geofence_polygon")
        .eq("id", shift.booking_id)
        .maybeSingle();
      if (!polyResp.error) {
        polygon =
          (polyResp.data as { site_geofence_polygon?: unknown } | null)
            ?.site_geofence_polygon ?? null;
      }
      const locId = (booking as { venue_location_id?: string | null })
        .venue_location_id;
      if (polygon == null && locId) {
        const locResp = await supabase
          .from("venue_locations")
          .select("geofence_polygon")
          .eq("id", locId)
          .maybeSingle();
        if (!locResp.error) {
          polygon =
            (locResp.data as { geofence_polygon?: unknown } | null)
              ?.geofence_polygon ?? null;
        }
      }
      if (!isValidPolygon(polygon)) continue;

      // Latest GPS fix; must be fresh enough to trust.
      const { data: gps } = await supabase
        .from("shift_gps_log")
        .select("lat, lng, recorded_at")
        .eq("shift_id", shift.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!gps) continue;
      const recordedMs = Date.parse((gps as { recorded_at: string }).recorded_at);
      if (!Number.isFinite(recordedMs) || now.getTime() - recordedMs > freshMs) {
        continue;
      }

      const d = distanceToPolygonMeters(
        Number((gps as { lat: number }).lat),
        Number((gps as { lng: number }).lng),
        polygon,
      );

      // Re-entry: back inside the zone — clear the "left at" marker and any
      // breach reminder so a later genuine walk-off can alert again.
      if (d <= buffer) {
        if (shift.zone_left_at) {
          await supabase.from("shifts").update({ zone_left_at: null }).eq("id", shift.id);
          await supabase
            .from("shift_mission_reminders")
            .delete()
            .eq("shift_id", shift.id)
            .eq("reminder_kind", ZONE_BREACH_KIND);
        }
        continue;
      }

      // Outside the zone. If the guard has logged a break ("stepping out"),
      // this is authorised — never alert.
      const openBreak = await supabase
        .from("shift_breaks")
        .select("id")
        .eq("shift_id", shift.id)
        .is("ended_at", null)
        .maybeSingle();
      if (!openBreak.error && openBreak.data) continue;

      // First time we've seen them outside — start the grace clock, no alert.
      if (!shift.zone_left_at) {
        await supabase
          .from("shifts")
          .update({ zone_left_at: now.toISOString() })
          .eq("id", shift.id);
        continue;
      }

      // Still within the grace window? Hold off (this is the food-run case).
      const leftMs = Date.parse(shift.zone_left_at);
      const outsideMinutes = Number.isFinite(leftMs)
        ? (now.getTime() - leftMs) / 60_000
        : graceMin + 1;
      if (outsideMinutes < graceMin) continue;

      // Past the grace window — alert once per breach episode.
      if (await reminderAlreadySent(supabase, shift.id, ZONE_BREACH_KIND)) continue;

      // --- Breach confirmed: alert the venue (once per episode) ---
      const { data: venue } = await supabase
        .from("venues")
        .select("user_id, name")
        .eq("id", booking.venue_id)
        .maybeSingle();
      const venueUserId = (venue as { user_id?: string | null } | null)?.user_id ?? null;

      const { data: pers } = await supabase
        .from("personnel")
        .select("display_name, first_name")
        .eq("id", shift.personnel_id as string)
        .maybeSingle();
      const guardName =
        (pers as { display_name?: string | null; first_name?: string | null } | null)
          ?.display_name?.trim() ||
        (pers as { first_name?: string | null } | null)?.first_name?.trim() ||
        "A guard";

      const distanceText =
        d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
      const title = "Guard has left the on-site zone";
      const body = `${guardName} is currently ${distanceText} outside the marked on-site area for "${booking.event_name}". Check their live location.`;

      if (venueUserId) {
        await supabase.from("notifications").insert({
          user_id: venueUserId,
          type: "shift",
          title,
          body,
          data: {
            type: "zone_breach",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            distance_m: Math.round(d),
            action: "open_live_checkin",
          },
          is_read: false,
        } as never);

        await sendPushNotification({
          userId: venueUserId,
          type: "shift_reminder",
          title,
          body,
          data: {
            reminder_kind: "zone_breach",
            shift_id: shift.id,
            booking_id: shift.booking_id,
          },
        });
      }

      // Mission Control line (best-effort).
      const { data: gc } = await supabase
        .from("group_chats")
        .select("id")
        .eq("booking_id", shift.booking_id)
        .eq("chat_type", "mission_control")
        .eq("is_active", true)
        .maybeSingle();
      if (gc?.id && venueUserId) {
        await insertMissionControlSystemMessage({
          supabase,
          groupChatId: gc.id,
          senderId: venueUserId,
          content:
            `🚷 **${guardName} has left the on-site zone**\n\n` +
            `They're currently ${distanceText} outside the marked area. If this isn't expected (a patrol or break), check in with them.`,
          metadata: {
            type: "zone_breach",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            distance_m: Math.round(d),
          },
        });
      }

      await markReminderSent(supabase, shift.id, ZONE_BREACH_KIND);
      alerted++;
    } catch (e: unknown) {
      errors.push(`${shift.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { checked, alerted, errors };
}
