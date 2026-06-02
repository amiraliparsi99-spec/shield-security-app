import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function padTimeCompare(t: string | null | undefined): string {
  const raw = (t || "").slice(0, 8);
  if (raw.length >= 8) return raw.slice(0, 8);
  const s = (t || "").slice(0, 5);
  return s.length === 5 ? `${s}:00` : "00:00:00";
}

function localTimeKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

export type ClaimAvailabilityWarning =
  | { shouldWarn: false }
  | { shouldWarn: true; title: string; message: string };

export type WeeklyAvailabilityRow = {
  day_of_week: number;
  is_available: boolean | null;
  start_time: string | null;
  end_time: string | null;
};

type SpecialDayRow = {
  start_time: string | null;
  end_time: string | null;
  note?: string | null;
};

/**
 * True when the shift falls inside saved weekly/special hours and is not on a blocked date.
 * Mirrors rules used by {@link getClaimAvailabilityWarning} (without messages).
 * If `availRows` is empty, returns true (no calendar — show all open shifts).
 */
export function shiftFitsPersonnelAvailability(
  scheduledStartIso: string,
  scheduledEndIso: string,
  availRows: WeeklyAvailabilityRow[],
  blockedDates: Set<string>,
  specialsByDate: Map<string, SpecialDayRow>
): boolean {
  const start = new Date(scheduledStartIso);
  const end = new Date(scheduledEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return true;
  }

  if (!availRows || availRows.length === 0) {
    return true;
  }

  const dateKey = localDateKey(start);
  const dow = start.getDay();
  const shiftStartT = localTimeKey(start);
  const shiftEndT = localTimeKey(end);

  if (blockedDates.has(dateKey)) {
    return false;
  }

  const special = specialsByDate.get(dateKey);
  if (special) {
    const spS = padTimeCompare(special.start_time);
    const spE = padTimeCompare(special.end_time);
    return shiftStartT >= spS && shiftEndT <= spE;
  }

  const weekly = availRows.find((r) => r.day_of_week === dow);
  // No row for this weekday — don't hide listings (partial / legacy data).
  if (!weekly) {
    return true;
  }
  // Only days explicitly marked unavailable are excluded; null treats as "not opted out".
  if (weekly.is_available === false) {
    return false;
  }

  if (weekly.start_time && weekly.end_time) {
    const aS = padTimeCompare(weekly.start_time);
    const aE = padTimeCompare(weekly.end_time);
    const shiftCrossesMidnight = shiftStartT > shiftEndT;
    let fits = false;
    if (aS < aE) {
      if (shiftCrossesMidnight) {
        fits = false;
      } else {
        fits = shiftStartT >= aS && shiftEndT <= aE;
      }
    } else {
      if (shiftCrossesMidnight) {
        fits = shiftStartT >= aS && shiftEndT <= aE;
      } else {
        fits = shiftStartT >= aS || shiftEndT <= aE;
      }
    }
    if (!fits) {
      return false;
    }
  }

  return true;
}

/**
 * Drops open shifts that fall outside the guard’s saved availability (blocked / special / weekly).
 * If they have no weekly availability rows yet, returns `shifts` unchanged.
 */
export async function filterOpenShiftsByPersonnelAvailability<
  T extends { scheduled_start: string; scheduled_end: string },
>(supabase: SupabaseClient, personnelId: string, shifts: T[]): Promise<T[]> {
  if (shifts.length === 0) return shifts;

  const { data: availRows } = await supabase
    .from("availability")
    .select("day_of_week, is_available, start_time, end_time")
    .eq("personnel_id", personnelId);

  if (!availRows || availRows.length === 0) {
    return shifts;
  }

  // If nothing is marked "available", weekly matching would hide every shift — skip filter.
  const hasAnyAvailableDay = availRows.some((r) => r.is_available === true);
  if (!hasAnyAvailableDay) {
    return shifts;
  }

  const dateKeys = [...new Set(shifts.map((s) => localDateKey(new Date(s.scheduled_start))))];

  const [{ data: blockedRows }, { data: specialRows }] = await Promise.all([
    supabase.from("blocked_dates").select("date").eq("personnel_id", personnelId).in("date", dateKeys),
    supabase
      .from("special_availability")
      .select("date, start_time, end_time, note")
      .eq("personnel_id", personnelId)
      .in("date", dateKeys),
  ]);

  const blockedDates = new Set((blockedRows || []).map((b) => String(b.date)));
  const specialsByDate = new Map<string, SpecialDayRow>();
  for (const row of specialRows || []) {
    if (row.date) {
      specialsByDate.set(String(row.date), {
        start_time: row.start_time,
        end_time: row.end_time,
        note: row.note,
      });
    }
  }

  return shifts.filter((s) =>
    shiftFitsPersonnelAvailability(s.scheduled_start, s.scheduled_end, availRows, blockedDates, specialsByDate)
  );
}

/**
 * Compares an open shift to the guard's saved availability (weekly + blocked + special).
 * Used before claim: if it doesn't match, show a second confirmation.
 */
export async function getClaimAvailabilityWarning(
  supabase: SupabaseClient,
  personnelId: string,
  scheduledStartIso: string,
  scheduledEndIso: string
): Promise<ClaimAvailabilityWarning> {
  const start = new Date(scheduledStartIso);
  const end = new Date(scheduledEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { shouldWarn: false };
  }

  const dateKey = localDateKey(start);
  const dow = start.getDay();
  const shiftStartT = localTimeKey(start);
  const shiftEndT = localTimeKey(end);

  const [{ data: availRows }, { data: blocked }] = await Promise.all([
    supabase.from("availability").select("day_of_week, is_available, start_time, end_time").eq("personnel_id", personnelId),
    supabase
      .from("blocked_dates")
      .select("id, reason")
      .eq("personnel_id", personnelId)
      .eq("date", dateKey)
      .maybeSingle(),
  ]);

  if (!availRows || availRows.length === 0) {
    return { shouldWarn: false };
  }

  const blockedDates = new Set(blocked?.id ? [dateKey] : []);
  const specialsByDate = new Map<string, SpecialDayRow>();

  const { data: special } = await supabase
    .from("special_availability")
    .select("start_time, end_time, note")
    .eq("personnel_id", personnelId)
    .eq("date", dateKey)
    .maybeSingle();

  if (special) {
    specialsByDate.set(dateKey, {
      start_time: special.start_time,
      end_time: special.end_time,
      note: special.note,
    });
  }

  if (shiftFitsPersonnelAvailability(scheduledStartIso, scheduledEndIso, availRows, blockedDates, specialsByDate)) {
    return { shouldWarn: false };
  }

  if (blocked?.id) {
    const reason = blocked.reason ? ` (${blocked.reason})` : "";
    const pretty = start.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return {
      shouldWarn: true,
      title: "Day marked unavailable",
      message: `You blocked ${pretty} in your calendar${reason}. Are you sure you want this shift? You can change blocked dates in Availability.`,
    };
  }

  if (special) {
    const note = special.note ? ` Note: ${special.note}` : "";
    return {
      shouldWarn: true,
      title: "Outside your hours for this date",
      message: `For this date you set special hours (${String(special.start_time).slice(0, 5)}–${String(special.end_time).slice(0, 5)}). This shift doesn’t fall in that window.${note} Claim anyway?`,
    };
  }

  const weekly = availRows.find((r) => r.day_of_week === dow);
  const enabledNames = availRows
    .filter((r) => r.is_available === true)
    .map((r) => DAY_NAMES[r.day_of_week] ?? "?")
    .filter((n, i, a) => a.indexOf(n) === i);

  if (weekly?.is_available === false) {
    const listed =
      enabledNames.length > 0
        ? enabledNames.join(", ")
        : "no days enabled in your weekly schedule";
    return {
      shouldWarn: true,
      title: "Outside your usual availability",
      message: `You’ve set yourself as usually available on: ${listed}. This shift is on a ${DAY_NAMES[dow]}. Are you sure you want to claim it?`,
    };
  }

  if (weekly.start_time && weekly.end_time) {
    const aS = padTimeCompare(weekly.start_time);
    const aE = padTimeCompare(weekly.end_time);
    const shiftXMid = shiftStartT > shiftEndT;
    let fits = false;
    if (aS < aE) {
      if (shiftXMid) {
        fits = false;
      } else {
        fits = shiftStartT >= aS && shiftEndT <= aE;
      }
    } else {
      if (shiftXMid) {
        fits = shiftStartT >= aS && shiftEndT <= aE;
      } else {
        fits = shiftStartT >= aS || shiftEndT <= aE;
      }
    }
    if (!fits) {
      return {
        shouldWarn: true,
        title: "Outside your usual hours",
        message: `On ${DAY_NAMES[dow]}s you said you’re available ${String(weekly.start_time).slice(0, 5)}–${String(weekly.end_time).slice(0, 5)}. This shift is outside that window. Claim anyway?`,
      };
    }
  }

  return {
    shouldWarn: true,
    title: "Outside your availability",
    message: "This shift doesn’t match your saved availability. Claim anyway?",
  };
}
