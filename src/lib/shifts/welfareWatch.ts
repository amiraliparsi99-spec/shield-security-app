/**
 * Lone-worker welfare watchdog — "lost contact" detection.
 *
 * While a guard is on duty (checked in, between scheduled start and end) the app
 * uploads GPS every ~15s. If that heartbeat goes stale for too long, we've lost
 * contact with the guard — the venue is alerted once so they can check on them.
 * Re-arms automatically when the heartbeat resumes.
 *
 * Reuses the GPS pipeline + notifications; no new tables.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/notifications/push-service";
import {
  markReminderSent,
  reminderAlreadySent,
} from "@/lib/mission-control/shiftReminders";

const LOST_CONTACT_KIND = "welfare_lost_contact";

function lostContactMinutes(): number {
  const n = Number(process.env.WELFARE_LOST_CONTACT_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

type Supa = SupabaseClient<any>;

export async function detectLostContact(params: {
  supabase: Supa;
  now: Date;
}): Promise<{ checked: number; alerted: number; errors: string[] }> {
  const { supabase, now } = params;
  const errors: string[] = [];
  let checked = 0;
  let alerted = 0;

  // On-duty guards: checked in and currently within the shift window.
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, booking_id, personnel_id, scheduled_start, scheduled_end, status")
    .eq("status", "checked_in")
    .lte("scheduled_start", now.toISOString())
    .gte("scheduled_end", now.toISOString());

  if (error || !shifts) {
    if (error) errors.push(`shifts query: ${error.message}`);
    return { checked, alerted, errors };
  }

  const staleMs = lostContactMinutes() * 60_000;

  for (const shift of shifts as Array<{
    id: string;
    booking_id: string;
    personnel_id: string | null;
    scheduled_start: string;
    scheduled_end: string;
  }>) {
    try {
      checked++;

      const { data: gps } = await supabase
        .from("shift_gps_log")
        .select("recorded_at")
        .eq("shift_id", shift.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastMs = gps?.recorded_at ? Date.parse((gps as { recorded_at: string }).recorded_at) : NaN;
      const inContact =
        Number.isFinite(lastMs) && now.getTime() - lastMs <= staleMs;

      if (inContact) {
        // Contact resumed — clear any prior alert so a future drop re-alerts.
        await supabase
          .from("shift_mission_reminders")
          .delete()
          .eq("shift_id", shift.id)
          .eq("reminder_kind", LOST_CONTACT_KIND);
        continue;
      }

      // Lost contact — alert the venue once per episode.
      if (await reminderAlreadySent(supabase, shift.id, LOST_CONTACT_KIND)) continue;

      const { data: booking } = await supabase
        .from("bookings")
        .select("venue_id, event_name")
        .eq("id", shift.booking_id)
        .maybeSingle();
      const venueId = (booking as { venue_id?: string } | null)?.venue_id ?? null;
      const eventName = (booking as { event_name?: string } | null)?.event_name ?? "their shift";
      if (!venueId) continue;

      const { data: venue } = await supabase
        .from("venues")
        .select("user_id")
        .eq("id", venueId)
        .maybeSingle();
      const venueUserId = (venue as { user_id?: string } | null)?.user_id ?? null;

      const { data: pers } = await supabase
        .from("personnel")
        .select("display_name, first_name")
        .eq("id", shift.personnel_id as string)
        .maybeSingle();
      const guardName =
        (pers as { display_name?: string | null } | null)?.display_name?.trim() ||
        (pers as { first_name?: string | null } | null)?.first_name?.trim() ||
        "A guard";

      const minutesGone = Number.isFinite(lastMs)
        ? Math.round((now.getTime() - lastMs) / 60_000)
        : null;
      const title = "Lost contact with guard";
      const body = minutesGone
        ? `${guardName}'s location hasn't updated for ${minutesGone} min during "${eventName}". Try contacting them to check they're OK.`
        : `${guardName}'s location has gone quiet during "${eventName}". Try contacting them to check they're OK.`;

      if (venueUserId) {
        await supabase.from("notifications").insert({
          user_id: venueUserId,
          type: "shift",
          title,
          body,
          data: {
            type: "welfare_lost_contact",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            action: "open_live_checkin",
          },
          is_read: false,
        } as never);

        await sendPushNotification({
          userId: venueUserId,
          type: "shift_reminder",
          title,
          body,
          data: { reminder_kind: LOST_CONTACT_KIND, shift_id: shift.id, booking_id: shift.booking_id },
        });
      }

      await markReminderSent(supabase, shift.id, LOST_CONTACT_KIND);
      alerted++;
    } catch (e: unknown) {
      errors.push(`${shift.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { checked, alerted, errors };
}
