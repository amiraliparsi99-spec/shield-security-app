/**
 * Shift cover orchestration.
 *
 * Single entry point for "this shift now needs cover" + "broaden the search".
 * Used by:
 *   - The guard cancel route (when a guard taps "Can't attend")
 *   - The pre-shift travel-risk cron (when ring R5 fires)
 *   - The no-show / R6 path (when guard never checks in)
 *   - The wave-broadening cron (auto-bumps unfilled shifts to next wave)
 *
 * Concept docs:
 *   - docs/SHIFT_COVER_ESCALATION_PLAN.md (waves, radius, lifecycle)
 *   - docs/PRE_SHIFT_ABSENCE_ESCALATION.md (detection rings → response)
 *
 * Wave radius defaults (env-tunable):
 *   Wave 1:  5 mi  (immediate, fires the moment NEEDS_COVER is declared)
 *   Wave 2: 15 mi  (fires ~5 min after Wave 1 if no taker)
 *   Wave 3: 25 mi  (fires ~15 min after Wave 2 + agency partner alert)
 */

import { createClient } from "@supabase/supabase-js";
import { notifyGuardsForBooking } from "@/lib/notifications/notify-guards";
import { sendPushNotification } from "@/lib/notifications/push-service";
import { insertMissionControlSystemMessage } from "@/lib/mission-control/shiftReminders";
import { isMissingColumnError } from "@/lib/postgresErrors";

export type ServiceClient = ReturnType<typeof createClient>;

export type CoverTrigger =
  | "guard_withdrawal"
  | "venue_release"
  | "ring_r5"
  | "ring_r6"
  | "wave_expired"
  | "manual";

export type CoverWaveConfig = {
  wave: number;
  radiusMiles: number;
  /** Minutes to wait after this wave before firing the next one. */
  delayMinutesUntilNextWave: number;
  /** True for the final wave — also alerts agency partners. */
  finalWave?: boolean;
};

export const DEFAULT_COVER_WAVES: CoverWaveConfig[] = [
  { wave: 1, radiusMiles: 5, delayMinutesUntilNextWave: 5 },
  { wave: 2, radiusMiles: 15, delayMinutesUntilNextWave: 10 },
  { wave: 3, radiusMiles: 25, delayMinutesUntilNextWave: 0, finalWave: true },
];

export function resolveCoverWavesFromEnv(
  env: Record<string, string | undefined> = process.env,
): CoverWaveConfig[] {
  const num = (key: string, fallback: number): number => {
    const v = Number(env[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return [
    {
      wave: 1,
      radiusMiles: num("COVER_WAVE_1_RADIUS_MILES", 5),
      delayMinutesUntilNextWave: num("COVER_WAVE_1_DELAY_MINUTES", 5),
    },
    {
      wave: 2,
      radiusMiles: num("COVER_WAVE_2_RADIUS_MILES", 15),
      delayMinutesUntilNextWave: num("COVER_WAVE_2_DELAY_MINUTES", 10),
    },
    {
      wave: 3,
      radiusMiles: num("COVER_WAVE_3_RADIUS_MILES", 25),
      delayMinutesUntilNextWave: 0,
      finalWave: true,
    },
  ];
}

type ShiftLite = {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  status: string;
  scheduled_start: string;
  cover_search_wave?: number | null;
  cover_search_started_at?: string | null;
  cover_search_last_wave_at?: string | null;
};

export type CoverKickoffResult = {
  ok: boolean;
  wave: number;
  radius_miles: number;
  guards_notified: number;
  offers_created: number;
  trigger: CoverTrigger;
  /** True if the shift was already in cover mode and we re-fired Wave 1 idempotently. */
  already_in_cover?: boolean;
  error?: string;
};

/**
 * Fire Wave 1 cover offers for a shift. Idempotent: calling it again on a
 * shift that's already in Wave 1 is a no-op (returns `already_in_cover`).
 *
 * Caller is responsible for any *additional* state the trigger requires — for
 * example R6 also flips status to `no_show`. This function only handles the
 * cover-sourcing side: marking the wave columns and firing notify-guards.
 */
export async function kickoffCoverWave1(params: {
  supabase: ServiceClient;
  shift: ShiftLite;
  trigger: CoverTrigger;
  excludePersonnelIds?: string[];
  /** Override the wave 1 radius for this call. Default: env / DEFAULT_COVER_WAVES[0]. */
  radiusMilesOverride?: number;
}): Promise<CoverKickoffResult> {
  const { supabase, shift, trigger } = params;
  const waves = resolveCoverWavesFromEnv();
  const wave1 = waves[0];
  const radiusMiles = params.radiusMilesOverride ?? wave1.radiusMiles;
  const now = new Date();

  // Idempotency: if cover_search_wave is already >= 1 and started recently,
  // don't refire. The wave-broadening cron handles bumping to wave 2/3.
  if ((shift.cover_search_wave ?? 0) >= 1 && shift.cover_search_started_at) {
    return {
      ok: true,
      wave: shift.cover_search_wave ?? 1,
      radius_miles: radiusMiles,
      guards_notified: 0,
      offers_created: 0,
      trigger,
      already_in_cover: true,
    };
  }

  // Mark the shift as searching, with audit columns.
  await markShiftWaveColumns(supabase, shift.id, {
    cover_search_wave: 1,
    cover_search_started_at: now.toISOString(),
    cover_search_last_wave_at: now.toISOString(),
    is_urgent: true,
    dispatcher_status: "searching",
  });

  // Fire urgent notify with the wave 1 radius.
  let notifyResult: Awaited<ReturnType<typeof notifyGuardsForBooking>> | null = null;
  try {
    notifyResult = await notifyGuardsForBooking(shift.booking_id, radiusMiles, {
      urgent: true,
      excludePersonnelIds: params.excludePersonnelIds ?? [],
    });
  } catch (e) {
    console.error("[coverEngine] kickoffCoverWave1 notify failed:", e);
  }

  await recordWaveAudit(supabase, {
    shift_id: shift.id,
    wave: 1,
    radius_miles: radiusMiles,
    trigger,
    guards_notified: notifyResult?.guards_notified ?? 0,
    offers_created: notifyResult?.offers_created ?? 0,
  });

  await postNeedsCoverMissionControl(supabase, shift, {
    wave: 1,
    radiusMiles,
    trigger,
    guardsNotified: notifyResult?.guards_notified ?? 0,
  });

  await pushVenueNeedsCover(supabase, shift, {
    wave: 1,
    guardsNotified: notifyResult?.guards_notified ?? 0,
  });

  return {
    ok: true,
    wave: 1,
    radius_miles: radiusMiles,
    guards_notified: notifyResult?.guards_notified ?? 0,
    offers_created: notifyResult?.offers_created ?? 0,
    trigger,
  };
}

/**
 * Bump a shift from wave N → wave N+1 with the wider radius. Idempotent:
 * if the shift is already filled (personnel_id set OR not pending) it skips.
 */
export async function broadenCoverWave(params: {
  supabase: ServiceClient;
  shift: ShiftLite;
  /** The wave we're bumping to (e.g. 2 or 3). */
  toWave: number;
  trigger?: CoverTrigger;
  excludePersonnelIds?: string[];
}): Promise<CoverKickoffResult> {
  const { supabase, shift, toWave } = params;
  const waves = resolveCoverWavesFromEnv();
  const cfg = waves.find((w) => w.wave === toWave);

  if (!cfg) {
    return {
      ok: false,
      wave: toWave,
      radius_miles: 0,
      guards_notified: 0,
      offers_created: 0,
      trigger: params.trigger ?? "wave_expired",
      error: `unknown wave ${toWave}`,
    };
  }

  // Refuse if shift already filled.
  if (shift.personnel_id || (shift.status !== "pending" && shift.status !== "accepted")) {
    return {
      ok: true,
      wave: toWave,
      radius_miles: cfg.radiusMiles,
      guards_notified: 0,
      offers_created: 0,
      trigger: params.trigger ?? "wave_expired",
      already_in_cover: true,
    };
  }

  const now = new Date();
  await markShiftWaveColumns(supabase, shift.id, {
    cover_search_wave: toWave,
    cover_search_last_wave_at: now.toISOString(),
  });

  // Wave dedupe: exclude personnel who already received an offer in any
  // prior wave, so a guard 4 mi away who got Wave 1 (5 mi) doesn't get
  // pinged again when we broaden to Wave 2 (15 mi). Best-effort — if the
  // lookup fails we fall through with just the caller's exclusion list.
  const priorRecipients = await listPriorOfferRecipients(supabase, shift.id);
  const exclusionSet = new Set<string>(params.excludePersonnelIds ?? []);
  for (const id of priorRecipients) exclusionSet.add(id);

  let notifyResult: Awaited<ReturnType<typeof notifyGuardsForBooking>> | null = null;
  try {
    notifyResult = await notifyGuardsForBooking(shift.booking_id, cfg.radiusMiles, {
      urgent: true,
      excludePersonnelIds: Array.from(exclusionSet),
    });
  } catch (e) {
    console.error("[coverEngine] broadenCoverWave notify failed:", e);
  }

  await recordWaveAudit(supabase, {
    shift_id: shift.id,
    wave: toWave,
    radius_miles: cfg.radiusMiles,
    trigger: params.trigger ?? "wave_expired",
    guards_notified: notifyResult?.guards_notified ?? 0,
    offers_created: notifyResult?.offers_created ?? 0,
    metadata: {
      ...(cfg.finalWave ? { final_wave: true, agency_partner_alert: true } : {}),
      excluded_count: exclusionSet.size,
    },
  });

  await postBroadenMissionControl(supabase, shift, {
    wave: toWave,
    radiusMiles: cfg.radiusMiles,
    finalWave: cfg.finalWave === true,
    guardsNotified: notifyResult?.guards_notified ?? 0,
  });

  // If the shift becomes unfillable (final wave fired and still no taker
  // would be marked by a later cron tick when we detect expiry).
  return {
    ok: true,
    wave: toWave,
    radius_miles: cfg.radiusMiles,
    guards_notified: notifyResult?.guards_notified ?? 0,
    offers_created: notifyResult?.offers_created ?? 0,
    trigger: params.trigger ?? "wave_expired",
  };
}

/**
 * Mark a shift as no-show (R6) and immediately kick off / broaden cover.
 * If cover hasn't been started yet, this fires Wave 1. If Wave 1 already
 * fired (e.g. R5 already ran), it bumps to Wave 2 to broaden the search.
 */
export async function markShiftNoShow(params: {
  supabase: ServiceClient;
  shift: ShiftLite;
}): Promise<{
  ok: boolean;
  cover: CoverKickoffResult | null;
  error?: string;
}> {
  const { supabase, shift } = params;
  const previousPersonnelId = shift.personnel_id;
  const now = new Date();

  // Flip the shift to no_show + clear the assignment so cover offers can be
  // accepted by another guard. We mirror the schema-fallback approach in
  // cancel/route.ts so a missing column doesn't block the core release.
  const strategies: Record<string, unknown>[] = [
    {
      status: "no_show",
      personnel_id: null,
      no_show_at: now.toISOString(),
      original_personnel_id: previousPersonnelId ?? null,
      is_urgent: true,
      dispatcher_status: "searching",
    },
    {
      status: "no_show",
      personnel_id: null,
      no_show_at: now.toISOString(),
    },
    {
      status: "no_show",
      personnel_id: null,
    },
  ];

  let updated = false;
  for (const update of strategies) {
    const { error, data } = await (supabase as any)
      .from("shifts")
      .update(update)
      .eq("id", shift.id)
      .select("id");
    if (!error && Array.isArray(data) && data.length > 0) {
      updated = true;
      break;
    }
    if (error && !isMissingColumnError(error)) {
      console.error("[coverEngine] markShiftNoShow update failed:", error);
    }
  }

  if (!updated) {
    return { ok: false, cover: null, error: "Failed to flip shift to no_show" };
  }

  // Now broaden / kick off cover. If cover_search_wave >= 1 already, bump
  // to wave 2; otherwise fire wave 1 fresh.
  const currentWave = shift.cover_search_wave ?? 0;
  const cover =
    currentWave >= 1
      ? await broadenCoverWave({
          supabase,
          shift: { ...shift, status: "pending", personnel_id: null },
          toWave: 2,
          trigger: "ring_r6",
          excludePersonnelIds: previousPersonnelId ? [previousPersonnelId] : [],
        })
      : await kickoffCoverWave1({
          supabase,
          shift: { ...shift, status: "pending", personnel_id: null },
          trigger: "ring_r6",
          excludePersonnelIds: previousPersonnelId ? [previousPersonnelId] : [],
        });

  return { ok: true, cover };
}

/* ----- internal helpers below ----- */

async function markShiftWaveColumns(
  supabase: ServiceClient,
  shiftId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // Tolerant write: try the full patch first, then progressively drop columns
  // that the running schema may not have yet.
  const attempts: Record<string, unknown>[] = [
    patch,
    omit(patch, ["dispatcher_status"]),
    omit(patch, ["dispatcher_status", "is_urgent"]),
    omit(patch, ["dispatcher_status", "is_urgent", "cover_search_started_at", "cover_search_last_wave_at"]),
  ];
  for (const a of attempts) {
    const { error } = await (supabase as any).from("shifts").update(a).eq("id", shiftId);
    if (!error) return;
    if (!isMissingColumnError(error)) {
      console.error("[coverEngine] markShiftWaveColumns failed:", error);
      return;
    }
  }
}

function omit(o: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...o };
  for (const k of keys) delete out[k];
  return out;
}

async function recordWaveAudit(
  supabase: ServiceClient,
  row: {
    shift_id: string;
    wave: number;
    radius_miles: number;
    trigger: string;
    guards_notified: number;
    offers_created: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await (supabase as any).from("shift_cover_waves").insert({
    shift_id: row.shift_id,
    wave: row.wave,
    radius_miles: row.radius_miles,
    trigger: row.trigger,
    guards_notified: row.guards_notified,
    offers_created: row.offers_created,
    metadata: row.metadata ?? {},
  });
  if (error) {
    // Audit table missing is non-fatal — keep cover engine alive.
    console.warn("[coverEngine] recordWaveAudit failed:", error.message);
  }
}

async function resolveBookingContext(
  supabase: ServiceClient,
  shift: ShiftLite,
): Promise<{
  groupChatId: string | null;
  venueUserId: string | null;
  venueName: string;
  eventName: string;
}> {
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, venue_id, event_name")
    .eq("id", shift.booking_id)
    .maybeSingle() as {
      data: { id: string; venue_id: string | null; event_name: string | null } | null;
    };

  let venueUserId: string | null = null;
  let venueName = "the venue";
  if (booking?.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("name, user_id")
      .eq("id", booking.venue_id)
      .maybeSingle() as { data: { name: string | null; user_id: string | null } | null };
    if (venue?.name) venueName = venue.name;
    venueUserId = venue?.user_id ?? null;
  }

  const { data: gc } = await supabase
    .from("group_chats")
    .select("id")
    .eq("booking_id", shift.booking_id)
    .eq("chat_type", "mission_control")
    .eq("is_active", true)
    .maybeSingle() as { data: { id: string } | null };

  return {
    groupChatId: gc?.id ?? null,
    venueUserId,
    venueName,
    eventName: booking?.event_name ?? "your shift",
  };
}

async function postNeedsCoverMissionControl(
  supabase: ServiceClient,
  shift: ShiftLite,
  meta: { wave: number; radiusMiles: number; trigger: CoverTrigger; guardsNotified: number },
): Promise<void> {
  const ctx = await resolveBookingContext(supabase, shift);
  if (!ctx.groupChatId || !ctx.venueUserId) return;

  const triggerCopy: Record<CoverTrigger, string> = {
    guard_withdrawal: "Original guard released the shift",
    venue_release: "Shift released for cover",
    ring_r5: "Original guard hasn't arrived — sourcing cover early",
    ring_r6: "Original guard marked no-show — cover on priority",
    wave_expired: "Broadening search radius",
    manual: "Cover sourcing started",
  };

  await insertMissionControlSystemMessage({
    supabase: supabase as any,
    groupChatId: ctx.groupChatId,
    senderId: ctx.venueUserId,
    content:
      `🟡 **Sourcing cover (Wave ${meta.wave}, ${meta.radiusMiles} mi)**\n\n` +
      `${triggerCopy[meta.trigger]}. ${meta.guardsNotified} nearby guards notified. ` +
      `You'll be pinged the moment cover is confirmed.`,
    metadata: {
      type: "shift_needs_cover",
      shift_id: shift.id,
      booking_id: shift.booking_id,
      wave: meta.wave,
      radius_miles: meta.radiusMiles,
      trigger: meta.trigger,
      guards_notified: meta.guardsNotified,
    },
  });
}

async function postBroadenMissionControl(
  supabase: ServiceClient,
  shift: ShiftLite,
  meta: { wave: number; radiusMiles: number; finalWave: boolean; guardsNotified: number },
): Promise<void> {
  const ctx = await resolveBookingContext(supabase, shift);
  if (!ctx.groupChatId || !ctx.venueUserId) return;

  const tail = meta.finalWave
    ? "Agency partners alerted as fallback."
    : `Next broadening in a few minutes if no taker.`;

  await insertMissionControlSystemMessage({
    supabase: supabase as any,
    groupChatId: ctx.groupChatId,
    senderId: ctx.venueUserId,
    content:
      `🟠 **Broadened search (Wave ${meta.wave}, ${meta.radiusMiles} mi)**\n\n` +
      `Wave ${meta.wave - 1} expired with no taker. ${meta.guardsNotified} additional guards notified. ${tail}`,
    metadata: {
      type: "shift_cover_wave_broadened",
      shift_id: shift.id,
      booking_id: shift.booking_id,
      wave: meta.wave,
      radius_miles: meta.radiusMiles,
      final_wave: meta.finalWave,
      guards_notified: meta.guardsNotified,
    },
  });
}

async function pushVenueNeedsCover(
  supabase: ServiceClient,
  shift: ShiftLite,
  meta: { wave: number; guardsNotified: number },
): Promise<void> {
  const ctx = await resolveBookingContext(supabase, shift);
  if (!ctx.venueUserId) return;

  await (supabase as any).from("notifications").insert({
    user_id: ctx.venueUserId,
    type: "shift_needs_cover",
    title: `Sourcing cover — ${ctx.eventName}`,
    body: `Wave ${meta.wave} active. ${meta.guardsNotified} guards notified. We'll alert you the moment cover is confirmed.`,
    data: {
      shift_id: shift.id,
      booking_id: shift.booking_id,
      wave: meta.wave,
    },
  });

  await sendPushNotification({
    userId: ctx.venueUserId,
    type: "shift_reminder",
    title: `Sourcing cover for ${ctx.eventName}`,
    body: `${meta.guardsNotified} nearby guards notified. We'll update you the moment cover is confirmed.`,
    data: {
      reminder_kind: "shift_needs_cover",
      shift_id: shift.id,
      booking_id: shift.booking_id,
      wave: meta.wave,
    },
  });
}

/**
 * Return every personnel_id that has already received an offer for this shift
 * (across any wave). Used to dedupe broader waves so guards don't get pinged
 * twice. Tolerant: if the table or column shape differs we just return [].
 */
async function listPriorOfferRecipients(
  supabase: ServiceClient,
  shiftId: string,
): Promise<string[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("shift_offers")
      .select("personnel_id")
      .eq("shift_id", shiftId);
    if (error) return [];
    const ids = new Set<string>();
    for (const row of (data as Array<{ personnel_id: string | null }>) ?? []) {
      if (row.personnel_id) ids.add(row.personnel_id);
    }
    return Array.from(ids);
  } catch {
    return [];
  }
}

/**
 * Mark a shift as cover-unfilled when all waves expire with no taker.
 * Called by the wave-broadening cron after the final wave's window passes.
 */
export async function markCoverUnfilled(
  supabase: ServiceClient,
  shiftId: string,
): Promise<void> {
  const now = new Date();
  await (supabase as any)
    .from("shifts")
    .update({
      cover_unfilled_at: now.toISOString(),
      dispatcher_status: "unfilled",
    })
    .eq("id", shiftId)
    .is("personnel_id", null);
}
