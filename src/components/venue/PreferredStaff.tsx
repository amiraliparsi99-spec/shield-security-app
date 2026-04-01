"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

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

export function PreferredStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "preferred" | "blocked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: venue } = await supabase.from("venues").select("id").eq("user_id", user.id).single();
      if (!venue) {
        setLoading(false);
        return;
      }
      const { data: bookings } = await supabase.from("bookings").select("id").eq("venue_id", venue.id);
      const bookingIds = (bookings || []).map((b: { id: string }) => b.id);
      const preferredMap: Record<string, { note: string | null }> = {};
      const blockedMap: Record<string, { reason: string | null }> = {};
      const [prefRes, blockRes] = await Promise.all([
        supabase.from("preferred_staff").select("personnel_id, note").eq("venue_id", venue.id),
        supabase.from("blocked_staff").select("personnel_id, reason").eq("venue_id", venue.id),
      ]);
      (prefRes.data || []).forEach((p: { personnel_id: string; note: string | null }) => {
        preferredMap[p.personnel_id] = { note: p.note };
      });
      (blockRes.data || []).forEach((b: { personnel_id: string; reason: string | null }) => {
        blockedMap[b.personnel_id] = { reason: b.reason };
      });
      const shiftCount: Record<string, number> = {};
      const lastWorked: Record<string, string> = {};
      if (bookingIds.length > 0) {
        const { data: shiftsData } = await supabase
          .from("shifts")
          .select("personnel_id, scheduled_start")
          .in("booking_id", bookingIds)
          .not("personnel_id", "is", null);
        (shiftsData || []).forEach((s: { personnel_id: string; scheduled_start: string }) => {
          if (!s.personnel_id) return;
          shiftCount[s.personnel_id] = (shiftCount[s.personnel_id] || 0) + 1;
          if (!lastWorked[s.personnel_id] || s.scheduled_start > lastWorked[s.personnel_id]) {
            lastWorked[s.personnel_id] = s.scheduled_start;
          }
        });
      }
      const allPersonnelIds = new Set<string>([
        ...Object.keys(preferredMap),
        ...Object.keys(blockedMap),
        ...Object.keys(shiftCount),
      ]);
      if (allPersonnelIds.size === 0) {
        setStaff([]);
        setLoading(false);
        return;
      }
      const { data: personnelRows } = await supabase
        .from("personnel")
        .select("id, display_name")
        .in("id", Array.from(allPersonnelIds));
      const { data: reviewRows } = await supabase
        .from("reviews")
        .select("reviewee_id, overall_rating")
        .in("reviewee_id", Array.from(allPersonnelIds));
      const avgByPerson: Record<string, { sum: number; n: number }> = {};
      (reviewRows || []).forEach((r: { reviewee_id: string; overall_rating: number }) => {
        if (!avgByPerson[r.reviewee_id]) avgByPerson[r.reviewee_id] = { sum: 0, n: 0 };
        avgByPerson[r.reviewee_id].sum += r.overall_rating;
        avgByPerson[r.reviewee_id].n += 1;
      });
      const list: StaffMember[] = Array.from(allPersonnelIds).map(pid => {
        const p = (personnelRows || []).find((x: { id: string }) => x.id === pid);
        const name = (p as { display_name?: string } | undefined)?.display_name || "Staff";
        const status: StaffMember["status"] = blockedMap[pid] ? "blocked" : preferredMap[pid] ? "preferred" : "neutral";
        const notes = preferredMap[pid]?.note ?? blockedMap[pid]?.reason ?? undefined;
        const avg = avgByPerson[pid];
        const rating = avg && avg.n > 0 ? Math.round((avg.sum / avg.n) * 10) / 10 : 0;
        return {
          id: pid,
          name,
          rating,
          shiftsWithYou: shiftCount[pid] || 0,
          lastWorked: lastWorked[pid]?.slice(0, 10),
          skills: ["Security"],
          status,
          notes: notes || undefined,
        };
      });
      setStaff(list);
      setLoading(false);
    };
    load();
  }, []);

  const filteredStaff = staff.filter(s => {
    const matchesFilter = filter === "all" || s.status === filter;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const preferredCount = staff.filter(s => s.status === "preferred").length;
  const blockedCount = staff.filter(s => s.status === "blocked").length;

  const updateStatus = async (staffId: string, newStatus: StaffMember["status"]) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: venue } = await supabase.from("venues").select("id").eq("user_id", user.id).single();
    if (!venue) return;
    if (newStatus === "preferred") {
      await supabase.from("blocked_staff").delete().eq("venue_id", venue.id).eq("personnel_id", staffId);
      await supabase.from("preferred_staff").upsert({ venue_id: venue.id, personnel_id: staffId, note: null }, { onConflict: "venue_id,personnel_id" });
    } else if (newStatus === "blocked") {
      await supabase.from("preferred_staff").delete().eq("venue_id", venue.id).eq("personnel_id", staffId);
      await supabase.from("blocked_staff").upsert({ venue_id: venue.id, personnel_id: staffId, reason: null }, { onConflict: "venue_id,personnel_id" });
    } else {
      await supabase.from("preferred_staff").delete().eq("venue_id", venue.id).eq("personnel_id", staffId);
      await supabase.from("blocked_staff").delete().eq("venue_id", venue.id).eq("personnel_id", staffId);
    }
    setStaff(prev => prev.map(s =>
      s.id === staffId ? { ...s, status: newStatus } : s
    ));
  };

  const updateNotes = async (staffId: string, notes: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: venue } = await supabase.from("venues").select("id").eq("user_id", user.id).single();
    if (!venue) return;
    const member = staff.find(s => s.id === staffId);
    if (member?.status === "preferred") {
      await supabase.from("preferred_staff").update({ note: notes || null }).eq("venue_id", venue.id).eq("personnel_id", staffId);
    } else if (member?.status === "blocked") {
      await supabase.from("blocked_staff").update({ reason: notes || null }).eq("venue_id", venue.id).eq("personnel_id", staffId);
    }
    setStaff(prev => prev.map(s =>
      s.id === staffId ? { ...s, notes: notes || undefined } : s
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

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
