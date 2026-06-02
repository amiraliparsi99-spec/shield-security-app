"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { StatsSkeleton, ListSkeleton } from "@/components/ui/LoadingStates";
import {
  exportSpendCSV,
  exportSpendPDF,
  exportEventInvoice,
  exportBulkInvoices,
  type ReportEvent,
  type VenueInfo,
} from "@/lib/reports";

const fmtGBP = (v: number) =>
  v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SpendEntry = {
  id: string;
  date: string;
  eventName: string;
  guardsCount: number;
  totalCost: number;
  status: "paid" | "pending" | "overdue";
  startTime?: string;
  endTime?: string;
  staffRequirements?: { role: string; count: number; rate: number }[];
  platformFee?: number;
};

type TimeRange = "week" | "month" | "quarter" | "year";

function getRangeBounds(range: TimeRange): { start: string; label: string } {
  const now = new Date();
  let start: Date;
  let label: string;

  switch (range) {
    case "week": {
      start = new Date(now.getTime() - 7 * 86_400_000);
      label = "This Week";
      break;
    }
    case "month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "This Month";
      break;
    }
    case "quarter": {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      label = "This Quarter";
      break;
    }
    case "year": {
      start = new Date(now.getFullYear(), 0, 1);
      label = "This Year";
      break;
    }
  }

  return { start: start.toISOString().slice(0, 10), label };
}

function parseStaffDisplay(raw: unknown): { role: string; count: number; rate: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => {
    const rateRaw = Number(r.rate_pence ?? r.rate ?? r.hourly_rate ?? 0);
    const rateGBP = r.rate_pence != null ? rateRaw / 100 : rateRaw >= 100 ? rateRaw / 100 : rateRaw;
    return {
      role: r.role || r.security_type || "Security",
      count: Number(r.count) || Number(r.quantity) || 1,
      rate: rateGBP > 0 ? rateGBP : 18,
    };
  });
}

/**
 * Calculate the true cost of a booking from staff_requirements + hours.
 * Never trusts estimated_total which has inconsistent units across bookings.
 */
function computeBookingCost(b: any): { base: number; fee: number; total: number } {
  const sr = b.staff_requirements;
  const startTime: string = b.start_time || "";
  const endTime: string = b.end_time || "";

  // Calculate hours from times
  let hours = 0;
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let startMins = (sh || 0) * 60 + (sm || 0);
    let endMins = (eh || 0) * 60 + (em || 0);
    if (endMins <= startMins) endMins += 24 * 60;
    hours = (endMins - startMins) / 60;
  }

  // Calculate from staff requirements (ground truth)
  if (Array.isArray(sr) && sr.length > 0 && hours > 0) {
    let baseCost = 0;
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
    }
    const fee = Math.round(baseCost * 0.05 * 100) / 100;
    const total = Math.round((baseCost + fee) * 100) / 100;
    return { base: Math.round(baseCost * 100) / 100, fee, total };
  }

  // Fallback: estimated_total is unreliable, so treat all values as pence
  const raw = Math.abs(Number(b.final_total ?? b.estimated_total ?? 0));
  if (raw <= 0) return { base: 0, fee: 0, total: 0 };
  const baseFromPence = raw / 100;
  const fee = Math.round(baseFromPence * 0.05 * 100) / 100;
  return { base: Math.round(baseFromPence * 100) / 100, fee, total: Math.round((baseFromPence + fee) * 100) / 100 };
}

async function resolveVenueId(supabase: any, userId: string): Promise<string | null> {
  const { data: profileByUserId } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let profileId = profileByUserId?.id ?? null;

  if (!profileId) {
    const { data: profileById } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    profileId = profileById?.id ?? null;
  }

  if (!profileId) return null;

  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("user_id", profileId)
    .maybeSingle();

  return venue?.id ?? null;
}

export function SpendDashboard() {
  const [allEntries, setAllEntries] = useState<SpendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [budget, setBudget] = useState<number>(8000);
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);
  const [venueInfo, setVenueInfo] = useState<VenueInfo>({ name: "Venue" });
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const fetchSpend = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const venueId = await resolveVenueId(supabase, user.id);
      if (!venueId) {
        setLoading(false);
        return;
      }

      const { data: venueData } = await supabase
        .from("venues")
        .select("name, address_line1, city, postcode, email, phone")
        .eq("id", venueId)
        .maybeSingle();

      if (venueData) {
        setVenueInfo({
          name: venueData.name || "Venue",
          address: venueData.address_line1 || undefined,
          city: venueData.city || undefined,
          postcode: venueData.postcode || undefined,
          email: venueData.email || undefined,
          phone: venueData.phone || undefined,
        });
      }

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(
          "id, event_name, event_date, start_time, end_time, status, staff_requirements, estimated_total, final_total, platform_fee",
        )
        .eq("venue_id", venueId)
        .in("status", ["pending", "confirmed", "completed", "in_progress"])
        .order("event_date", { ascending: false });

      const entries: SpendEntry[] = (bookingsData || []).map((b: any) => {
        const cost = computeBookingCost(b);
        const isPaid = b.status === "completed";
        const reqs = parseStaffDisplay(b.staff_requirements);
        const guards = reqs.reduce((s, r) => s + r.count, 0) || 1;
        return {
          id: b.id,
          date: b.event_date || "",
          eventName: b.event_name || "Event",
          guardsCount: guards,
          totalCost: cost.total,
          status: isPaid ? ("paid" as const) : ("pending" as const),
          startTime: b.start_time || undefined,
          endTime: b.end_time || undefined,
          staffRequirements: reqs,
          platformFee: cost.fee,
        };
      });

      setAllEntries(entries);
      setLoading(false);
    };
    fetchSpend();
  }, []);

  const { start: rangeStart, label: rangeLabel } = getRangeBounds(timeRange);

  const filtered = useMemo(
    () => allEntries.filter((e) => e.date >= rangeStart),
    [allEntries, rangeStart],
  );

  const totalSpend = useMemo(() => filtered.reduce((s, e) => s + e.totalCost, 0), [filtered]);
  const eventCount = filtered.length;
  const avgPerEvent = eventCount > 0 ? Math.round(totalSpend / eventCount) : 0;
  const pendingAmount = useMemo(
    () => filtered.filter((e) => e.status === "pending").reduce((s, e) => s + e.totalCost, 0),
    [filtered],
  );
  const paidAmount = useMemo(
    () => filtered.filter((e) => e.status === "paid").reduce((s, e) => s + e.totalCost, 0),
    [filtered],
  );

  const budgetUsed = budget > 0 ? Math.round((totalSpend / budget) * 100) : 0;

  // Group by month for trend chart
  const monthlyData = useMemo(() => {
    const byMonth: Record<string, { total: number; events: number }> = {};
    for (const e of filtered) {
      const key = e.date.slice(0, 7);
      if (!key || key.length < 7) continue;
      if (!byMonth[key]) byMonth[key] = { total: 0, events: 0 };
      byMonth[key].total += e.totalCost;
      byMonth[key].events += 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        month: new Date(key + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
        total: Math.round(v.total),
        events: v.events,
      }));
  }, [filtered]);

  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  const toReportEvents = useCallback(
    (entries: SpendEntry[]): ReportEvent[] =>
      entries.map((e) => ({
        id: e.id,
        date: e.date,
        eventName: e.eventName,
        guardsCount: e.guardsCount,
        totalCost: e.totalCost,
        status: e.status,
        startTime: e.startTime,
        endTime: e.endTime,
        staffRequirements: e.staffRequirements,
        platformFee: e.platformFee,
      })),
    [],
  );

  const handleExportCSV = useCallback(() => {
    exportSpendCSV(toReportEvents(filtered), rangeLabel, venueInfo);
    setShowExportMenu(false);
  }, [filtered, rangeLabel, venueInfo, toReportEvents]);

  const handleExportPDF = useCallback(() => {
    exportSpendPDF(toReportEvents(filtered), rangeLabel, venueInfo, {
      totalSpend,
      avgPerEvent,
      pending: pendingAmount,
      paid: paidAmount,
      budget,
    });
    setShowExportMenu(false);
  }, [filtered, rangeLabel, venueInfo, totalSpend, avgPerEvent, pendingAmount, paidAmount, budget, toReportEvents]);

  const handleDownloadAllInvoices = useCallback(() => {
    exportBulkInvoices(toReportEvents(filtered), rangeLabel, venueInfo);
    setShowExportMenu(false);
  }, [filtered, rangeLabel, venueInfo, toReportEvents]);

  const handleDownloadEventInvoice = useCallback(
    (entry: SpendEntry) => {
      exportEventInvoice(
        {
          id: entry.id,
          date: entry.date,
          eventName: entry.eventName,
          guardsCount: entry.guardsCount,
          totalCost: entry.totalCost,
          status: entry.status,
          startTime: entry.startTime,
          endTime: entry.endTime,
          staffRequirements: entry.staffRequirements,
          platformFee: entry.platformFee,
        },
        venueInfo,
      );
    },
    [venueInfo],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <StatsSkeleton />
        <div className="glass rounded-xl p-6">
          <div className="h-5 w-32 shimmer rounded mb-4" />
          <ListSkeleton count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Spend Dashboard</h2>
          <p className="text-sm text-zinc-400">Track your security costs</p>
        </div>
        <div className="flex gap-2">
          {(["week", "month", "quarter", "year"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                timeRange === range
                  ? "bg-purple-500 text-white"
                  : "glass text-zinc-400 hover:text-white"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Spend</p>
          <p className="text-2xl font-bold text-white">
            £{fmtGBP(totalSpend)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {eventCount} event{eventCount !== 1 ? "s" : ""} · {rangeLabel.toLowerCase()}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Per Event</p>
          <p className="text-2xl font-bold text-blue-400">£{fmtGBP(avgPerEvent)}</p>
          <p className="text-xs text-zinc-500 mt-1">{rangeLabel.toLowerCase()}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Pending</p>
          <p className="text-2xl font-bold text-amber-400">
            £{fmtGBP(pendingAmount)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Awaiting completion</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Paid</p>
          <p className="text-2xl font-bold text-emerald-400">
            £{fmtGBP(paidAmount)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Completed events</p>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Monthly Budget</h3>
            <p className="text-sm text-zinc-400">
              £{fmtGBP(totalSpend)} of £{fmtGBP(budget)}
            </p>
          </div>
          {showBudgetEdit ? (
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">£</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(parseInt(e.target.value) || 0)}
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white focus:border-purple-500 focus:outline-none transition"
              />
              <button onClick={() => setShowBudgetEdit(false)} className="text-purple-400 hover:text-purple-300 text-sm">
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setShowBudgetEdit(true)} className="text-sm text-zinc-400 hover:text-white transition">
              Edit Budget
            </button>
          )}
        </div>

        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            key={`budget-${timeRange}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(budgetUsed, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute h-full rounded-full ${
              budgetUsed >= 100 ? "bg-red-500" : budgetUsed >= 80 ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
        </div>

        <div className="flex justify-between mt-2 text-sm">
          <span
            className={`font-medium ${
              budgetUsed >= 100 ? "text-red-400" : budgetUsed >= 80 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {budgetUsed}% used
          </span>
          <span className="text-zinc-400">£{fmtGBP(Math.max(budget - totalSpend, 0))} remaining</span>
        </div>

        {budgetUsed >= 80 && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              budgetUsed >= 100 ? "bg-red-500/10 border border-red-500/30" : "bg-amber-500/10 border border-amber-500/30"
            }`}
          >
            <p className={`text-sm font-medium ${budgetUsed >= 100 ? "text-red-400" : "text-amber-400"}`}>
              {budgetUsed >= 100 ? "Budget exceeded!" : "Approaching budget limit"}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {budgetUsed >= 100
                ? "You've exceeded your monthly security budget."
                : "You're at 80% of your monthly security budget."}
            </p>
          </div>
        )}
      </div>

      {/* Spending Trend Chart */}
      {monthlyData.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4">Spending Trend</h3>
          <div className="space-y-3">
            {monthlyData.map((month, idx) => (
              <div key={month.month} className="flex items-center gap-4">
                <span className="w-20 shrink-0 text-sm text-zinc-400">{month.month}</span>
                <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                  <motion.div
                    key={`bar-${timeRange}-${month.month}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(month.total / maxMonthly) * 100}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg"
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-sm font-medium text-white">
                    £{fmtGBP(month.total)}
                  </span>
                </div>
                <span className="w-20 shrink-0 text-right text-sm text-zinc-500">
                  {month.events} event{month.events !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events with Invoice Downloads */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Events</h3>
          <span className="text-xs text-zinc-500">{filtered.length} results</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-500">No events found for {rangeLabel.toLowerCase()}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.slice(0, 20).map((entry) => (
              <div key={entry.id}>
                <button
                  type="button"
                  onClick={() => setExpandedEvent(expandedEvent === entry.id ? null : entry.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 font-display text-sm font-semibold text-purple-400">
                      {(() => {
                        try {
                          return new Date(entry.date + "T00:00:00").getDate();
                        } catch {
                          return "—";
                        }
                      })()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{entry.eventName}</p>
                      <p className="text-sm text-zinc-400">
                        {(() => {
                          try {
                            return new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            });
                          } catch {
                            return entry.date;
                          }
                        })()}
                        {entry.guardsCount > 0 ? ` · ${entry.guardsCount} guard${entry.guardsCount !== 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        entry.status === "paid"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : entry.status === "overdue"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {entry.status === "paid" ? "Paid" : entry.status === "overdue" ? "Overdue" : "Pending"}
                    </span>
                    <span className="font-semibold text-white">£{fmtGBP(entry.totalCost)}</span>
                    <svg
                      className={`h-4 w-4 text-zinc-500 transition-transform ${expandedEvent === entry.id ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedEvent === entry.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="rounded-lg bg-white/5 p-4 space-y-3">
                          {/* Event Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-zinc-500 block text-xs">Date</span>
                              <span className="text-white">{(() => {
                                try {
                                  return new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  });
                                } catch {
                                  return entry.date;
                                }
                              })()}</span>
                            </div>
                            {entry.startTime && (
                              <div>
                                <span className="text-zinc-500 block text-xs">Time</span>
                                <span className="text-white">{entry.startTime?.slice(0, 5)} – {entry.endTime?.slice(0, 5)}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-zinc-500 block text-xs">Guards</span>
                              <span className="text-white">{entry.guardsCount}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block text-xs">Total</span>
                              <span className="text-white font-semibold">
                                £{fmtGBP(entry.totalCost)}
                              </span>
                            </div>
                          </div>

                          {/* Staff breakdown */}
                          {entry.staffRequirements && entry.staffRequirements.length > 0 && (
                            <div className="border-t border-white/10 pt-3">
                              <span className="text-xs text-zinc-500 block mb-2">Staff Breakdown</span>
                              <div className="space-y-1">
                                {entry.staffRequirements.map((r, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span className="text-zinc-300">{r.count}× {r.role}</span>
                                    <span className="text-zinc-400">£{r.rate}/hr</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Fee breakdown */}
                          {entry.platformFee != null && entry.platformFee > 0 && (
                            <div className="border-t border-white/10 pt-3 flex justify-between text-sm">
                              <span className="text-zinc-500">Platform Fee</span>
                              <span className="text-zinc-400">
                                £{fmtGBP(entry.platformFee)}
                              </span>
                            </div>
                          )}

                          {/* Download Invoice Button */}
                          <div className="border-t border-white/10 pt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadEventInvoice(entry);
                              }}
                              className="flex items-center gap-2 rounded-lg bg-purple-500/15 px-3 py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/25 transition active:scale-[0.98]"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download Invoice (PDF)
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="relative">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 glass rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report
              <svg className={`h-3 w-3 transition-transform ${showExportMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 rounded-xl border border-white/10 overflow-hidden z-20 shadow-2xl shadow-black/60"
                >
                  <div className="p-2 space-y-0.5">
                    <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      {rangeLabel}
                    </p>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/[0.08] transition text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                        <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <div>
                        <span className="font-medium block text-white">Spend Report (PDF)</span>
                        <span className="text-xs text-zinc-400">Summary with charts & totals</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/[0.08] transition text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                        <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </span>
                      <div>
                        <span className="font-medium block text-white">Spreadsheet (CSV)</span>
                        <span className="text-xs text-zinc-400">Import into Excel or Sheets</span>
                      </div>
                    </button>
                    <div className="border-t border-zinc-700/60 my-1" />
                    <p className="px-3 py-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">Invoices</p>
                    <button
                      type="button"
                      onClick={handleDownloadAllInvoices}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/[0.08] transition text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/15">
                        <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </span>
                      <div>
                        <span className="font-medium block text-white">All Invoices (PDF)</span>
                        <span className="text-xs text-zinc-400">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""} for {rangeLabel.toLowerCase()}</span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Click-away overlay */}
        {showExportMenu && (
          <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
        )}
      </div>
    </div>
  );
}
