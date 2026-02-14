"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useWeeklyAvailability, 
  useBlockedDates, 
  useSpecialAvailability,
  useSetWeeklySchedule,
  useAddBlockedDate,
  useRemoveBlockedDate,
  usePersonnelProfile,
  useUpcomingShifts,
  useUpdatePersonnel,
} from "@/hooks";
import { useSupabase } from "@/hooks/useSupabase";
import { addSpecialAvailability, removeSpecialAvailability } from "@/lib/db/availability";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const FULL_DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

type ViewMode = "schedule" | "calendar";

export function AvailabilityManager() {
  const supabase = useSupabase();
  const { data: profile } = usePersonnelProfile();
  const { data: weeklyAvailability, loading: loadingWeekly } = useWeeklyAvailability();
  const { data: blockedDates, loading: loadingBlocked, refetch: refetchBlocked } = useBlockedDates();
  const { data: specialDates, loading: loadingSpecial, refetch: refetchSpecial } = useSpecialAvailability();
  const { data: upcomingShifts } = useUpcomingShifts(10);
  
  const { mutate: setWeeklySchedule, loading: savingSchedule } = useSetWeeklySchedule();
  const { mutate: addBlockedDate, loading: addingBlocked } = useAddBlockedDate();
  const { mutate: removeBlockedDate } = useRemoveBlockedDate();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("schedule");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Local state for editing
  const [schedule, setSchedule] = useState<Record<number, { enabled: boolean; start: string; end: string }>>({
    0: { enabled: false, start: "", end: "" },
    1: { enabled: false, start: "", end: "" },
    2: { enabled: false, start: "", end: "" },
    3: { enabled: false, start: "", end: "" },
    4: { enabled: false, start: "", end: "" },
    5: { enabled: false, start: "", end: "" },
    6: { enabled: false, start: "", end: "" },
  });

  const [showBlockedForm, setShowBlockedForm] = useState(false);
  const [showSpecialForm, setShowSpecialForm] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState({ date: "", reason: "" });
  const [newSpecialDate, setNewSpecialDate] = useState({ date: "", start: "09:00", end: "23:00", note: "" });
  const [hasChanges, setHasChanges] = useState(false);
  const [addingSpecial, setAddingSpecial] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Initialize from database
  useEffect(() => {
    if (weeklyAvailability && weeklyAvailability.length > 0) {
      const newSchedule: typeof schedule = { ...schedule };
      weeklyAvailability.forEach(a => {
        newSchedule[a.day_of_week] = {
          enabled: a.is_available,
          start: a.start_time || "",
          end: a.end_time || "",
        };
      });
      setSchedule(newSchedule);
    }
  }, [weeklyAvailability]);

  const toggleDay = (day: number) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        start: !prev[day].enabled ? "18:00" : prev[day].start,
        end: !prev[day].enabled ? "02:00" : prev[day].end,
      },
    }));
    setHasChanges(true);
  };

  const updateDayTime = (day: number, field: "start" | "end", value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleSaveSchedule = async () => {
    const scheduleArray = Object.entries(schedule).map(([day, data]) => ({
      dayOfWeek: parseInt(day),
      isAvailable: data.enabled,
      startTime: data.enabled ? data.start : undefined,
      endTime: data.enabled ? data.end : undefined,
    }));
    
    await setWeeklySchedule(scheduleArray);
    setHasChanges(false);
  };

  const handleAddBlockedDate = async () => {
    if (newBlockedDate.date) {
      await addBlockedDate({ date: newBlockedDate.date, reason: newBlockedDate.reason });
      setNewBlockedDate({ date: "", reason: "" });
      setShowBlockedForm(false);
      refetchBlocked();
    }
  };

  const handleRemoveBlockedDate = async (id: string) => {
    await removeBlockedDate(id);
    refetchBlocked();
  };

  const handleAddSpecialAvailability = async () => {
    if (newSpecialDate.date && profile?.id) {
      setAddingSpecial(true);
      try {
        await addSpecialAvailability(
          supabase,
          profile.id,
          newSpecialDate.date,
          newSpecialDate.start,
          newSpecialDate.end,
          newSpecialDate.note
        );
        setNewSpecialDate({ date: "", start: "09:00", end: "23:00", note: "" });
        setShowSpecialForm(false);
        refetchSpecial();
      } catch (e) {
        console.error("Error adding special availability:", e);
      }
      setAddingSpecial(false);
    }
  };

  const handleRemoveSpecialAvailability = async (id: string) => {
    try {
      await removeSpecialAvailability(supabase, id);
      refetchSpecial();
    } catch (e) {
      console.error("Error removing special availability:", e);
    }
  };

  // Calendar logic
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  const getDateStatus = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();
    const today = new Date().toISOString().split("T")[0];

    // Check if date is in the past
    const isPast = dateStr < today;

    // Check for shifts on this date
    const hasShift = upcomingShifts?.some(shift => {
      const shiftDate = new Date(shift.scheduled_start).toISOString().split("T")[0];
      return shiftDate === dateStr;
    });

    // Check if date is blocked
    const isBlocked = blockedDates?.some(b => b.date === dateStr);

    // Check for special availability
    const specialAvail = specialDates?.find(s => s.date === dateStr);

    // Check weekly availability
    const weeklyAvail = schedule[dayOfWeek];
    const isRegularlyAvailable = weeklyAvail?.enabled;

    return {
      isPast,
      hasShift,
      isBlocked,
      specialAvail,
      isAvailable: !isBlocked && (specialAvail || isRegularlyAvailable),
      dateStr,
    };
  };

  const handleCalendarDateClick = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    if (dateStr < today) return;
    
    setSelectedDate(dateStr);
    setNewSpecialDate(prev => ({ ...prev, date: dateStr }));
    setNewBlockedDate(prev => ({ ...prev, date: dateStr }));
  };

  const availableDays = Object.values(schedule).filter(d => d.enabled).length;
  const loading = loadingWeekly || loadingBlocked || loadingSpecial;

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
          <h2 className="text-xl font-bold text-white">Availability</h2>
          <p className="text-sm text-zinc-400">Set when you're available for shifts</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{availableDays} days/week</span>
          
          {/* View Mode Toggle */}
          <div className="flex bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode("schedule")}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewMode === "schedule"
                  ? "bg-shield-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewMode === "calendar"
                  ? "bg-shield-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Calendar
            </button>
          </div>
          
          {hasChanges && (
            <motion.button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="bg-shield-500 hover:bg-shield-600 disabled:bg-shield-500/50 text-white px-4 py-2 rounded-xl font-medium transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {savingSchedule ? "Saving..." : "Save Changes"}
            </motion.button>
          )}
        </div>
      </div>

      {/* Quick Status with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 col-span-1 md:col-span-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${profile?.is_available ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`} />
            <span className="text-white font-medium">
              {profile?.is_available ? "Currently Available" : "Currently Unavailable"}
            </span>
          </div>
          <span className="text-sm text-zinc-400">
            {profile?.is_available ? "Venues can book you" : "Not visible to venues"}
          </span>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{upcomingShifts?.length || 0}</div>
          <div className="text-sm text-zinc-400">Upcoming Shifts</div>
        </div>
        
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{specialDates?.length || 0}</div>
          <div className="text-sm text-zinc-400">Special Dates</div>
        </div>
      </div>

      {/* Standby Mode Toggle */}
      <StandbyModeToggle />

      <AnimatePresence mode="wait">
        {viewMode === "schedule" ? (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Weekly Schedule */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Weekly Schedule</h3>
              <p className="text-sm text-zinc-400 mb-6">Set your regular availability for each day of the week</p>

              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 0].map(day => (
                  <div
                    key={day}
                    className={`rounded-xl p-4 transition ${
                      schedule[day].enabled
                        ? "bg-shield-500/10 border border-shield-500/30"
                        : "bg-white/5 border border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Day Toggle */}
                      <button
                        onClick={() => toggleDay(day)}
                        className={`w-20 text-left font-medium transition ${
                          schedule[day].enabled ? "text-white" : "text-zinc-500"
                        }`}
                      >
                        {FULL_DAY_LABELS[day]}
                      </button>

                      {/* Toggle Switch */}
                      <button
                        onClick={() => toggleDay(day)}
                        className={`w-12 h-6 rounded-full transition relative ${
                          schedule[day].enabled ? "bg-shield-500" : "bg-white/20"
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                            schedule[day].enabled ? "left-7" : "left-1"
                          }`}
                        />
                      </button>

                      {/* Time Slots */}
                      {schedule[day].enabled && (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-zinc-400 text-sm">From</span>
                          <input
                            type="time"
                            value={schedule[day].start}
                            onChange={(e) => updateDayTime(day, "start", e.target.value)}
                            className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-shield-500 focus:outline-none transition"
                          />
                          <span className="text-zinc-400 text-sm">to</span>
                          <input
                            type="time"
                            value={schedule[day].end}
                            onChange={(e) => updateDayTime(day, "end", e.target.value)}
                            className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-shield-500 focus:outline-none transition"
                          />
                        </div>
                      )}

                      {!schedule[day].enabled && (
                        <span className="text-sm text-zinc-500">Not available</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Calendar View */}
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {currentMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white transition"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Calendar Legend */}
              <div className="flex flex-wrap gap-4 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500"></div>
                  <span className="text-zinc-400">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></div>
                  <span className="text-zinc-400">Blocked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-shield-500/30 border border-shield-500"></div>
                  <span className="text-zinc-400">Has Shift</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500"></div>
                  <span className="text-zinc-400">Special</span>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-xs text-zinc-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((item, i) => {
                  const status = getDateStatus(item.date);
                  const isToday = item.date.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];
                  const isSelected = selectedDate === status.dateStr;

                  return (
                    <motion.button
                      key={i}
                      onClick={() => handleCalendarDateClick(item.date)}
                      disabled={status.isPast}
                      className={`
                        aspect-square rounded-lg p-1 text-sm relative transition
                        ${!item.isCurrentMonth ? "opacity-30" : ""}
                        ${status.isPast ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:ring-2 hover:ring-shield-500/50"}
                        ${isSelected ? "ring-2 ring-shield-500" : ""}
                        ${status.isBlocked 
                          ? "bg-red-500/20 border border-red-500/50" 
                          : status.specialAvail
                            ? "bg-purple-500/20 border border-purple-500/50"
                            : status.hasShift
                              ? "bg-shield-500/20 border border-shield-500/50"
                              : status.isAvailable
                                ? "bg-emerald-500/10 border border-emerald-500/30"
                                : "bg-white/5 border border-white/5"
                        }
                        ${isToday ? "ring-2 ring-white/50" : ""}
                      `}
                      whileHover={!status.isPast ? { scale: 1.05 } : {}}
                      whileTap={!status.isPast ? { scale: 0.95 } : {}}
                    >
                      <span className={`
                        ${isToday ? "text-white font-bold" : item.isCurrentMonth ? "text-white" : "text-zinc-600"}
                      `}>
                        {item.date.getDate()}
                      </span>
                      {status.hasShift && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-shield-500" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Selected Date Actions */}
              <AnimatePresence>
                {selectedDate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-medium">
                          {new Date(selectedDate).toLocaleDateString("en-GB", { 
                            weekday: "long", 
                            day: "numeric", 
                            month: "long" 
                          })}
                        </p>
                        <p className="text-sm text-zinc-400">
                          {(() => {
                            const status = getDateStatus(new Date(selectedDate));
                            if (status.isBlocked) return "This date is blocked";
                            if (status.specialAvail) return `Special: ${status.specialAvail.start_time} - ${status.specialAvail.end_time}`;
                            if (status.hasShift) return "You have a shift scheduled";
                            if (status.isAvailable) return "Available based on weekly schedule";
                            return "Not available based on weekly schedule";
                          })()}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedDate(null)}
                        className="text-zinc-500 hover:text-white transition"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setNewSpecialDate(prev => ({ ...prev, date: selectedDate }));
                          setShowSpecialForm(true);
                        }}
                        className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 px-3 py-2 rounded-lg text-sm transition"
                      >
                        Add Special Availability
                      </button>
                      <button
                        onClick={() => {
                          setNewBlockedDate(prev => ({ ...prev, date: selectedDate }));
                          setShowBlockedForm(true);
                        }}
                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 px-3 py-2 rounded-lg text-sm transition"
                      >
                        Block This Date
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked Dates */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Blocked Dates</h3>
            <p className="text-sm text-zinc-400">Dates when you're unavailable (holidays, personal, etc.)</p>
          </div>
          <button
            onClick={() => setShowBlockedForm(!showBlockedForm)}
            className="text-sm text-shield-400 hover:text-shield-300 transition"
          >
            + Add Date
          </button>
        </div>

        {showBlockedForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-white/5 rounded-lg p-4 mb-4"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Date</label>
                <input
                  type="date"
                  value={newBlockedDate.date}
                  onChange={(e) => setNewBlockedDate(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={newBlockedDate.reason}
                  onChange={(e) => setNewBlockedDate(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Holiday"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBlockedForm(false)} className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm">
                Cancel
              </button>
              <button 
                onClick={handleAddBlockedDate} 
                disabled={addingBlocked}
                className="bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white px-4 py-1.5 rounded-lg text-sm transition"
              >
                {addingBlocked ? "Adding..." : "Block Date"}
              </button>
            </div>
          </motion.div>
        )}

        {blockedDates && blockedDates.length > 0 ? (
          <div className="space-y-2">
            {blockedDates.map(blocked => (
              <div key={blocked.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-red-400">🚫</span>
                  <div>
                    <p className="text-white font-medium">
                      {new Date(blocked.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {blocked.reason && <p className="text-sm text-zinc-400">{blocked.reason}</p>}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveBlockedDate(blocked.id)}
                  className="text-zinc-500 hover:text-red-400 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No blocked dates</p>
        )}
      </div>

      {/* Special Availability */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Special Availability</h3>
            <p className="text-sm text-zinc-400">One-off dates when you're available outside your regular schedule</p>
          </div>
          <button
            onClick={() => setShowSpecialForm(!showSpecialForm)}
            className="text-sm text-purple-400 hover:text-purple-300 transition"
          >
            + Add Date
          </button>
        </div>

        {showSpecialForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Date</label>
                <input
                  type="date"
                  value={newSpecialDate.date}
                  onChange={(e) => setNewSpecialDate(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Start Time</label>
                <input
                  type="time"
                  value={newSpecialDate.start}
                  onChange={(e) => setNewSpecialDate(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">End Time</label>
                <input
                  type="time"
                  value={newSpecialDate.end}
                  onChange={(e) => setNewSpecialDate(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={newSpecialDate.note}
                  onChange={(e) => setNewSpecialDate(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="e.g. Available for extra work"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSpecialForm(false)} 
                className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddSpecialAvailability} 
                disabled={addingSpecial || !newSpecialDate.date}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white px-4 py-1.5 rounded-lg text-sm transition"
              >
                {addingSpecial ? "Adding..." : "Add Special Date"}
              </button>
            </div>
          </motion.div>
        )}

        {specialDates && specialDates.length > 0 ? (
          <div className="space-y-2">
            {specialDates.map(special => (
              <div key={special.id} className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-purple-400">✨</span>
                  <div>
                    <p className="text-white font-medium">
                      {new Date(special.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {special.start_time} - {special.end_time}
                      {special.note && ` • ${special.note}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSpecialAvailability(special.id)}
                  className="text-zinc-500 hover:text-purple-400 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No special availability dates. Add dates when you can work extra hours.</p>
        )}
      </div>

      {/* Tips */}
      <div className="glass rounded-xl p-4 border border-shield-500/30 bg-shield-500/5">
        <h3 className="font-semibold text-white mb-2">💡 Availability Tips</h3>
        <ul className="text-sm text-zinc-400 space-y-1">
          <li>• Keep your availability up to date to get more job offers</li>
          <li>• Set special availability for dates you can work extra</li>
          <li>• Block dates early if you know you'll be unavailable</li>
          <li>• Venues prefer personnel with consistent availability</li>
          <li>• Enable Standby Mode to get urgent last-minute shifts at surge pay</li>
        </ul>
      </div>
    </div>
  );
}

// =====================================================
// STANDBY MODE TOGGLE
// =====================================================

function StandbyModeToggle() {
  const { data: profile, refetch } = usePersonnelProfile();
  const { mutate: updatePersonnel, loading: saving } = useUpdatePersonnel();
  const [isStandby, setIsStandby] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsStandby(!!(profile as any).is_standby);
    }
  }, [profile]);

  const handleToggle = async () => {
    const newValue = !isStandby;
    setIsStandby(newValue);
    await updatePersonnel({ is_standby: newValue } as any);
    refetch();
  };

  return (
    <div className={`glass rounded-xl p-6 border transition ${
      isStandby
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-white/5"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isStandby ? "bg-amber-500/20" : "bg-white/5"
          }`}>
            <svg className={`w-5 h-5 ${isStandby ? "text-amber-400" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              Standby Mode
              {isStandby && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium animate-pulse">
                  ACTIVE
                </span>
              )}
            </h3>
            <p className="text-sm text-zinc-400 mt-1 max-w-md">
              {isStandby
                ? "You're on standby. You'll receive urgent shift notifications at 1.5x surge pay when a guard doesn't show up nearby."
                : "Enable to get notified for urgent last-minute shifts at premium surge rates (1.5x pay). You'll only be contacted if a guard near you is a no-show."}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${
            isStandby ? "bg-amber-500" : "bg-zinc-700"
          } ${saving ? "opacity-50" : ""}`}
        >
          <motion.div
            className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm"
            animate={{ x: isStandby ? 28 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {isStandby && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 pt-4 border-t border-amber-500/20"
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-amber-400">1.5x</div>
              <div className="text-xs text-zinc-500">Surge Pay</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">5 mi</div>
              <div className="text-xs text-zinc-500">Search Radius</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">~15 min</div>
              <div className="text-xs text-zinc-500">Expected ETA</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
