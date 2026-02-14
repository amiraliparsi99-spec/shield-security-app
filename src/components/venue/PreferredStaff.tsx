"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type StaffMember = {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  shiftsWithYou: number;
  lastWorked?: string;
  skills: string[];
  status: "preferred" | "neutral" | "blocked";
  notes?: string;
};

const mockStaff: StaffMember[] = [
  {
    id: "1",
    name: "Marcus Johnson",
    rating: 4.9,
    shiftsWithYou: 48,
    lastWorked: "2026-01-26",
    skills: ["Door", "VIP", "Event"],
    status: "preferred",
    notes: "Excellent with difficult customers. Always professional.",
  },
  {
    id: "2",
    name: "Sarah Williams",
    rating: 4.8,
    shiftsWithYou: 32,
    lastWorked: "2026-01-25",
    skills: ["Floor", "CCTV"],
    status: "preferred",
    notes: "Great attention to detail. Reliable.",
  },
  {
    id: "3",
    name: "David Chen",
    rating: 4.7,
    shiftsWithYou: 24,
    lastWorked: "2026-01-24",
    skills: ["Door", "Event"],
    status: "neutral",
  },
  {
    id: "4",
    name: "Emma Thompson",
    rating: 4.9,
    shiftsWithYou: 56,
    lastWorked: "2026-01-26",
    skills: ["VIP", "Corporate"],
    status: "preferred",
    notes: "Our go-to for VIP events.",
  },
  {
    id: "5",
    name: "James Wilson",
    rating: 3.2,
    shiftsWithYou: 8,
    lastWorked: "2026-01-10",
    skills: ["Door"],
    status: "blocked",
    notes: "Late twice, unprofessional behavior.",
  },
];

export function PreferredStaff() {
  const [staff, setStaff] = useState<StaffMember[]>(mockStaff);
  const [filter, setFilter] = useState<"all" | "preferred" | "blocked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const filteredStaff = staff.filter(s => {
    const matchesFilter = filter === "all" || s.status === filter;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const preferredCount = staff.filter(s => s.status === "preferred").length;
  const blockedCount = staff.filter(s => s.status === "blocked").length;

  const updateStatus = (staffId: string, newStatus: StaffMember["status"]) => {
    setStaff(prev => prev.map(s =>
      s.id === staffId ? { ...s, status: newStatus } : s
    ));
  };

  const updateNotes = (staffId: string, notes: string) => {
    setStaff(prev => prev.map(s =>
      s.id === staffId ? { ...s, notes } : s
    ));
    setEditingStaff(null);
  };

  const getStatusBadge = (status: StaffMember["status"]) => {
    switch (status) {
      case "preferred":
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">⭐ Preferred</span>;
      case "blocked":
        return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">🚫 Blocked</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Staff Preferences</h2>
          <p className="text-sm text-zinc-400">Build your dream team - mark favorites & blocks</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Staff Worked</p>
          <p className="text-2xl font-bold text-white">{staff.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Preferred</p>
          <p className="text-2xl font-bold text-emerald-400">{preferredCount}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Blocked</p>
          <p className="text-2xl font-bold text-red-400">{blockedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {(["all", "preferred", "blocked"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f
                  ? "bg-shield-500 text-white"
                  : "glass text-zinc-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All Staff" : f === "preferred" ? "⭐ Preferred" : "🚫 Blocked"}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
            placeholder="Search staff..."
          />
        </div>
      </div>

      {/* Info Banner */}
      <div className="glass rounded-xl p-4 border border-shield-500/30 bg-shield-500/5">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <p className="font-medium text-white">How it works</p>
            <p className="text-sm text-zinc-400">
              When you book security, preferred staff are automatically requested first. 
              Blocked staff will never be assigned to your venue.
            </p>
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="space-y-4">
        {filteredStaff.map(member => (
          <motion.div
            key={member.id}
            layout
            className={`glass rounded-xl p-4 transition ${
              member.status === "blocked" ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold ${
                member.status === "preferred"
                  ? "bg-gradient-to-br from-emerald-500 to-shield-500"
                  : member.status === "blocked"
                  ? "bg-gradient-to-br from-red-500 to-red-700"
                  : "bg-gradient-to-br from-zinc-600 to-zinc-700"
              }`}>
                {member.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white">{member.name}</h3>
                  {getStatusBadge(member.status)}
                </div>
                
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-amber-400">★ {member.rating}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-zinc-400">{member.shiftsWithYou} shifts at your venue</span>
                  {member.lastWorked && (
                    <>
                      <span className="text-zinc-500">|</span>
                      <span className="text-zinc-400">
                        Last: {new Date(member.lastWorked).toLocaleDateString("en-GB")}
                      </span>
                    </>
                  )}
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {member.skills.map(skill => (
                    <span key={skill} className="text-xs bg-white/10 text-zinc-300 px-2 py-0.5 rounded">
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Notes */}
                {member.notes && (
                  <p className="text-sm text-zinc-500 mt-2 italic">"{member.notes}"</p>
                )}

                {/* Edit Notes */}
                {editingStaff?.id === member.id && (
                  <div className="mt-3">
                    <textarea
                      defaultValue={member.notes}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition h-20 resize-none"
                      placeholder="Add notes about this staff member..."
                      autoFocus
                      onBlur={(e) => updateNotes(member.id, e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {member.status !== "preferred" && (
                  <motion.button
                    onClick={() => updateStatus(member.id, "preferred")}
                    className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg transition"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ⭐ Add to Preferred
                  </motion.button>
                )}
                {member.status === "preferred" && (
                  <motion.button
                    onClick={() => updateStatus(member.id, "neutral")}
                    className="text-xs bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 px-3 py-1.5 rounded-lg transition"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Remove Preferred
                  </motion.button>
                )}
                {member.status !== "blocked" && (
                  <motion.button
                    onClick={() => updateStatus(member.id, "blocked")}
                    className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    🚫 Block
                  </motion.button>
                )}
                {member.status === "blocked" && (
                  <motion.button
                    onClick={() => updateStatus(member.id, "neutral")}
                    className="text-xs bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 px-3 py-1.5 rounded-lg transition"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Unblock
                  </motion.button>
                )}
                <button
                  onClick={() => setEditingStaff(editingStaff?.id === member.id ? null : member)}
                  className="text-xs text-zinc-400 hover:text-white transition px-3 py-1.5"
                >
                  ✏️ {member.notes ? "Edit" : "Add"} Notes
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-400">No staff found matching your filters</p>
        </div>
      )}
    </div>
  );
}
