"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Staff = {
  id: string;
  name: string;
  avatar?: string;
  skills: string[];
  rating: number;
};

type Shift = {
  id: string;
  staffId: string | null;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  rate: number;
  status: "unassigned" | "assigned" | "confirmed";
};

// Mock data - replace with real data
const mockStaff: Staff[] = [
  { id: "1", name: "Marcus Johnson", skills: ["Door", "Event"], rating: 4.9 },
  { id: "2", name: "Sarah Williams", skills: ["CCTV", "Corporate"], rating: 4.8 },
  { id: "3", name: "David Chen", skills: ["Door", "VIP"], rating: 4.7 },
  { id: "4", name: "Emma Thompson", skills: ["Event", "Retail"], rating: 4.9 },
  { id: "5", name: "James Wilson", skills: ["Door", "Event", "VIP"], rating: 4.6 },
];

const mockShifts: Shift[] = [
  { id: "s1", staffId: null, venue: "The Grand Club", date: "2026-01-30", startTime: "21:00", endTime: "03:00", role: "Door", rate: 18, status: "unassigned" },
  { id: "s2", staffId: "1", venue: "Birmingham Arena", date: "2026-01-30", startTime: "18:00", endTime: "23:00", role: "Event", rate: 16, status: "confirmed" },
  { id: "s3", staffId: null, venue: "Pryzm", date: "2026-01-31", startTime: "22:00", endTime: "04:00", role: "Door", rate: 17, status: "unassigned" },
  { id: "s4", staffId: "2", venue: "Mailbox Tower", date: "2026-01-31", startTime: "08:00", endTime: "18:00", role: "Corporate", rate: 15, status: "assigned" },
  { id: "s5", staffId: null, venue: "The Grand Club", date: "2026-02-01", startTime: "21:00", endTime: "03:00", role: "VIP", rate: 22, status: "unassigned" },
];

export function ShiftScheduler() {
  const [shifts, setShifts] = useState<Shift[]>(mockShifts);
  const [staff] = useState<Staff[]>(mockStaff);
  const [draggedStaff, setDraggedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("2026-01-30");
  const [showAddShift, setShowAddShift] = useState(false);

  // Get unique dates
  const dates = [...new Set(shifts.map(s => s.date))].sort();

  // Filter shifts by selected date
  const filteredShifts = shifts.filter(s => s.date === selectedDate);

  const handleDragStart = (staffMember: Staff) => {
    setDraggedStaff(staffMember);
  };

  const handleDragEnd = () => {
    setDraggedStaff(null);
  };

  const handleDrop = (shiftId: string) => {
    if (!draggedStaff) return;
    
    setShifts(prev => prev.map(shift => 
      shift.id === shiftId 
        ? { ...shift, staffId: draggedStaff.id, status: "assigned" as const }
        : shift
    ));
    setDraggedStaff(null);
  };

  const handleUnassign = (shiftId: string) => {
    setShifts(prev => prev.map(shift =>
      shift.id === shiftId
        ? { ...shift, staffId: null, status: "unassigned" as const }
        : shift
    ));
  };

  const getStaffById = (id: string) => staff.find(s => s.id === id);

  const unassignedCount = shifts.filter(s => s.status === "unassigned").length;
  const assignedCount = shifts.filter(s => s.status === "assigned" || s.status === "confirmed").length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Shifts</p>
          <p className="text-2xl font-bold text-white">{shifts.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Unassigned</p>
          <p className="text-2xl font-bold text-amber-400">{unassignedCount}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Assigned</p>
          <p className="text-2xl font-bold text-emerald-400">{assignedCount}</p>
        </div>
      </div>

      {/* Date Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map(date => {
          const dayShifts = shifts.filter(s => s.date === date);
          const unassigned = dayShifts.filter(s => s.status === "unassigned").length;
          const dateObj = new Date(date);
          const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
          const dayNum = dateObj.getDate();
          
          return (
            <motion.button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 rounded-xl px-4 py-3 text-center transition ${
                selectedDate === date
                  ? "bg-shield-500 text-white"
                  : "glass text-zinc-400 hover:text-white"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <p className="text-xs uppercase">{dayName}</p>
              <p className="text-lg font-bold">{dayNum}</p>
              {unassigned > 0 && (
                <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                  {unassigned} open
                </span>
              )}
            </motion.button>
          );
        })}
        <motion.button
          onClick={() => setShowAddShift(true)}
          className="flex-shrink-0 rounded-xl border-2 border-dashed border-zinc-700 px-4 py-3 text-zinc-500 hover:border-shield-500 hover:text-shield-400 transition"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-xs">Add</p>
          <p className="text-lg font-bold">+</p>
        </motion.button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Staff Pool */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Available Staff</h3>
          <div className="space-y-2">
            {staff.map(member => {
              const assignedToday = shifts.some(s => s.date === selectedDate && s.staffId === member.id);
              
              return (
                <motion.div
                  key={member.id}
                  draggable={!assignedToday}
                  onDragStart={() => handleDragStart(member)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-lg p-3 transition cursor-grab active:cursor-grabbing ${
                    assignedToday 
                      ? "bg-zinc-800/50 opacity-50" 
                      : draggedStaff?.id === member.id
                      ? "bg-shield-500/20 border border-shield-500"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                  whileHover={!assignedToday ? { scale: 1.02 } : {}}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-shield-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{member.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-400">★ {member.rating}</span>
                        <span className="text-xs text-zinc-500">
                          {member.skills.slice(0, 2).join(", ")}
                        </span>
                      </div>
                    </div>
                    {assignedToday && (
                      <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                        Assigned
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Shifts Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Shifts for {new Date(selectedDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredShifts.map(shift => {
                const assignedStaff = shift.staffId ? getStaffById(shift.staffId) : null;
                
                return (
                  <motion.div
                    key={shift.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("ring-2", "ring-shield-500");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("ring-2", "ring-shield-500");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("ring-2", "ring-shield-500");
                      handleDrop(shift.id);
                    }}
                    className={`glass rounded-xl p-4 transition ${
                      shift.status === "unassigned" 
                        ? "border-2 border-dashed border-amber-500/30" 
                        : "border border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{shift.venue}</h4>
                        <p className="text-sm text-zinc-400">
                          {shift.startTime} - {shift.endTime}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        shift.status === "confirmed" 
                          ? "bg-emerald-500/20 text-emerald-400"
                          : shift.status === "assigned"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {shift.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs bg-white/10 px-2 py-1 rounded text-zinc-300">
                        {shift.role}
                      </span>
                      <span className="text-xs text-emerald-400">
                        £{shift.rate}/hr
                      </span>
                    </div>

                    {assignedStaff ? (
                      <div className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-shield-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                            {assignedStaff.name.charAt(0)}
                          </div>
                          <span className="text-sm text-white">{assignedStaff.name}</span>
                        </div>
                        <button
                          onClick={() => handleUnassign(shift.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-zinc-700 rounded-lg p-3 text-center">
                        <p className="text-sm text-zinc-500">
                          Drag staff here to assign
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredShifts.length === 0 && (
              <div className="col-span-2 glass rounded-xl p-8 text-center">
                <p className="text-zinc-400">No shifts scheduled for this date</p>
                <button
                  onClick={() => setShowAddShift(true)}
                  className="mt-4 text-shield-400 hover:text-shield-300 text-sm"
                >
                  + Add a shift
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📋 Auto-Assign All
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📤 Export Roster
        </motion.button>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📧 Notify Staff
        </motion.button>
      </div>
    </div>
  );
}
