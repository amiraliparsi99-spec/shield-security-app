/**
 * Load shifts for a guard — includes rows where they were unassigned after
 * working (original_personnel_id) so partial/early work always appears in history.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftHasRecordedWork } from "./shiftEarnings";

export function mergeShiftRowsById<T extends { id: string }>(
  ...groups: (T[] | null | undefined)[]
): T[] {
  const byId = new Map<string, T>();
  for (const group of groups) {
    for (const row of group ?? []) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

/** Shifts the guard should see in work history / earnings. */
export function shiftBelongsToGuard(
  shift: { personnel_id?: string | null; original_personnel_id?: string | null },
  personnelId: string,
): boolean {
  return (
    shift.personnel_id === personnelId ||
    shift.original_personnel_id === personnelId
  );
}

export function isWorkedShiftForGuard(
  shift: {
    personnel_id?: string | null;
    original_personnel_id?: string | null;
    status?: string;
    actual_start?: string | null;
  },
  personnelId: string,
): boolean {
  if (!shiftBelongsToGuard(shift, personnelId)) return false;
  return shiftHasRecordedWork(shift);
}

type FetchGuardShiftsOpts = {
  select: string;
  /** ISO — only shifts with scheduled_start >= cutoff */
  scheduledStartGte?: string;
  orderAsc?: boolean;
  limit?: number;
};

export async function fetchGuardShifts<T extends { id: string }>(
  supabase: SupabaseClient,
  personnelId: string,
  opts: FetchGuardShiftsOpts,
): Promise<T[]> {
  let assignedQuery = supabase
    .from("shifts")
    .select(opts.select)
    .eq("personnel_id", personnelId);

  let historyQuery = supabase
    .from("shifts")
    .select(opts.select)
    .eq("original_personnel_id", personnelId)
    .not("actual_start", "is", null);

  if (opts.scheduledStartGte) {
    assignedQuery = assignedQuery.gte("scheduled_start", opts.scheduledStartGte);
    historyQuery = historyQuery.gte("scheduled_start", opts.scheduledStartGte);
  }

  assignedQuery = assignedQuery.order("scheduled_start", {
    ascending: opts.orderAsc ?? true,
  });
  historyQuery = historyQuery.order("scheduled_start", {
    ascending: opts.orderAsc ?? true,
  });

  if (opts.limit) {
    assignedQuery = assignedQuery.limit(opts.limit);
    historyQuery = historyQuery.limit(opts.limit);
  }

  const [assignedRes, historyRes] = await Promise.all([
    assignedQuery,
    historyQuery,
  ]);

  return mergeShiftRowsById<T>(
    (assignedRes.data as T[]) ?? [],
    (historyRes.data as T[]) ?? [],
  );
}
