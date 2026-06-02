/**
 * Automated Mission Control messages + guard push reminders:
 * - ~2h before shift start (accepted only): Expo push + in-app “still attending?” confirmation
 * - ~15 min before shift start: guard check-in reminder + venue visibility prompt
 * - First 15 min after scheduled start if still not checked in: attendance nudge (both sides)
 * - ~15 min before shift end (while checked in): guard checkout reminder
 *
 * Schedule: every 5 minutes (see vercel.json). Deduplicated via shift_mission_reminders.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  REMINDER_KINDS,
  reminderAlreadySent,
  markReminderSent,
  insertMissionControlSystemMessage,
  isWithinTwoHoursBeforeStart,
  isWithin15MinutesBeforeStart,
  isWithin15MinutesBeforeEnd,
  isWithin15MinutesAfterStart,
} from "@/lib/mission-control/shiftReminders";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { requireCronAuth } from "@/lib/auth/cronAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();

  const { data: shifts, error: qErr } = await supabase
    .from("shifts")
    .select(
      "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, role",
    )
    .not("personnel_id", "is", null)
    .in("status", ["accepted", "checked_in"]);

  if (qErr) {
    console.error("[MC-REMINDERS] shifts query:", qErr);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const shift of shifts || []) {
    // --- ~2h before start: guard attendance confirmation (push + in-app; no Mission Control required) ---
    if (
      shift.status === "accepted" &&
      isWithinTwoHoursBeforeStart(shift.scheduled_start, now)
    ) {
      if (!(await reminderAlreadySent(supabase, shift.id, REMINDER_KINDS.ATTENDANCE_CONFIRM_2H))) {
        const { data: persRow } = await supabase
          .from("personnel")
          .select("user_id")
          .eq("id", shift.personnel_id as string)
          .maybeSingle();
        const guardUserId = persRow?.user_id;

        let venueName = "the venue";
        let eventLabel = "Shift";
        const { data: bookRow } = await supabase
          .from("bookings")
          .select("event_name, venue_id")
          .eq("id", shift.booking_id)
          .maybeSingle();
        if (bookRow?.event_name) eventLabel = bookRow.event_name;
        if (bookRow?.venue_id) {
          const { data: venueRow } = await supabase
            .from("venues")
            .select("name")
            .eq("id", bookRow.venue_id)
            .maybeSingle();
          if (venueRow?.name) venueName = venueRow.name;
        }

        if (guardUserId) {
          const { error: nErr } = await supabase.from("notifications").insert({
            user_id: guardUserId,
            type: "shift",
            title: "Will you be attending?",
            body: `Your shift ("${eventLabel}" at ${venueName}) starts in about 2 hours. Open the app to confirm you're still coming.`,
            data: {
              shift_id: shift.id,
              booking_id: shift.booking_id,
              reminder_kind: "attendance_confirm_2h",
            },
          });
          if (nErr) {
            console.error("[MC-REMINDERS] attendance 2h notification insert:", nErr);
            errors.push(`attendance_2h_notify ${shift.id}: ${nErr.message}`);
          } else {
            await sendPushNotification({
              userId: guardUserId,
              type: "shift_reminder",
              title: "Will you be attending?",
              body: `Your shift starts in about 2 hours at ${venueName}. Tap to confirm you're still coming.`,
              data: {
                shift_id: shift.id,
                booking_id: shift.booking_id,
                reminder_kind: "attendance_confirm_2h",
              },
            });
            await markReminderSent(supabase, shift.id, REMINDER_KINDS.ATTENDANCE_CONFIRM_2H);
            sent++;
          }
        }
      }
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, venue_id")
      .eq("id", shift.booking_id)
      .single();

    if (!booking?.venue_id) continue;

    const { data: venue } = await supabase
      .from("venues")
      .select("user_id")
      .eq("id", booking.venue_id)
      .single();

    const { data: gc } = await supabase
      .from("group_chats")
      .select("id")
      .eq("booking_id", shift.booking_id)
      .eq("chat_type", "mission_control")
      .eq("is_active", true)
      .maybeSingle();

    if (!gc?.id || !venue?.user_id) continue;

    const senderId = venue.user_id;
    const groupChatId = gc.id;

    // --- 15 min before start: guard + venue ---
    if (
      shift.status === "accepted" &&
      isWithin15MinutesBeforeStart(shift.scheduled_start, now)
    ) {
      if (!(await reminderAlreadySent(supabase, shift.id, REMINDER_KINDS.PRE_START_CHECKIN_GUARD))) {
        const ok = await insertMissionControlSystemMessage({
          supabase,
          groupChatId,
          senderId,
          content:
            `⏱️ **Shift starting soon**\n\n` +
            `Your shift (${shift.role || "Security"}) begins in about 15 minutes. ` +
            `When you arrive on site, open your shift and **check in** so the venue can see you’re on duty.`,
          metadata: {
            type: "shift_reminder_pre_start_guard",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            audience: "guard",
          },
        });
        if (ok) {
          await markReminderSent(supabase, shift.id, REMINDER_KINDS.PRE_START_CHECKIN_GUARD);
          sent++;
        } else errors.push(`guard pre-start ${shift.id}`);
      }

      if (!(await reminderAlreadySent(supabase, shift.id, REMINDER_KINDS.PRE_START_VENUE_VISIBILITY))) {
        const ok = await insertMissionControlSystemMessage({
          supabase,
          groupChatId,
          senderId,
          content:
            `👀 **Upcoming shift**\n\n` +
            `Your guard should arrive shortly. Once they’re on site, please confirm they’ve **checked in** ` +
            `(you’ll see status in **Live Check-In**). If you don’t see them, reply here or use Live Check-In to follow up.`,
          metadata: {
            type: "shift_reminder_pre_start_venue",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            audience: "venue",
            live_check_in_path: "/d/venue/live",
          },
        });
        if (ok) {
          await markReminderSent(supabase, shift.id, REMINDER_KINDS.PRE_START_VENUE_VISIBILITY);
          sent++;
        } else errors.push(`venue pre-start ${shift.id}`);
      }
    }

    // --- Still accepted after scheduled start (first 15 min): attendance nudge ---
    if (
      shift.status === "accepted" &&
      isWithin15MinutesAfterStart(shift.scheduled_start, now)
    ) {
      if (!(await reminderAlreadySent(supabase, shift.id, REMINDER_KINDS.SHIFT_START_ATTENDANCE))) {
        const ok = await insertMissionControlSystemMessage({
          supabase,
          groupChatId,
          senderId,
          content:
            `⚠️ **Attendance check**\n\n` +
            `This shift has started but we don’t show a **check-in** yet. ` +
            `Guard: please check in now if you’re on site. Venue: check **Live Check-In** or message here if the guard isn’t visible.`,
          metadata: {
            type: "shift_reminder_start_attendance",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            live_check_in_path: "/d/venue/live",
          },
        });
        if (ok) {
          await markReminderSent(supabase, shift.id, REMINDER_KINDS.SHIFT_START_ATTENDANCE);
          sent++;
        } else errors.push(`attendance ${shift.id}`);
      }
    }

    // --- ~15 min before end: checkout reminder (on shift) ---
    if (
      shift.status === "checked_in" &&
      isWithin15MinutesBeforeEnd(shift.scheduled_end, now)
    ) {
      if (!(await reminderAlreadySent(supabase, shift.id, REMINDER_KINDS.PRE_END_CHECKOUT_GUARD))) {
        const ok = await insertMissionControlSystemMessage({
          supabase,
          groupChatId,
          senderId,
          content:
            `🏁 **Shift ending soon**\n\n` +
            `About 15 minutes left on this shift. When you finish, **check out** in the app so hours and pay stay accurate.`,
          metadata: {
            type: "shift_reminder_pre_end_checkout",
            shift_id: shift.id,
            booking_id: shift.booking_id,
            audience: "guard",
          },
        });
        if (ok) {
          await markReminderSent(supabase, shift.id, REMINDER_KINDS.PRE_END_CHECKOUT_GUARD);
          sent++;
        } else errors.push(`checkout ${shift.id}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    messages_sent: sent,
    shifts_scanned: (shifts || []).length,
    errors: errors.length ? errors : undefined,
    at: now.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
