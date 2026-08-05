"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { loadAgencyRevenue, type RevenueData } from "@/lib/agency/revenue";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

function formatPounds(amount: number): string {
  return amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RevenueAnalyticsPage() {
  const supabase = useSupabase();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year">("month");

  const loadRevenueData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setData(null);
        setError("Sign in to view revenue analytics.");
        return;
      }

      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!agency) {
        setData(null);
        setError("No agency profile found for this account.");
        return;
      }

      const revenue = await loadAgencyRevenue(supabase, agency.id, timeRange);
      if (!revenue) {
        setData(null);
        setError("Could not load revenue data. Please try again.");
        return;
      }

      setData(revenue);
    } catch (err) {
      console.error("Error loading revenue data:", err);
      setData(null);
      setError("Something went wrong loading revenue data.");
    } finally {
      setLoading(false);
    }
  }, [supabase, timeRange]);

  useEffect(() => {
    loadRevenueData();
  }, [loadRevenueData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>
          <p className="text-sm text-zinc-400 mt-1">Track your agency&apos;s revenue performance</p>
        </header>
        <div className="glass rounded-xl p-12 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No Revenue Data</h3>
          <p className="text-sm text-zinc-500">{error ?? "Complete shifts to see revenue analytics."}</p>
        </div>
      </div>
    );
  }

  const hasRevenue = data.shiftCount > 0 && data.total > 0;

  const lineChartData = {
    labels: data.byMonth.map((d) => d.month),
    datasets: [
      {
        label: "Revenue (£)",
        data: data.byMonth.map((d) => d.amount),
        borderColor: "#14b8a6",
        backgroundColor: "rgba(20, 184, 166, 0.1)",
        tension: 0.4,
      },
    ],
  };

  const barChartData = {
    labels: data.byVenue.map((d) => d.name),
    datasets: [
      {
        label: "Revenue (£)",
        data: data.byVenue.map((d) => d.amount),
        backgroundColor: "#14b8a6",
      },
    ],
  };

  const staffChartData = {
    labels: data.byStaff.map((d) => d.name),
    datasets: [
      {
        label: "Revenue (£)",
        data: data.byStaff.map((d) => d.amount),
        backgroundColor: "#6366f1",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        ticks: { color: "#a1a1aa", callback: (v: number | string) => `£${v}` },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      x: {
        ticks: { color: "#a1a1aa" },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>
          <p className="text-sm text-zinc-400 mt-1">
            From {data.shiftCount} completed shift{data.shiftCount === 1 ? "" : "s"} ({timeRange})
          </p>
        </div>
        <div className="flex gap-2">
          {(["month", "quarter", "year"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === range
                  ? "bg-shield-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {!hasRevenue ? (
        <div className="glass rounded-xl p-12 text-center mb-6">
          <h3 className="text-lg font-medium text-white mb-2">No revenue in this period</h3>
          <p className="text-sm text-zinc-500">
            Revenue appears here once shifts are checked out with commission or pay recorded.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6">
          <p className="text-sm text-zinc-400 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">£{formatPounds(data.total)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">This Month</p>
          <p className="text-2xl font-bold text-white">£{formatPounds(data.thisMonth)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">Last Month</p>
          <p className="text-2xl font-bold text-white">£{formatPounds(data.lastMonth)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">Growth</p>
          <p className={`text-2xl font-bold ${data.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {data.growth >= 0 ? "+" : ""}
            {data.growth.toFixed(1)}%
          </p>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Over Time</h3>
          <div className="h-64">
            {data.byMonth.length > 0 ? (
              <Line data={lineChartData} options={chartOptions} />
            ) : (
              <p className="text-sm text-zinc-500">No monthly breakdown yet.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Top Venues / Sites</h3>
          <div className="h-64">
            {data.byVenue.length > 0 ? (
              <Bar data={barChartData} options={chartOptions} />
            ) : (
              <p className="text-sm text-zinc-500">No venue breakdown yet.</p>
            )}
          </div>
        </motion.div>

        {data.byStaff.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6 lg:col-span-2"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Revenue by Staff</h3>
            <div className="h-64">
              <Bar data={staffChartData} options={chartOptions} />
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
