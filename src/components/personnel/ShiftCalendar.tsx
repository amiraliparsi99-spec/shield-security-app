"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Shift = {
  id: string;
  date: string;
  venue: string;
  startTime: string;
  endTime: string;
  role: string;
  rate: number;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  checkedIn?: boolean;
};

const mockShifts: Shift[] = [
  { id: "1", date: "2026-01-30", venue: "The Grand Club", startTime: "21:00", endTime: "03:00", role: "Door Security", rate: 18, status: "confirmed" },
  { id: "2", date: "2026-01-31", venue: "Birmingham Arena", startTime: "18:00", endTime: "23:00", role: "Event Security", rate: 16, status: "confirmed" },
  { id: "3", date: "2026-02-01", venue: "Pryzm", startTime: "22:00", endTime: "04:00", role: "Door Security", rate: 17, status: "pending" },
  { id: "4", date: "2026-02-07", venue: "The Grand Club", startTime: "21:00", endTime: "03:00", role: "Door Security", rate: 18, status: "confirmed" },
  { id: "5", date: "2026-01-26", venue: "The Grand Club", startTime: "21:00", endTime: "03:00", role: "Door Security", rate: 18, status: "completed", checkedIn: true },
  { id: "6", date: "2026-01-25", venue: "Mailbox Tower", startTime: "08:00", endTime: "18:00", role: "Corporate Security", rate: 15, status: "completed", checkedIn: true },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ShiftCalendar() {
  const [shifts] = useState<Shift[]>(mockShifts);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)); // January 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  // Calculate calendar data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = (firstDay.getDay() + 6) % 7; // Adjust for Monday start
  const daysInMonth = lastDay.getDate();

  // Get shifts for a specific date
  const getShiftsForDate = (date: string) => shifts.filter(s => s.date === date);

  // Calculate weekly hours
  const thisWeekShifts = shifts.filter(s => {
    const shiftDate = new Date(s.date);
    const now = new Date("2026-01-30"); // Today for demo
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return shiftDate >= startOfWeek && shiftDate <= endOfWeek;
  });

  const thisWeekHours = thisWeekShifts.reduce((sum, s) => {
    const [startH] = s.startTime.split(":").map(Number);
    const [endH] = s.endTime.split(":").map(Number);
    let hours = endH - startH;
    if (hours <= 0) hours += 24;
    return sum + hours;
  }, 0);

  const upcomingShifts = shifts.filter(s => s.status === "confirmed" || s.status === "pending").length;
  const totalEarningsThisMonth = shifts
    .filter(s => s.date.startsWith("2026-01"))
    .reduce((sum, s) => {
      const [startH] = s.startTime.split(":").map(Number);
      const [endH] = s.endTime.split(":").map(Number);
      let hours = endH - startH;
      if (hours <= 0) hours += 24;
      return sum + (hours * s.rate);
    }, 0);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getStatusColor = (status: Shift["status"]) => {
    switch (status) {
      case "confirmed": return "bg-emerald-500";
      case "pending": return "bg-amber-500";
      case "completed": return "bg-blue-500";
      case "cancelled": return "bg-red-500";
    }
  };

  const renderCalendarDays = () => {
    const days = [];
    
    // Empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-white/[0.02]" />);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayShifts = getShiftsForDate(dateStr);
      const isToday = dateStr === "2026-01-30"; // Today for demo
      const isSelected = selectedDate === dateStr;
      
      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(dateStr)}
          className={`h-24 p-1 border border-white/5 cursor-pointer transition ${
            isToday ? "bg-shield-500/10 border-shield-500/30" :
            isSelected ? "bg-white/10" :
            "hover:bg-white/5"
          }`}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? "text-shield-400" : "text-zinc-400"}`}>
            {day}
          </div>
          <div className="space-y-1">
            {dayShifts.slice(0, 2).map(shift => (
              <div
                key={shift.id}
                className={`text-[10px] px-1 py-0.5 rounded truncate ${getStatusColor(shift.status)} text-white`}
              >
                {shift.startTime} {shift.venue.split(" ")[0]}
              </div>
            ))}
            {dayShifts.length > 2 && (
              <div className="text-[10px] text-zinc-500">+{dayShifts.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Shift Calendar</h2>
          <p className="text-sm text-zinc-400">View and manage your upcoming shifts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              viewMode === "week" ? "bg-shield-500 text-white" : "glass text-zinc-400 hover:text-white"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              viewMode === "month" ? "bg-shield-500 text-white" : "glass text-zinc-400 hover:text-white"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">This Week</p>
          <p className="text-2xl font-bold text-white">{thisWeekHours}hrs</p>
          <p className="text-xs text-zinc-500">{thisWeekShifts.length} shifts</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Upcoming</p>
          <p className="text-2xl font-bold text-emerald-400">{upcomingShifts}</p>
          <p className="text-xs text-zinc-500">confirmed shifts</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">This Month</p>
          <p className="text-2xl font-bold text-blue-400">£{totalEarningsThisMonth}</p>
          <p className="text-xs text-zinc-500">projected earnings</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Hours Target</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-white">{thisWeekHours}</p>
            <p className="text-lg text-zinc-500">/40</p>
          </div>
          <div className="h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-shield-500 rounded-full"
              style={{ width: `${Math.min((thisWeekHours / 40) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Fatigue Warning */}
      {thisWeekHours > 48 && (
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-white">High hours this week</p>
              <p className="text-sm text-zinc-400">
                You've worked {thisWeekHours} hours. Consider taking a break to avoid fatigue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Month Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-white">
            {MONTHS[month]} {year}
          </h3>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAYS.map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-zinc-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {renderCalendarDays()}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <h3 className="font-semibold text-white mb-3">
            {new Date(selectedDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          {getShiftsForDate(selectedDate).length > 0 ? (
            <div className="space-y-3">
              {getShiftsForDate(selectedDate).map(shift => (
                <div key={shift.id} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{shift.venue}</p>
                    <p className="text-sm text-zinc-400">
                      {shift.startTime} - {shift.endTime} • {shift.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      shift.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                      shift.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {shift.status}
                    </span>
                    <p className="text-sm text-emerald-400 mt-1">£{shift.rate}/hr</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500">No shifts scheduled</p>
          )}
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded" />
          <span className="text-zinc-400">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded" />
          <span className="text-zinc-400">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-zinc-400">Completed</span>
        </div>
      </div>
    </div>
  );
}
