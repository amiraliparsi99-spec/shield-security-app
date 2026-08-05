"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { isClaimableOnMarketplace, isActiveUrgentCover, remainingMinutes } from "@/lib/shifts/marketplace";

type Job = {
  id: string;
  venue: string;
  venueRating: number;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  rate: number;
  distance: number;
  urgent: boolean;
  description: string;
  requirements: string[];
  postedAt: string;
  applicants: number;
  matchScore: number;
};

const formatTime = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export function JobFinder() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select(`
          id,
          role,
          hourly_rate,
          scheduled_start,
          scheduled_end,
          status,
          personnel_id,
          is_urgent,
          dispatcher_status,
          cover_search_wave,
          created_at,
          booking:bookings(id, event_name, event_date, venue_id, notes, status)
        `)
        .is("personnel_id", null)
        .eq("status", "pending")
        .gte("scheduled_end", new Date().toISOString())
        .limit(50);
      const allowed = (shiftsData || []).filter((s: any) => {
        const bookingStatus = s.booking?.status;
        if (bookingStatus === "cancelled") return false;
        return isClaimableOnMarketplace(
          {
            status: s.status,
            personnel_id: s.personnel_id,
            scheduled_start: s.scheduled_start,
            scheduled_end: s.scheduled_end,
            is_urgent: s.is_urgent,
            dispatcher_status: s.dispatcher_status,
            cover_search_wave: s.cover_search_wave,
          },
          { bookingStatus },
        );
      });
      const venueIds = [...new Set(allowed.map((s: any) => s.booking?.venue_id).filter(Boolean))];
      let venueMap: Record<string, { name: string }> = {};
      if (venueIds.length > 0) {
        const { data: venues } = await supabase.from("venues").select("id, name").in("id", venueIds);
        (venues || []).forEach((v: { id: string; name: string }) => {
          venueMap[v.id] = { name: v.name };
        });
      }
      const list: Job[] = allowed.map((s: any) => {
        const booking = s.booking;
        const venueName = booking?.venue_id ? (venueMap[booking.venue_id]?.name ?? "Venue") : "Venue";
        return {
          id: s.id,
          venue: venueName,
          venueRating: 4.5,
          date: booking?.event_date?.slice(0, 10) || s.scheduled_start?.slice(0, 10) || "",
          startTime: formatTime(s.scheduled_start || ""),
          endTime: formatTime(s.scheduled_end || ""),
          role: s.role || "Security",
          rate: s.hourly_rate ?? 0,
          distance: 0,
          urgent: !!s.is_urgent,
          description: booking?.notes || "Security shift.",
          requirements: ["SIA Door Supervisor"],
          postedAt: s.created_at || new Date().toISOString(),
          applicants: 0,
          matchScore: 80,
        };
      });
      setJobs(list);
      setJobsLoading(false);
    };
    load();
  }, []);
  const [filters, setFilters] = useState({
    role: "all",
    distance: 10,
    minRate: 0,
    urgentOnly: false,
  });
  const [sortBy, setSortBy] = useState<"match" | "rate" | "date" | "distance">("match");
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredJobs = jobs
    .filter(job => {
      if (filters.role !== "all" && job.role !== filters.role) return false;
      if (job.distance > filters.distance) return false;
      if (job.rate < filters.minRate) return false;
      if (filters.urgentOnly && !job.urgent) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "match": return b.matchScore - a.matchScore;
        case "rate": return b.rate - a.rate;
        case "date": return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "distance": return a.distance - b.distance;
        default: return 0;
      }
    });

  const handleApply = (jobId: string) => {
    setAppliedJobs(prev => [...prev, jobId]);
    // In real app, would call API
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const uniqueRoles = [...new Set(jobs.map(j => j.role))];

  if (jobsLoading) {
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
          <h2 className="text-xl font-bold text-white">Find Shifts</h2>
          <p className="text-sm text-zinc-400">Jobs matched to your skills and preferences</p>
        </div>
        <span className="text-sm text-zinc-500">{filteredJobs.length} jobs available</span>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Role</label>
            <select
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition"
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Max Distance</label>
            <select
              value={filters.distance}
              onChange={(e) => setFilters(prev => ({ ...prev, distance: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition"
            >
              <option value={5}>5 miles</option>
              <option value={10}>10 miles</option>
              <option value={20}>20 miles</option>
              <option value={50}>50 miles</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Min Rate</label>
            <select
              value={filters.minRate}
              onChange={(e) => setFilters(prev => ({ ...prev, minRate: Number(e.target.value) }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition"
            >
              <option value={0}>Any rate</option>
              <option value={15}>£15+/hr</option>
              <option value={17}>£17+/hr</option>
              <option value={20}>£20+/hr</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition"
            >
              <option value="match">Best Match</option>
              <option value="rate">Highest Rate</option>
              <option value="date">Soonest</option>
              <option value="distance">Nearest</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.urgentOnly}
                onChange={(e) => setFilters(prev => ({ ...prev, urgentOnly: e.target.checked }))}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-shield-500 focus:ring-shield-500"
              />
              <span className="text-sm text-white">Urgent only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-4">
        {filteredJobs.map(job => (
          <motion.div
            key={job.id}
            layout
            className={`glass rounded-xl p-4 cursor-pointer transition ${
              job.urgent ? "border border-amber-500/30" : ""
            }`}
            onClick={() => setSelectedJob(job)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {job.urgent && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">
                      🔥 Urgent
                    </span>
                  )}
                  <span className="text-xs bg-shield-500/20 text-shield-400 px-2 py-0.5 rounded-full">
                    {job.matchScore}% match
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white">{job.venue}</h3>
                <div className="flex items-center gap-2 text-sm text-zinc-400 mt-1">
                  <span className="text-amber-400">★ {job.venueRating}</span>
                  <span>•</span>
                  <span>{job.distance} miles away</span>
                  <span>•</span>
                  <span>{timeAgo(job.postedAt)}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-white">
                    📅 {new Date(job.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="text-zinc-400">
                    🕐 {job.startTime} - {job.endTime}
                  </span>
                  <span className="text-zinc-400">{job.role}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">£{job.rate}</p>
                <p className="text-xs text-zinc-500">per hour</p>
                <p className="text-xs text-zinc-500 mt-2">{job.applicants} applicants</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
              <div className="flex gap-2">
                {job.requirements.slice(0, 2).map(req => (
                  <span key={req} className="text-xs bg-white/10 text-zinc-300 px-2 py-1 rounded">
                    {req}
                  </span>
                ))}
              </div>
              {appliedJobs.includes(job.id) ? (
                <span className="text-sm text-emerald-400 font-medium">✓ Applied</span>
              ) : (
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApply(job.id);
                  }}
                  className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Quick Apply
                </motion.button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-400">No jobs match your filters</p>
          <button
            onClick={() => setFilters({ role: "all", distance: 10, minRate: 0, urgentOnly: false })}
            className="text-shield-400 hover:text-shield-300 mt-2"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setSelectedJob(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  {selectedJob.urgent && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full mb-2 inline-block">
                      🔥 Urgent - Fill needed
                    </span>
                  )}
                  <h2 className="text-xl font-bold text-white">{selectedJob.venue}</h2>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="text-amber-400">★ {selectedJob.venueRating}</span>
                    <span>•</span>
                    <span>{selectedJob.distance} miles</span>
                  </div>
                </div>
                <button onClick={() => setSelectedJob(null)} className="text-zinc-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Date</p>
                    <p className="text-white font-medium">
                      {new Date(selectedJob.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Time</p>
                    <p className="text-white font-medium">{selectedJob.startTime} - {selectedJob.endTime}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Role</p>
                    <p className="text-white font-medium">{selectedJob.role}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Rate</p>
                    <p className="text-emerald-400 font-bold text-lg">£{selectedJob.rate}/hr</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-zinc-400 mb-2">Description</p>
                  <p className="text-white">{selectedJob.description}</p>
                </div>

                <div>
                  <p className="text-sm text-zinc-400 mb-2">Requirements</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.requirements.map(req => (
                      <span key={req} className="text-sm bg-white/10 text-zinc-300 px-3 py-1 rounded-lg">
                        ✓ {req}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-shield-500/10 border border-shield-500/30 rounded-lg p-3">
                  <p className="text-sm text-shield-400 font-medium">Match Score: {selectedJob.matchScore}%</p>
                  <p className="text-xs text-zinc-400">Based on your skills, location, and preferences</p>
                </div>

                {appliedJobs.includes(selectedJob.id) ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                    <p className="text-emerald-400 font-medium">✓ You've applied to this job</p>
                    <p className="text-sm text-zinc-400">We'll notify you when there's an update</p>
                  </div>
                ) : (
                  <motion.button
                    onClick={() => handleApply(selectedJob.id)}
                    className="w-full bg-shield-500 hover:bg-shield-600 text-white py-3 rounded-xl font-medium transition"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Apply Now
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
