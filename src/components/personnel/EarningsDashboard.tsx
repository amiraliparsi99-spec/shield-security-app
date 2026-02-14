"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useShiftHistory, useEarnings, usePersonnelProfile } from "@/hooks";
import type { Shift } from "@/lib/database.types";

const TAX_FREE_ALLOWANCE = 12570;
const BASIC_RATE = 0.20;
const NI_RATE = 0.12;
const NI_THRESHOLD = 12570;

export function EarningsDashboard() {
  const { data: profile } = usePersonnelProfile();
  const { data: shifts, loading } = useShiftHistory(100);
  const { totalEarnings, pendingEarnings, totalHours } = useEarnings();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");

  // Calculate stats based on time range
  const filteredShifts = useMemo(() => {
    if (!shifts) return [];
    
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (timeRange) {
      case "week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "year":
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return shifts.filter(s => new Date(s.scheduled_start) >= cutoffDate);
  }, [shifts, timeRange]);

  // Calculate period earnings - use actual payments if available, otherwise shift data
  const shiftEarnings = filteredShifts.reduce((sum, s) => sum + (s.total_pay || 0), 0);
  const periodEarnings = totalEarnings > 0 ? totalEarnings : shiftEarnings;
  const periodHours = filteredShifts.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
  const avgRate = periodHours > 0 ? periodEarnings / periodHours : (profile?.hourly_rate || 0);

  // Projected annual (based on monthly average * 12)
  const projectedAnnual = totalEarnings * 12;

  // Tax estimates (simplified for self-employed)
  const taxableIncome = Math.max(0, projectedAnnual - TAX_FREE_ALLOWANCE);
  const estimatedIncomeTax = taxableIncome * BASIC_RATE;
  const niableIncome = Math.max(0, projectedAnnual - NI_THRESHOLD);
  const estimatedNI = niableIncome * NI_RATE;
  const totalTaxEstimate = estimatedIncomeTax + estimatedNI;
  const monthlyTaxSetAside = totalTaxEstimate / 12;

  // Weekly stats
  const weeklyStats = useMemo(() => {
    if (!shifts) return [];
    
    const weeks: { week: string; earnings: number; hours: number; shifts: number }[] = [];
    const now = new Date();
    
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekShifts = shifts.filter(s => {
        const shiftDate = new Date(s.scheduled_start);
        return shiftDate >= weekStart && shiftDate <= weekEnd;
      });
      
      weeks.push({
        week: i === 0 ? "This Week" : i === 1 ? "Last Week" : `${i} Weeks Ago`,
        earnings: weekShifts.reduce((sum, s) => sum + (s.total_pay || 0), 0),
        hours: weekShifts.reduce((sum, s) => sum + (s.hours_worked || 0), 0),
        shifts: weekShifts.length,
      });
    }
    
    return weeks;
  }, [shifts]);

  const maxWeeklyEarning = Math.max(...weeklyStats.map(w => w.earnings), 1);

  const getStatusBadge = (status: Shift["status"]) => {
    switch (status) {
      case "checked_out":
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Paid</span>;
      case "pending":
      case "accepted":
        return <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Pending</span>;
      case "checked_in":
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">In Progress</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Earnings Dashboard</h2>
          <p className="text-sm text-zinc-400">Track your income and plan for taxes</p>
        </div>
        <div className="flex gap-2">
          {(["week", "month", "year"] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                timeRange === range
                  ? "bg-shield-500 text-white"
                  : "glass text-zinc-400 hover:text-white"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Earned</p>
          <p className="text-2xl font-bold text-emerald-400">£{periodEarnings.toFixed(2)}</p>
          <p className="text-xs text-zinc-500 mt-1">This {timeRange}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Pending</p>
          <p className="text-2xl font-bold text-amber-400">£{pendingEarnings.toFixed(2)}</p>
          <p className="text-xs text-zinc-500 mt-1">Awaiting payment</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Hours Worked</p>
          <p className="text-2xl font-bold text-blue-400">{periodHours.toFixed(1)}</p>
          <p className="text-xs text-zinc-500 mt-1">This {timeRange}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Rate</p>
          <p className="text-2xl font-bold text-emerald-400">£{avgRate.toFixed(2)}/hr</p>
          <p className="text-xs text-zinc-500 mt-1">Across all shifts</p>
        </div>
      </div>

      {/* Tax Estimate Card */}
      <div className="glass rounded-xl p-6 border border-purple-500/30 bg-purple-500/5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="text-xl">🧮</span> Tax Estimate
            </h3>
            <p className="text-sm text-zinc-400">Based on projected annual income</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-400">Projected Annual</p>
            <p className="text-xl font-bold text-white">£{projectedAnnual.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-zinc-400">Income Tax (20%)</p>
            <p className="text-lg font-semibold text-white">£{estimatedIncomeTax.toFixed(0)}</p>
            <p className="text-xs text-zinc-500">per year</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-zinc-400">National Insurance</p>
            <p className="text-lg font-semibold text-white">£{estimatedNI.toFixed(0)}</p>
            <p className="text-xs text-zinc-500">per year</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-zinc-400">Total Tax</p>
            <p className="text-lg font-semibold text-purple-400">£{totalTaxEstimate.toFixed(0)}</p>
            <p className="text-xs text-zinc-500">per year</p>
          </div>
        </div>

        <div className="bg-purple-500/20 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-purple-300">💡 Recommended Monthly Set-Aside</p>
            <p className="text-xs text-zinc-400">Put this aside each month for your tax bill</p>
          </div>
          <p className="text-2xl font-bold text-white">£{monthlyTaxSetAside.toFixed(0)}</p>
        </div>

        <p className="text-xs text-zinc-500 mt-3">
          * Estimates based on self-employed tax rates. Actual amounts may vary. Consult an accountant for accurate figures.
        </p>
      </div>

      {/* Weekly Trend */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Weekly Earnings</h3>
        <div className="space-y-3">
          {weeklyStats.map((week, idx) => (
            <div key={week.week} className="flex items-center gap-4">
              <span className="w-24 text-sm text-zinc-400">{week.week}</span>
              <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(week.earnings / maxWeeklyEarning) * 100}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="h-full bg-gradient-to-r from-shield-500 to-emerald-500 rounded-lg"
                />
                <span className="absolute inset-y-0 left-3 flex items-center text-sm font-medium text-white">
                  £{week.earnings.toFixed(0)}
                </span>
              </div>
              <div className="w-20 text-right">
                <span className="text-sm text-zinc-500">{week.hours.toFixed(1)}hrs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Earnings */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-white">Recent Shifts</h3>
          <span className="text-sm text-zinc-500">{filteredShifts.length} shifts</span>
        </div>
        <div className="divide-y divide-white/5">
          {filteredShifts.slice(0, 10).map(shift => (
            <div key={shift.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-lg">🛡️</span>
                </div>
                <div>
                  <p className="font-medium text-white">{shift.role}</p>
                  <p className="text-sm text-zinc-400">
                    {new Date(shift.scheduled_start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} • {shift.hours_worked?.toFixed(1) || "0"}hrs @ £{shift.hourly_rate}/hr
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(shift.status)}
                <span className="font-semibold text-white">£{(shift.total_pay || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {filteredShifts.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              No shifts found for this period
            </div>
          )}
        </div>
      </div>

      {/* Export Options */}
      <div className="flex flex-wrap gap-3">
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📊 Export for Accountant
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📥 Download CSV
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          🧾 Generate Invoice
        </motion.button>
      </div>
    </div>
  );
}
