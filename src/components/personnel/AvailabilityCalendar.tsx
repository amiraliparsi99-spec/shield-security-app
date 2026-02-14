"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

interface AvailabilityCalendarProps {
  userId: string;
  onSave?: (slots: TimeSlot[]) => Promise<void>;
  readOnly?: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function AvailabilityCalendar({ userId, onSave, readOnly = false }: AvailabilityCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(getWeekStart(new Date()));
  const [slots, setSlots] = useState<Map<string, boolean>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Get Monday of the current week
  function getWeekStart(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Get dates for the week
  function getWeekDates() {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);
      return date;
    });
  }

  // Format date key for slot map
  function getSlotKey(date: Date, hour: number) {
    return `${date.toISOString().split("T")[0]}-${hour.toString().padStart(2, "0")}`;
  }

  // Navigate weeks
  function prevWeek() {
    const newDate = new Date(currentWeek);
    newDate.setDate(currentWeek.getDate() - 7);
    setCurrentWeek(newDate);
  }

  function nextWeek() {
    const newDate = new Date(currentWeek);
    newDate.setDate(currentWeek.getDate() + 7);
    setCurrentWeek(newDate);
  }

  function goToToday() {
    setCurrentWeek(getWeekStart(new Date()));
  }

  // Handle slot toggle
  function handleSlotMouseDown(key: string) {
    if (readOnly) return;
    setIsDragging(true);
    const newValue = !slots.get(key);
    setDragValue(newValue);
    setSlots(new Map(slots.set(key, newValue)));
  }

  function handleSlotMouseEnter(key: string) {
    if (!isDragging || readOnly) return;
    setSlots(new Map(slots.set(key, dragValue)));
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  // Quick actions
  function setAllAvailable() {
    const newSlots = new Map<string, boolean>();
    const dates = getWeekDates();
    dates.forEach(date => {
      HOURS.forEach(hour => {
        newSlots.set(getSlotKey(date, hour), true);
      });
    });
    setSlots(newSlots);
  }

  function clearAll() {
    setSlots(new Map());
  }

  function setWorkingHours() {
    const newSlots = new Map<string, boolean>();
    const dates = getWeekDates();
    dates.forEach((date, dayIndex) => {
      // Mon-Fri 9-17
      if (dayIndex < 5) {
        for (let hour = 9; hour < 17; hour++) {
          newSlots.set(getSlotKey(date, hour), true);
        }
      }
    });
    setSlots(newSlots);
  }

  function setEvenings() {
    const newSlots = new Map<string, boolean>();
    const dates = getWeekDates();
    dates.forEach(date => {
      // 18-02 (evening/night shifts)
      for (let hour = 18; hour < 24; hour++) {
        newSlots.set(getSlotKey(date, hour), true);
      }
      for (let hour = 0; hour < 2; hour++) {
        newSlots.set(getSlotKey(date, hour), true);
      }
    });
    setSlots(newSlots);
  }

  // Save availability
  async function handleSave() {
    if (!onSave) return;
    setIsSaving(true);
    
    const timeSlots: TimeSlot[] = [];
    slots.forEach((isAvailable, key) => {
      if (isAvailable) {
        const [date, hour] = key.split("-");
        timeSlots.push({
          id: key,
          date: `${date}T00:00:00Z`,
          start_time: `${hour}:00`,
          end_time: `${String(parseInt(hour) + 1).padStart(2, "0")}:00`,
          is_available: true,
        });
      }
    });

    try {
      await onSave(timeSlots);
    } finally {
      setIsSaving(false);
    }
  }

  const weekDates = getWeekDates();
  const isCurrentWeek = currentWeek.getTime() === getWeekStart(new Date()).getTime();

  return (
    <div 
      className="glass rounded-2xl p-6"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Availability</h2>
          <p className="text-sm text-zinc-400">
            {currentWeek.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - {
              weekDates[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {!isCurrentWeek && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm text-shield-500 hover:text-shield-400 transition"
            >
              Today
            </button>
          )}
          
          <button
            onClick={nextWeek}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={setAllAvailable}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
          >
            All Available
          </button>
          <button
            onClick={setWorkingHours}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
          >
            Working Hours (9-5)
          </button>
          <button
            onClick={setEvenings}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition"
          >
            Evenings/Nights
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Days header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
            <div /> {/* Empty corner */}
            {weekDates.map((date, i) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div 
                  key={i} 
                  className={`text-center py-2 rounded-lg ${isToday ? 'bg-shield-500/20' : ''}`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-shield-400' : 'text-zinc-500'}`}>
                    {DAYS[i]}
                  </div>
                  <div className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-zinc-300'}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 max-h-[400px] overflow-y-auto">
            {HOURS.map(hour => (
              <div key={hour} className="contents">
                <div className="text-xs text-zinc-500 py-1 pr-2 text-right">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDates.map((date, dayIndex) => {
                  const key = getSlotKey(date, hour);
                  const isAvailable = slots.get(key) || false;
                  const isPast = date < new Date() && hour < new Date().getHours();
                  
                  return (
                    <motion.div
                      key={key}
                      className={`
                        h-6 rounded cursor-pointer transition-colors select-none
                        ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                        ${isAvailable 
                          ? 'bg-emerald-500/40 hover:bg-emerald-500/60' 
                          : 'bg-zinc-800/50 hover:bg-zinc-700/50'
                        }
                      `}
                      onMouseDown={() => !isPast && handleSlotMouseDown(key)}
                      onMouseEnter={() => !isPast && handleSlotMouseEnter(key)}
                      whileHover={!isPast ? { scale: 1.05 } : {}}
                      whileTap={!isPast ? { scale: 0.95 } : {}}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500/40" />
          <span className="text-xs text-zinc-400">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-zinc-800/50" />
          <span className="text-xs text-zinc-400">Unavailable</span>
        </div>
        {!readOnly && (
          <p className="text-xs text-zinc-500 ml-auto">
            Click and drag to select multiple slots
          </p>
        )}
      </div>

      {/* Save Button */}
      {!readOnly && onSave && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-shield-500 hover:bg-shield-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      )}
    </div>
  );
}

export default AvailabilityCalendar;
