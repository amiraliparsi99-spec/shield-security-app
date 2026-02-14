"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type SpendEntry = {
  id: string;
  date: string;
  eventName: string;
  staffCount: number;
  hours: number;
  totalCost: number;
  status: "paid" | "pending" | "overdue";
};

type MonthlySpend = {
  month: string;
  total: number;
  events: number;
  avgPerEvent: number;
};

const mockSpendHistory: SpendEntry[] = [
  { id: "1", date: "2026-01-26", eventName: "Friday Night", staffCount: 6, hours: 8, totalCost: 864, status: "pending" },
  { id: "2", date: "2026-01-25", eventName: "Thursday Event", staffCount: 4, hours: 6, totalCost: 432, status: "paid" },
  { id: "3", date: "2026-01-24", eventName: "VIP Night", staffCount: 8, hours: 8, totalCost: 1280, status: "paid" },
  { id: "4", date: "2026-01-19", eventName: "Friday Night", staffCount: 6, hours: 8, totalCost: 864, status: "paid" },
  { id: "5", date: "2026-01-18", eventName: "Saturday Special", staffCount: 10, hours: 10, totalCost: 1800, status: "paid" },
  { id: "6", date: "2026-01-12", eventName: "Friday Night", staffCount: 6, hours: 8, totalCost: 864, status: "overdue" },
];

const mockMonthlyData: MonthlySpend[] = [
  { month: "Jan 2026", total: 6104, events: 6, avgPerEvent: 1017 },
  { month: "Dec 2025", total: 8450, events: 8, avgPerEvent: 1056 },
  { month: "Nov 2025", total: 7200, events: 7, avgPerEvent: 1029 },
  { month: "Oct 2025", total: 6800, events: 6, avgPerEvent: 1133 },
];

export function SpendDashboard() {
  const [spendHistory] = useState<SpendEntry[]>(mockSpendHistory);
  const [monthlyData] = useState<MonthlySpend[]>(mockMonthlyData);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const [budget, setBudget] = useState<number>(8000);
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);

  const currentMonthSpend = monthlyData[0]?.total || 0;
  const budgetUsed = Math.round((currentMonthSpend / budget) * 100);
  const pendingAmount = spendHistory.filter(s => s.status === "pending").reduce((sum, s) => sum + s.totalCost, 0);
  const overdueAmount = spendHistory.filter(s => s.status === "overdue").reduce((sum, s) => sum + s.totalCost, 0);

  const getStatusBadge = (status: SpendEntry["status"]) => {
    switch (status) {
      case "paid":
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Paid</span>;
      case "pending":
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Pending</span>;
      case "overdue":
        return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Overdue</span>;
    }
  };

  // Simple bar chart data
  const maxMonthly = Math.max(...monthlyData.map(m => m.total));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Spend Dashboard</h2>
          <p className="text-sm text-zinc-400">Track your security costs</p>
        </div>
        <div className="flex gap-2">
          {(["week", "month", "quarter", "year"] as const).map(range => (
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
          <p className="text-sm text-zinc-400">This Month</p>
          <p className="text-2xl font-bold text-white">£{currentMonthSpend.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">{monthlyData[0]?.events || 0} events</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Per Event</p>
          <p className="text-2xl font-bold text-blue-400">£{monthlyData[0]?.avgPerEvent || 0}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Pending Payment</p>
          <p className="text-2xl font-bold text-amber-400">£{pendingAmount.toLocaleString()}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Overdue</p>
          <p className="text-2xl font-bold text-red-400">£{overdueAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Monthly Budget</h3>
            <p className="text-sm text-zinc-400">
              £{currentMonthSpend.toLocaleString()} of £{budget.toLocaleString()}
            </p>
          </div>
          {showBudgetEdit ? (
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">£</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(parseInt(e.target.value) || 0)}
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white focus:border-shield-500 focus:outline-none transition"
              />
              <button
                onClick={() => setShowBudgetEdit(false)}
                className="text-shield-400 hover:text-shield-300 text-sm"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowBudgetEdit(true)}
              className="text-sm text-zinc-400 hover:text-white transition"
            >
              Edit Budget
            </button>
          )}
        </div>

        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(budgetUsed, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute h-full rounded-full ${
              budgetUsed >= 100
                ? "bg-red-500"
                : budgetUsed >= 80
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
          />
        </div>

        <div className="flex justify-between mt-2 text-sm">
          <span className={`font-medium ${
            budgetUsed >= 100 ? "text-red-400" : budgetUsed >= 80 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {budgetUsed}% used
          </span>
          <span className="text-zinc-400">
            £{Math.max(budget - currentMonthSpend, 0).toLocaleString()} remaining
          </span>
        </div>

        {budgetUsed >= 80 && (
          <div className={`mt-4 p-3 rounded-lg ${budgetUsed >= 100 ? "bg-red-500/10 border border-red-500/30" : "bg-amber-500/10 border border-amber-500/30"}`}>
            <p className={`text-sm font-medium ${budgetUsed >= 100 ? "text-red-400" : "text-amber-400"}`}>
              {budgetUsed >= 100 ? "⚠️ Budget exceeded!" : "⚠️ Approaching budget limit"}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {budgetUsed >= 100
                ? "You've exceeded your monthly security budget."
                : "You're at 80% of your monthly security budget."
              }
            </p>
          </div>
        )}
      </div>

      {/* Monthly Trend Chart */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Monthly Spending Trend</h3>
        <div className="space-y-3">
          {monthlyData.map((month, idx) => (
            <div key={month.month} className="flex items-center gap-4">
              <span className="w-20 text-sm text-zinc-400">{month.month}</span>
              <div className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(month.total / maxMonthly) * 100}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="h-full bg-gradient-to-r from-shield-500 to-cyan-500 rounded-lg"
                />
                <span className="absolute inset-y-0 left-3 flex items-center text-sm font-medium text-white">
                  £{month.total.toLocaleString()}
                </span>
              </div>
              <span className="w-16 text-right text-sm text-zinc-500">{month.events} events</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Recent Events</h3>
        </div>
        <div className="divide-y divide-white/5">
          {spendHistory.map(entry => (
            <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-lg">🛡️</span>
                </div>
                <div>
                  <p className="font-medium text-white">{entry.eventName}</p>
                  <p className="text-sm text-zinc-400">
                    {new Date(entry.date).toLocaleDateString("en-GB")} • {entry.staffCount} staff • {entry.hours}hrs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(entry.status)}
                <span className="font-semibold text-white">£{entry.totalCost}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="flex flex-wrap gap-3">
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📊 Export Report
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📧 Email Summary
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📥 Download Invoices
        </motion.button>
      </div>
    </div>
  );
}
