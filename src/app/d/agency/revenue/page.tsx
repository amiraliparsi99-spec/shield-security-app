"use client";

import { useState, useEffect } from "react";
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
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface RevenueData {
  total: number;
  thisMonth: number;
  lastMonth: number;
  growth: number;
  byVenue: { name: string; amount: number }[];
  byMonth: { month: string; amount: number }[];
  byStaff: { name: string; amount: number }[];
}

export default function RevenueAnalyticsPage() {
  const supabase = useSupabase();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year">("month");

  useEffect(() => {
    loadRevenueData();
  }, [timeRange]);

  const loadRevenueData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("owner_id", profile.id)
        .single();

      if (!agency) return;

      // Get completed bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select(`
          id,
          start,
          end,
          rate,
          guards_count,
          venues (name)
        `)
        .eq("provider_type", "agency")
        .eq("provider_id", agency.id)
        .eq("status", "completed")
        .order("end", { ascending: false });

      if (!bookings) return;

      // Calculate revenue
      let total = 0;
      let thisMonth = 0;
      let lastMonth = 0;
      const byVenue = new Map<string, number>();
      const byMonth = new Map<string, number>();

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      for (const booking of bookings) {
        const hours = (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / (1000 * 60 * 60);
        const revenue = booking.rate * hours * booking.guards_count;
        total += revenue;

        const bookingDate = new Date(booking.end);
        if (bookingDate >= thisMonthStart) {
          thisMonth += revenue;
        } else if (bookingDate >= lastMonthStart && bookingDate < thisMonthStart) {
          lastMonth += revenue;
        }

        // By venue
        const venueName = (booking.venues as any)?.name || "Unknown";
        byVenue.set(venueName, (byVenue.get(venueName) || 0) + revenue);

        // By month
        const monthKey = bookingDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
        byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + revenue);
      }

      const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

      setData({
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
        byStaff: [], // Placeholder
      });
    } catch (error) {
      console.error("Error loading revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="glass rounded-xl p-12 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No Revenue Data</h3>
          <p className="text-sm text-zinc-500">Complete bookings to see revenue analytics</p>
        </div>
      </div>
    );
  }

  const lineChartData = {
    labels: data.byMonth.map((d) => d.month),
    datasets: [
      {
        label: "Revenue",
        data: data.byMonth.map((d) => d.amount / 100),
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
        label: "Revenue by Venue",
        data: data.byVenue.map((d) => d.amount / 100),
        backgroundColor: "#14b8a6",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        ticks: { color: "#a1a1aa" },
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
            Track your agency's revenue performance
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

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">
            £{(data.total / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">This Month</p>
          <p className="text-2xl font-bold text-white">
            £{(data.thisMonth / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">Last Month</p>
          <p className="text-2xl font-bold text-white">
            £{(data.lastMonth / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-6"
        >
          <p className="text-sm text-zinc-400 mb-1">Growth</p>
          <p className={`text-2xl font-bold ${data.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {data.growth >= 0 ? "+" : ""}{data.growth.toFixed(1)}%
          </p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Over Time</h3>
          <div className="h-64">
            <Line data={lineChartData} options={chartOptions} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Top Venues</h3>
          <div className="h-64">
            <Bar data={barChartData} options={chartOptions} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
