/**
 * Cover wave broadening cron.
 *
 * Runs every minute. For each shift currently in cover-search mode
 * (`cover_search_wave > 0`, no personnel_id, scheduled_start in the future),
 * checks whether the previous wave's window has expired without a taker.
 * If so, bumps the wave (5 mi → 15 mi → 25 mi) via the cover engine.
 *
 * After the final wave's delay window passes, the shift is marked
 * `cover_unfilled_at` so the venue UI can show the unfilled banner.
 *
 * Concept doc: docs/SHIFT_COVER_ESCALATION_PLAN.md §3 / §4 P2.5.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCronAuth } from "@/lib/auth/cronAuth";
import {
  broadenCoverWave,
  markCoverUnfilled,
  resolveCoverWavesFromEnv,
} from "@/lib/shifts/coverEngine";
import { isMissingColumnError } from "@/lib/postgresErrors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ShiftRow = {
  id: string;
  booking_id: string;
  personnel_id: string | null;
  status: string;
  scheduled_start: string;
  cover_search_wave: number | null;
  cover_search_started_at: string | null;
  cover_search_last_wave_at: string | null;
  cover_unfilled_at: string | null;
  original_personnel_id?: string | null;
};

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const waves = resolveCoverWavesFromEnv();

  // Pull every shift currently searching for cover. We only consider shifts
  // whose scheduled_start is still in the future (or within the last 60 min)
  // — beyond that it's archaeology.
  const lowerBound = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const select =
    "id, booking_id, personnel_id, status, scheduled_start, cover_search_wave, cover_search_started_at, cover_search_last_wave_at, cover_unfilled_at, original_personnel_id";

  const resp = await supabase
    .from("shifts")
    .select(select)
    .gt("cover_search_wave", 0)
    .is("personnel_id", null)
    .is("cover_unfilled_at", null)
    .gte("scheduled_start", lowerBound)
    .limit(200);

  if (resp.error) {
    if (isMissingColumnError(resp.error)) {
      // Migration hasn't run — nothing to do.
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "cover_search_wave columns not present",
      });
    }
    console.error("[COVER-WAVE-CRON] query failed:", resp.error);
    return NextResponse.json({ error: resp.error.message }, { status: 500 });
  }

  const shifts = (resp.data as ShiftRow[]) ?? [];
  let broadened = 0;
  let unfilled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const shift of shifts) {
    try {
      const currentWave = shift.cover_search_wave ?? 1;
      const lastWaveAt = shift.cover_search_last_wave_at
        ? new Date(shift.cover_search_last_wave_at)
        : shift.cover_search_started_at
          ? new Date(shift.cover_search_started_at)
          : null;

      if (!lastWaveAt) {
        skipped++;
        continue;
      }

      const minutesSinceLastWave = (now.getTime() - lastWaveAt.getTime()) / 60_000;

      const currentCfg = waves.find((w) => w.wave === currentWave) ?? waves[0];
      const dueForBroadening = minutesSinceLastWave >= currentCfg.delayMinutesUntilNextWave;

      if (!dueForBroadening) {
        skipped++;
        continue;
      }

      // Past the final wave's grace → mark unfilled and stop.
      if (currentCfg.finalWave) {
        await markCoverUnfilled(supabase as any, shift.id);
        unfilled++;
        continue;
      }

      const nextWave = currentWave + 1;
      const result = await broadenCoverWave({
        supabase: supabase as any,
        shift: {
          id: shift.id,
          booking_id: shift.booking_id,
          personnel_id: shift.personnel_id,
          status: shift.status,
          scheduled_start: shift.scheduled_start,
          cover_search_wave: currentWave,
          cover_search_started_at: shift.cover_search_started_at,
          cover_search_last_wave_at: shift.cover_search_last_wave_at,
        },
        toWave: nextWave,
        trigger: "wave_expired",
        excludePersonnelIds: shift.original_personnel_id
          ? [shift.original_personnel_id]
          : [],
      });

      if (result.ok) {
        broadened++;
      } else if (result.error) {
        errors.push(`${shift.id}: ${result.error}`);
      }
    } catch (e: any) {
      errors.push(`${shift.id}: ${e?.message ?? String(e)}`);
    }
  }

  return NextResponse.json({
    success: true,
    examined: shifts.length,
    broadened,
    unfilled,
    skipped,
    errors: errors.length ? errors : undefined,
    at: now.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
