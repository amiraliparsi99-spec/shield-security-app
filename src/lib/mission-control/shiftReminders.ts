import type { SupabaseClient } from "@supabase/supabase-js";

export const REMINDER_KINDS = {
  /** ~2h before start: guard push + in-app “still attending?” confirmation */
  ATTENDANCE_CONFIRM_2H: "attendance_confirm_2h_guard",
  PRE_START_CHECKIN_GUARD: "pre_start_checkin_guard",
  PRE_START_VENUE_VISIBILITY: "pre_start_venue_visibility",
  SHIFT_START_ATTENDANCE: "shift_start_attendance",
  PRE_END_CHECKOUT_GUARD: "pre_end_checkout_guard",
  /** Pre-shift absence engine — one entry per ring per shift for idempotency. */
  ETA_R3_STATUS_UNCLEAR: "eta_r3_status_unclear",
  ETA_R4_AMBER: "eta_r4_amber",
  ETA_R5_RED: "eta_r5_red",
  ETA_R6_NO_SHOW: "eta_r6_no_show",
} as const;

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
/** Cron runs every 5m; catch “about 2h before” in a 12m window so we never miss the slot */
const TWO_H_PRE_WINDOW_MS = 12 * 60 * 1000;

/** Returns true if a row already exists for this shift + kind (reminder already sent). */
export async function reminderAlreadySent(
  supabase: SupabaseClient,
  shiftId: string,
  reminderKind: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("shift_mission_reminders")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("reminder_kind", reminderKind)
    .maybeSingle();
  return !!data;
}

/** Call after a successful Mission Control insert so cron does not repeat. */
export async function markReminderSent(
  supabase: SupabaseClient,
  shiftId: string,
  reminderKind: string,
): Promise<void> {
  const { error } = await supabase.from("shift_mission_reminders").insert({
    shift_id: shiftId,
    reminder_kind: reminderKind,
  });
  if (error && error.code !== "23505") {
    console.error("[shiftReminders] markReminderSent:", error);
  }
}

type InsertSystemMessageParams = {
  supabase: SupabaseClient;
  groupChatId: string;
  senderId: string;
  content: string;
  metadata: Record<string, unknown>;
};

/**
 * Insert a system line into Mission Control (service role bypasses RLS).
 */
export async function insertMissionControlSystemMessage({
  supabase,
  groupChatId,
  senderId,
  content,
  metadata,
}: InsertSystemMessageParams): Promise<boolean> {
  const { error } = await supabase.from("group_chat_messages").insert({
    group_chat_id: groupChatId,
    sender_id: senderId,
    content,
    message_type: "system",
    metadata,
  });
  if (error) {
    console.error("[shiftReminders] message insert failed:", error);
    return false;
  }
  await supabase
    .from("group_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", groupChatId);
  return true;
}

/**
 * Returns true if scheduled_start is within the next 15 minutes but still in the future.
 */
/**
 * True when the shift starts in roughly 2 hours (used for guard attendance confirmation).
 * Window: (2h − 12m, 2h] from now so a 5-minute cron always hits once.
 */
export function isWithinTwoHoursBeforeStart(scheduledStartIso: string, now: Date): boolean {
  const start = new Date(scheduledStartIso).getTime();
  const t = now.getTime();
  const msUntil = start - t;
  return msUntil <= TWO_HOURS_MS && msUntil > TWO_HOURS_MS - TWO_H_PRE_WINDOW_MS;
}

export function isWithin15MinutesBeforeStart(scheduledStartIso: string, now: Date): boolean {
  const start = new Date(scheduledStartIso).getTime();
  const t = now.getTime();
  return start > t && start - t <= FIFTEEN_MIN_MS;
}

/**
 * Returns true if scheduled_end is within the next 15 minutes but still in the future.
 */
export function isWithin15MinutesBeforeEnd(scheduledEndIso: string, now: Date): boolean {
  const end = new Date(scheduledEndIso).getTime();
  const t = now.getTime();
  return end > t && end - t <= FIFTEEN_MIN_MS;
}

/**
 * Shift has begun but not yet ended; within first 15 minutes after scheduled start.
 */
export function isWithin15MinutesAfterStart(scheduledStartIso: string, now: Date): boolean {
  const start = new Date(scheduledStartIso).getTime();
  const t = now.getTime();
  return t >= start && t < start + FIFTEEN_MIN_MS;
}
