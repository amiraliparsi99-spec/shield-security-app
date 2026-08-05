import type { SupabaseClient } from "@supabase/supabase-js";

export interface RevenueData {
  total: number;
  thisMonth: number;
  lastMonth: number;
  growth: number;
  byVenue: { name: string; amount: number }[];
  byMonth: { month: string; amount: number }[];
  byStaff: { name: string; amount: number }[];
  shiftCount: number;
}

type ShiftRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  agency_commission: number | null;
  total_pay: number | null;
  hourly_rate: number | null;
  hours_worked: number | null;
  actual_end: string | null;
  personnel: { display_name: string | null } | { display_name: string | null }[] | null;
  bookings:
    | {
        event_name: string | null;
        site_label: string | null;
        venues: { name: string | null } | { name: string | null }[] | null;
      }
    | {
        event_name: string | null;
        site_label: string | null;
        venues: { name: string | null } | { name: string | null }[] | null;
      }[]
    | null;
};

function rel<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function shiftRevenuePounds(shift: ShiftRow): number {
  if (shift.agency_commission != null && Number(shift.agency_commission) > 0) {
    return Number(shift.agency_commission);
  }
  if (shift.total_pay != null && Number(shift.total_pay) > 0) {
    return Number(shift.total_pay);
  }
  const hours =
    shift.hours_worked ??
    (new Date(shift.scheduled_end).getTime() - new Date(shift.scheduled_start).getTime()) /
      3_600_000;
  return Math.max(0, hours * Number(shift.hourly_rate ?? 0));
}

function shiftLabel(shift: ShiftRow): string {
  const booking = rel(shift.bookings);
  const venue = rel(booking?.venues);
  return (
    booking?.site_label ||
    booking?.event_name ||
    venue?.name ||
    "Agency booking"
  );
}

function rangeStart(timeRange: "month" | "quarter" | "year", now = new Date()): Date {
  if (timeRange === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (timeRange === "quarter") return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return new Date(now.getFullYear(), 0, 1);
}

export async function loadAgencyRevenue(
  supabase: SupabaseClient,
  agencyId: string,
  timeRange: "month" | "quarter" | "year" = "month",
): Promise<RevenueData | null> {
  const rangeFrom = rangeStart(timeRange);

  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(
      `
      id,
      scheduled_start,
      scheduled_end,
      status,
      agency_commission,
      total_pay,
      hourly_rate,
      hours_worked,
      actual_end,
      personnel:personnel_id(display_name),
      bookings(event_name, site_label, venues(name))
    `,
    )
    .eq("agency_id", agencyId)
    .in("status", ["checked_out", "checked_in", "accepted"])
    .gte("scheduled_start", rangeFrom.toISOString())
    .order("scheduled_end", { ascending: false });

  if (error) {
    console.error("[revenue] shift query failed:", error.message);
    return null;
  }

  const rows = (shifts as ShiftRow[]) ?? [];
  const revenueRows = rows.filter((s) => s.status === "checked_out" || s.status === "checked_in");

  if (revenueRows.length === 0) {
    return {
      total: 0,
      thisMonth: 0,
      lastMonth: 0,
      growth: 0,
      byVenue: [],
      byMonth: [],
      byStaff: [],
      shiftCount: 0,
    };
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let total = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  const byVenue = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byStaff = new Map<string, number>();

  for (const shift of revenueRows) {
    const revenue = shiftRevenuePounds(shift);
    total += revenue;

    const endedAt = new Date(shift.actual_end || shift.scheduled_end);
    if (endedAt >= thisMonthStart) {
      thisMonth += revenue;
    } else if (endedAt >= lastMonthStart && endedAt < thisMonthStart) {
      lastMonth += revenue;
    }

    const venueName = shiftLabel(shift);
    byVenue.set(venueName, (byVenue.get(venueName) || 0) + revenue);

    const monthKey = endedAt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + revenue);

    const staffName = rel(shift.personnel)?.display_name || "Unassigned";
    byStaff.set(staffName, (byStaff.get(staffName) || 0) + revenue);
  }

  const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? 100 : 0;

  return {
    total,
    thisMonth,
    lastMonth,
    growth,
    byVenue: Array.from(byVenue.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    byMonth: Array.from(byMonth.entries())
      .map(([month, amount]) => ({ month, amount }))
      .reverse()
      .slice(0, 12),
    byStaff: Array.from(byStaff.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    shiftCount: revenueRows.length,
  };
}
