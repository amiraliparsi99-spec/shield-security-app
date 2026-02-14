"use client";

import { motion } from "framer-motion";
import { useAgencyStats, useAgencyShifts } from "@/hooks";

export function AgencyAnalytics() {
  const { 
    activeStaff, 
    totalStaff, 
    completedShifts, 
    upcomingShifts, 
    totalRevenue, 
    totalHours, 
    loading 
  } = useAgencyStats();
  const { data: shifts } = useAgencyShifts();

  // Calculate utilization (active staff / total staff)
  const utilization = totalStaff > 0 ? (activeStaff / totalStaff) * 100 : 0;

  // Calculate average rating from shifts
  const avgRating = 4.5; // Would come from reviews in real app

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
      <div>
        <h2 className="text-xl font-bold text-white">Agency Analytics</h2>
        <p className="text-sm text-zinc-400">Performance metrics and insights</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          className="glass rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm text-zinc-400">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-400">£{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">From commissions</p>
        </motion.div>

        <motion.div
          className="glass rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm text-zinc-400">Completed Shifts</p>
          <p className="text-2xl font-bold text-blue-400">{completedShifts}</p>
          <p className="text-xs text-zinc-500 mt-1">{upcomingShifts} upcoming</p>
        </motion.div>

        <motion.div
          className="glass rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-zinc-400">Staff Utilization</p>
          <p className="text-2xl font-bold text-purple-400">{utilization.toFixed(0)}%</p>
          <p className="text-xs text-zinc-500 mt-1">{activeStaff} of {totalStaff} active</p>
        </motion.div>

        <motion.div
          className="glass rounded-xl p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm text-zinc-400">Avg Rating</p>
          <p className="text-2xl font-bold text-amber-400">★ {avgRating.toFixed(1)}</p>
          <p className="text-xs text-zinc-500 mt-1">Client satisfaction</p>
        </motion.div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Hours</p>
          <p className="text-xl font-bold text-white">{totalHours.toFixed(0)}</p>
          <p className="text-xs text-zinc-500">Billed this period</p>
        </div>

        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Active Staff</p>
          <p className="text-xl font-bold text-white">{activeStaff}</p>
          <p className="text-xs text-zinc-500">Currently available</p>
        </div>

        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Revenue/Staff</p>
          <p className="text-xl font-bold text-white">
            £{totalStaff > 0 ? (totalRevenue / totalStaff).toFixed(0) : 0}
          </p>
          <p className="text-xs text-zinc-500">Per team member</p>
        </div>
      </div>

      {/* Recent Shifts */}
      {shifts && shifts.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4">Recent Shifts</h3>
          <div className="space-y-3">
            {shifts.slice(0, 5).map(shift => (
              <div key={shift.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-white font-medium">{shift.role}</p>
                  <p className="text-sm text-zinc-400">
                    {new Date(shift.scheduled_start).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    shift.status === "checked_out" ? "bg-emerald-500/20 text-emerald-400" :
                    shift.status === "accepted" ? "bg-blue-500/20 text-blue-400" :
                    "bg-amber-500/20 text-amber-400"
                  }`}>
                    {shift.status}
                  </span>
                  <p className="text-sm text-emerald-400 mt-1">
                    £{(shift.agency_commission || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Tips */}
      <div className="glass rounded-xl p-4 border border-shield-500/30 bg-shield-500/5">
        <h3 className="font-semibold text-white mb-2">💡 Performance Tips</h3>
        <ul className="text-sm text-zinc-400 space-y-1">
          {utilization < 70 && (
            <li>• Increase staff utilization by finding more clients</li>
          )}
          {totalStaff < 10 && (
            <li>• Grow your team to take on more bookings</li>
          )}
          <li>• Maintain high ratings to attract premium venues</li>
          <li>• Use Shield's instant fill to cover last-minute gaps</li>
        </ul>
      </div>
    </div>
  );
}

// Staff Performance Table Component
interface StaffPerformanceItem {
  id: string;
  name: string;
  role: string;
  shifts: number;
  hours: number;
  rating: number;
  available: boolean;
}

interface StaffPerformanceTableProps {
  staff: StaffPerformanceItem[];
}

export function StaffPerformanceTable({ staff }: StaffPerformanceTableProps) {
  if (!staff || staff.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-zinc-400">No staff performance data available</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">
                Staff Member
              </th>
              <th className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">
                Role
              </th>
              <th className="text-center text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">
                Shifts
              </th>
              <th className="text-center text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">
                Hours
              </th>
              <th className="text-center text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">
                Rating
              </th>
              <th className="text-center text-xs font-medium text-zinc-400 uppercase tracking-wider px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member, index) => (
              <motion.tr
                key={member.id}
                className="border-b border-white/5 hover:bg-white/5 transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-shield-500/20 flex items-center justify-center">
                      <span className="text-shield-400 font-medium text-sm">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-white font-medium">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-zinc-400">{member.role}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-white">{member.shifts}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-white">{member.hours}h</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-amber-400">★ {member.rating.toFixed(1)}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    member.available 
                      ? "bg-emerald-500/20 text-emerald-400" 
                      : "bg-zinc-500/20 text-zinc-400"
                  }`}>
                    {member.available ? "Available" : "Busy"}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
