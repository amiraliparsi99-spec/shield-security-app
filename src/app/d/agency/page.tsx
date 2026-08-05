import { VenueOverview } from "@/components/venue/VenueOverview";
import type { BookingSummary } from "@/components/venue/VenueOverview";
import { createClient } from "@/lib/supabase/server";

const AGENCY_CONFIG = {
  basePath: "/d/agency",
  accent: "shield" as const,
  spendHref: "/d/agency/revenue",
};

async function resolveAgency(
  supabase: any,
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!agency) return null;
  return { id: agency.id, name: agency.name || "Your Agency" };
}

export default async function AgencyDashboard() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const agency = session?.user?.id
    ? await resolveAgency(supabase, session.user.id)
    : null;

  const agencyName = agency?.name ?? "Your Agency";

  // ── Fetch all bookings this agency created ──
  let allBookings: any[] = [];
  if (agency?.id) {
    const { data: rows, error } = await supabase
      .from("bookings")
      .select(
        "id, event_name, event_date, start_time, end_time, status, staff_requirements, estimated_total, final_total",
      )
      .eq("agency_id", agency.id)
      .order("event_date", { ascending: false });
    if (error) {
      console.error("[AgencyDashboard] Bookings fetch failed:", error.message);
    }
    allBookings = rows || [];
  }

  // ── Recalculate costs from staff_requirements + hours (ground truth) ──
  const summaries: BookingSummary[] = allBookings.map((b) => {
    const sr = b.staff_requirements;
    const startTime: string = b.start_time || "";
    const endTime: string = b.end_time || "";

    let hours = 0;
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const startMins = (sh || 0) * 60 + (sm || 0);
      let endMins = (eh || 0) * 60 + (em || 0);
      if (endMins <= startMins) endMins += 24 * 60;
      hours = (endMins - startMins) / 60;
    }

    let baseCost = 0;
    let guardsCount = 0;
    if (Array.isArray(sr) && sr.length > 0 && hours > 0) {
      for (const row of sr) {
        const count = Number(row?.count ?? row?.quantity ?? 1);
        const rawRate = Number(row?.rate_pence ?? row?.rate ?? row?.hourly_rate ?? 0);
        let rateGBP: number;
        if (row?.rate_pence != null) {
          rateGBP = rawRate / 100;
        } else if (rawRate >= 100) {
          rateGBP = rawRate / 100;
        } else {
          rateGBP = rawRate;
        }
        if (rateGBP <= 0) rateGBP = 18;
        baseCost += count * rateGBP * hours;
        guardsCount += count;
      }
    } else {
      const raw = Math.abs(Number(b.final_total ?? b.estimated_total ?? 0));
      baseCost = raw > 0 ? raw / 100 : 0;
      guardsCount = Array.isArray(sr)
        ? sr.reduce((s: number, r: any) => s + Number(r.count ?? r.quantity ?? 1), 0)
        : 1;
    }

    const totalWithFee = Math.round((baseCost + baseCost * 0.05) * 100) / 100;

    return {
      id: b.id,
      event_name: b.event_name || "Untitled Event",
      event_date: b.event_date,
      start_time: b.start_time || "00:00",
      end_time: b.end_time || "00:00",
      status: b.status || "pending",
      guards_count: guardsCount || 1,
      estimated_total: totalWithFee,
      final_total: b.status === "completed" ? totalWithFee : null,
    };
  });

  // ── Metrics ──
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekAhead = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const weekBehind = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const liveStatuses = new Set(["pending", "confirmed", "in_progress"]);
  const spendStatuses = new Set(["pending", "completed", "confirmed", "in_progress"]);

  const active = summaries.filter((b) => liveStatuses.has(b.status));
  const activeBookingsCount = active.length;

  const futureWeek = active.filter(
    (b) => b.event_date >= todayStr && b.event_date <= weekAhead,
  );
  const pastWeek = active.filter(
    (b) => b.event_date >= weekBehind && b.event_date < todayStr,
  );
  const weekCount = futureWeek.length > 0 ? futureWeek.length : pastWeek.length;
  const weekLabel = futureWeek.length > 0 ? "Upcoming this week" : "Last 7 days";

  const todayBookings = summaries.filter(
    (b) => b.event_date === todayStr && liveStatuses.has(b.status),
  );
  const guardsToday = todayBookings.reduce((sum, b) => sum + b.guards_count, 0);

  let totalSpend = 0;
  let spendLabel = "This month";
  const thisMonthSpend = summaries.filter(
    (b) => b.event_date >= thisMonthStart && spendStatuses.has(b.status),
  );
  if (thisMonthSpend.length > 0) {
    for (const b of thisMonthSpend) {
      totalSpend += b.final_total ?? b.estimated_total ?? 0;
    }
  } else {
    const lastMonthEnd = thisMonthStart;
    const lastMonthSpend = summaries.filter(
      (b) =>
        b.event_date >= lastMonthStart &&
        b.event_date < lastMonthEnd &&
        spendStatuses.has(b.status),
    );
    for (const b of lastMonthSpend) {
      totalSpend += b.final_total ?? b.estimated_total ?? 0;
    }
    if (lastMonthSpend.length > 0) spendLabel = "Last month";
  }

  // ── Bookings list — future first, then recent ──
  const futureActive = active
    .filter((b) => b.event_date >= todayStr)
    .sort(
      (a, b) =>
        a.event_date.localeCompare(b.event_date) ||
        a.start_time.localeCompare(b.start_time),
    );
  const pastActive = active
    .filter((b) => b.event_date < todayStr)
    .sort(
      (a, b) =>
        b.event_date.localeCompare(a.event_date) ||
        b.start_time.localeCompare(a.start_time),
    );
  const displayBookings = [...futureActive, ...pastActive].slice(0, 5);

  return (
    <VenueOverview
      venueName={agencyName}
      config={AGENCY_CONFIG}
      metrics={{
        activeBookings: activeBookingsCount,
        upcomingThisWeek: weekCount,
        monthlySpend: totalSpend,
        guardsToday,
      }}
      weekLabel={weekLabel}
      spendLabel={spendLabel}
      upcomingBookings={displayBookings}
      todayBookings={todayBookings}
    />
  );
}
