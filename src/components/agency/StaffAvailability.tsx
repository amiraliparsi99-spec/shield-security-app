"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAgencyStaff, useSearchPersonnel, useAddStaffToAgency, useRemoveStaffFromAgency } from "@/hooks";
import type { Personnel } from "@/lib/database.types";

export function StaffAvailability() {
  const { data: staff, loading, refetch } = useAgencyStaff();
  const { mutate: searchPersonnel, loading: searching } = useSearchPersonnel();
  const { mutate: addStaff, loading: adding } = useAddStaffToAgency();
  const { mutate: removeStaff, loading: removing } = useRemoveStaffFromAgency();

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Personnel[]>([]);
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">("all");

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const results = await searchPersonnel(searchQuery);
    if (results) {
      // Filter out already added staff
      const staffIds = new Set(staff?.map(s => s.id) || []);
      setSearchResults(results.filter(r => !staffIds.has(r.id)));
    }
  };

  const handleAddStaff = async (personnelId: string) => {
    await addStaff({ personnelId });
    setSearchResults(prev => prev.filter(p => p.id !== personnelId));
    refetch();
  };

  const handleRemoveStaff = async (personnelId: string) => {
    if (confirm("Remove this staff member from your agency?")) {
      await removeStaff(personnelId);
      refetch();
    }
  };

  const filteredStaff = staff?.filter(s => {
    if (filter === "available") return s.is_available;
    if (filter === "unavailable") return !s.is_available;
    return true;
  }) || [];

  const availableCount = staff?.filter(s => s.is_available).length || 0;

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
          <h2 className="text-xl font-bold text-white">Staff Availability</h2>
          <p className="text-sm text-zinc-400">
            {availableCount} of {staff?.length || 0} staff available
          </p>
        </div>
        <motion.button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Add Staff
        </motion.button>
      </div>

      {/* Add Staff Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass rounded-xl p-6"
        >
          <h3 className="font-semibold text-white mb-4">Search Personnel</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or city..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
            />
            <button
              onClick={handleSearch}
              disabled={searching || searchQuery.length < 2}
              className="bg-shield-500 hover:bg-shield-600 disabled:bg-shield-500/50 text-white px-4 py-2 rounded-lg transition"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map(person => (
                <div key={person.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                      {person.display_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{person.display_name}</p>
                      <p className="text-sm text-zinc-400">
                        Shield: {person.shield_score} • {person.city}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddStaff(person.id)}
                    disabled={adding}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm transition"
                  >
                    {adding ? "Adding..." : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
            <p className="text-sm text-zinc-500 text-center py-4">No personnel found</p>
          )}
        </motion.div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "available", "unavailable"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f
                ? "bg-shield-500 text-white"
                : "glass text-zinc-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Staff List */}
      <div className="grid gap-4">
        {filteredStaff.map(person => (
          <motion.div
            key={person.id}
            className={`glass rounded-xl p-4 ${
              person.is_available
                ? "border border-emerald-500/30"
                : "border border-white/5 opacity-70"
            }`}
            whileHover={{ scale: 1.005 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                  person.is_available
                    ? "bg-gradient-to-br from-shield-500 to-emerald-500"
                    : "bg-zinc-700"
                }`}>
                  {person.display_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{person.display_name}</p>
                    {person.is_available ? (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        Available
                      </span>
                    ) : (
                      <span className="text-xs bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded-full">
                        Unavailable
                      </span>
                    )}
                    {person.sia_verified && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                        SIA Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
                    <span className="text-shield-400">Shield: {person.shield_score}</span>
                    <span>{person.city}</span>
                    <span>£{person.hourly_rate}/hr</span>
                  </div>
                  {person.skills && person.skills.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {person.skills.slice(0, 3).map(skill => (
                        <span key={skill} className="text-xs bg-white/10 text-zinc-300 px-2 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 glass rounded-lg text-zinc-400 hover:text-white transition" title="Message">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
                <button 
                  onClick={() => handleRemoveStaff(person.id)}
                  disabled={removing}
                  className="p-2 glass rounded-lg text-red-400 hover:text-red-300 transition" 
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredStaff.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-400">
            {filter === "all" 
              ? "No staff members yet. Add your team to get started."
              : `No ${filter} staff found.`
            }
          </p>
        </div>
      )}
    </div>
  );
}
