import type { SupabaseClient } from "@supabase/supabase-js";

type ShieldEventType =
  | "no_show"
  | "late_checkin"
  | "clean_shift_confirmed"
  | "clean_shift_streak_5"
  | "dispute_resolved_for_venue";

type ShieldEventDetails = Record<string, unknown>;

async function getCurrentShieldScore(
  supabase: SupabaseClient,
  personnelId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("personnel")
    .select("shield_score")
    .eq("id", personnelId)
    .single();
  if (error || !data) return null;
  return typeof data.shield_score === "number" ? data.shield_score : null;
}

export async function applyShieldScoreEvent(params: {
  supabase: SupabaseClient;
  personnelId: string;
  eventType: ShieldEventType;
  pointsChange: number;
  details?: ShieldEventDetails;
}): Promise<void> {
  const { supabase, personnelId, eventType, pointsChange, details } = params;

  const current = await getCurrentShieldScore(supabase, personnelId);
  if (current == null) return;

  const next = Math.max(0, Math.min(100, current + pointsChange));

  await supabase.from("shield_score_history").insert({
    personnel_id: personnelId,
    event_type: eventType,
    points_change: pointsChange,
    details: details ?? {},
    created_at: new Date().toISOString(),
  } as any);

  await supabase
    .from("personnel")
    .update({ shield_score: next })
    .eq("id", personnelId);
}

export async function applyLateCheckInPenalty(params: {
  supabase: SupabaseClient;
  shiftId: string;
  personnelId: string;
  minutesLate: number;
}): Promise<void> {
  const { supabase, shiftId, personnelId, minutesLate } = params;
  await applyShieldScoreEvent({
    supabase,
    personnelId,
    eventType: "late_checkin",
    pointsChange: -5,
    details: { shift_id: shiftId, minutes_late: minutesLate },
  });
}

export async function applyDisputeResolvedForVenuePenalty(params: {
  supabase: SupabaseClient;
  shiftId: string;
  personnelId: string;
}): Promise<void> {
  const { supabase, shiftId, personnelId } = params;
  await applyShieldScoreEvent({
    supabase,
    personnelId,
    eventType: "dispute_resolved_for_venue",
    pointsChange: -20,
    details: { shift_id: shiftId },
  });
}

export async function applyCleanShiftConfirmationReward(params: {
  supabase: SupabaseClient;
  shiftId: string;
  personnelId: string;
}): Promise<void> {
  const { supabase, shiftId, personnelId } = params;

  const { data: existing } = await supabase
    .from("shield_score_history")
    .select("id")
    .eq("personnel_id", personnelId)
    .eq("event_type", "clean_shift_confirmed")
    .contains("details", { shift_id: shiftId } as any)
    .maybeSingle();

  if (!existing) {
    await applyShieldScoreEvent({
      supabase,
      personnelId,
      eventType: "clean_shift_confirmed",
      pointsChange: 2,
      details: { shift_id: shiftId },
    });
  }

  const { data: recentConfirmed } = await supabase
    .from("shifts")
    .select("id, dispute_status, status, venue_confirmed")
    .eq("personnel_id", personnelId)
    .eq("venue_confirmed", true)
    .eq("status", "checked_out")
    .order("venue_confirmed_at", { ascending: false })
    .limit(5);

  const allClean =
    (recentConfirmed?.length ?? 0) >= 5 &&
    (recentConfirmed ?? []).every((s: any) => !s.dispute_status || s.dispute_status === "none");

  if (!allClean) return;

  const { data: streakAlready } = await supabase
    .from("shield_score_history")
    .select("id")
    .eq("personnel_id", personnelId)
    .eq("event_type", "clean_shift_streak_5")
    .contains("details", { shift_id: shiftId } as any)
    .maybeSingle();

  if (streakAlready) return;

  await applyShieldScoreEvent({
    supabase,
    personnelId,
    eventType: "clean_shift_streak_5",
    pointsChange: 5,
    details: {
      shift_id: shiftId,
      streak_count: 5,
      recent_shift_ids: (recentConfirmed ?? []).map((s: any) => s.id),
    },
  });
}

