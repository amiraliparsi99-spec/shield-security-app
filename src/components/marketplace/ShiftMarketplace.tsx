"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface ShiftPost {
  id: string;
  title: string;
  description: string | null;
  shift_type: string;
  location_name: string;
  location_address: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  positions_available: number;
  positions_filled: number;
  requirements: string[] | null;
  sia_required: boolean;
  dress_code: string | null;
  status: string;
  urgency: string;
  application_deadline: string | null;
  created_at: string;
  venue?: { id: string; name: string; city: string };
  agency?: { id: string; name: string; city: string };
  my_application?: { id: string; status: string } | null;
}

const SHIFT_TYPES = [
  { value: "door_supervisor", label: "Door Supervisor", icon: "🚪" },
  { value: "cctv_operator", label: "CCTV Operator", icon: "📹" },
  { value: "close_protection", label: "Close Protection", icon: "🛡️" },
  { value: "event_security", label: "Event Security", icon: "🎪" },
  { value: "retail_security", label: "Retail Security", icon: "🛒" },
  { value: "corporate_security", label: "Corporate Security", icon: "🏢" },
  { value: "mobile_patrol", label: "Mobile Patrol", icon: "🚗" },
  { value: "static_guard", label: "Static Guard", icon: "🧍" },
  { value: "concierge", label: "Concierge", icon: "🎩" },
  { value: "other", label: "Other", icon: "📋" },
];

interface Props {
  personnelId?: string;
  isPersonnel?: boolean;
}

export function ShiftMarketplace({ personnelId, isPersonnel = true }: Props) {
  const [shifts, setShifts] = useState<ShiftPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: "",
    urgency: "",
    minRate: "",
    date: "",
  });
  const [showApplyModal, setShowApplyModal] = useState<ShiftPost | null>(null);
  const [applicationForm, setApplicationForm] = useState({
    cover_letter: "",
    proposed_rate: "",
  });
  const supabase = createClient();

  useEffect(() => {
    loadShifts();
  }, [filters]);

  const loadShifts = async () => {
    let query = supabase
      .from("shift_posts")
      .select(
        `
        *,
        venue:venues(id, name, city),
        agency:agencies(id, name, city)
      `
      )
      .eq("status", "open")
      .gte("shift_date", new Date().toISOString().split("T")[0])
      .order("urgency", { ascending: true })
      .order("shift_date", { ascending: true });

    if (filters.type) {
      query = query.eq("shift_type", filters.type);
    }
    if (filters.urgency) {
      query = query.eq("urgency", filters.urgency);
    }
    if (filters.minRate) {
      query = query.gte("hourly_rate", parseFloat(filters.minRate));
    }
    if (filters.date) {
      query = query.eq("shift_date", filters.date);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Get my applications if personnel
      if (personnelId) {
        const { data: applications } = await supabase
          .from("shift_applications")
          .select("id, status, shift_id")
          .eq("personnel_id", personnelId);

        const shiftsWithApps = data.map((shift) => ({
          ...shift,
          my_application: applications?.find((a) => a.shift_id === shift.id) || null,
        }));
        setShifts(shiftsWithApps);
      } else {
        setShifts(data);
      }
    }
    setLoading(false);
  };

  const handleApply = async (shift: ShiftPost) => {
    if (!personnelId) return;

    setApplying(shift.id);

    try {
      const { error } = await supabase.from("shift_applications").insert({
        shift_id: shift.id,
        personnel_id: personnelId,
        cover_letter: applicationForm.cover_letter || null,
        proposed_rate: applicationForm.proposed_rate
          ? parseFloat(applicationForm.proposed_rate)
          : null,
      });

      if (error) throw error;

      setShowApplyModal(null);
      setApplicationForm({ cover_letter: "", proposed_rate: "" });
      await loadShifts();
    } catch (error) {
      console.error("Failed to apply:", error);
      alert("Failed to submit application");
    } finally {
      setApplying(null);
    }
  };

  const handleWithdraw = async (applicationId: string) => {
    if (!confirm("Are you sure you want to withdraw your application?")) return;

    try {
      const { error } = await supabase
        .from("shift_applications")
        .update({ status: "withdrawn" })
        .eq("id", applicationId);

      if (error) throw error;
      await loadShifts();
    } catch (error) {
      console.error("Failed to withdraw:", error);
    }
  };

  const getTypeInfo = (type: string) => {
    return SHIFT_TYPES.find((t) => t.value === type) || { label: type, icon: "📋" };
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "emergency":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "urgent":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-dark-600 text-dark-300 border-dark-500";
    }
  };

  const getApplicationStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-500/20 text-green-400";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400";
      case "rejected":
        return "bg-red-500/20 text-red-400";
      case "withdrawn":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-dark-600 text-dark-300";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl p-6 animate-pulse"
          >
            <div className="h-6 bg-dark-600 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-dark-600 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-dark-600 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-dark-800 border border-dark-600 rounded-xl">
        <select
          value={filters.type}
          onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
          className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Types</option>
          {SHIFT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.icon} {type.label}
            </option>
          ))}
        </select>

        <select
          value={filters.urgency}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, urgency: e.target.value }))
          }
          className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Urgency</option>
          <option value="emergency">🚨 Emergency</option>
          <option value="urgent">⚡ Urgent</option>
          <option value="normal">Normal</option>
        </select>

        <input
          type="date"
          value={filters.date}
          onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
          className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
        />

        <input
          type="number"
          value={filters.minRate}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, minRate: e.target.value }))
          }
          placeholder="Min £/hr"
          className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none w-28"
        />

        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() =>
              setFilters({ type: "", urgency: "", minRate: "", date: "" })
            }
            className="px-4 py-2 text-dark-300 hover:text-white transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-dark-400">
        {shifts.length} shift{shifts.length !== 1 ? "s" : ""} available
      </p>

      {/* Shifts List */}
      {shifts.length === 0 ? (
        <div className="text-center py-12 bg-dark-800 border border-dark-600 rounded-xl">
          <span className="text-5xl mb-4 block">🔍</span>
          <h3 className="text-lg font-medium text-white mb-2">No shifts found</h3>
          <p className="text-dark-400">Try adjusting your filters or check back later</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const typeInfo = getTypeInfo(shift.shift_type);
            const positionsLeft = shift.positions_available - shift.positions_filled;

            return (
              <div
                key={shift.id}
                className={`p-6 bg-dark-800 border rounded-xl hover:border-dark-500 transition-colors ${
                  shift.urgency === "emergency"
                    ? "border-red-500/30"
                    : shift.urgency === "urgent"
                    ? "border-orange-500/30"
                    : "border-dark-600"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{typeInfo.icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {shift.title}
                        </h3>
                        <p className="text-sm text-dark-400">
                          {shift.venue?.name || shift.agency?.name} •{" "}
                          {shift.venue?.city || shift.agency?.city}
                        </p>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs border ${getUrgencyBadge(
                          shift.urgency
                        )}`}
                      >
                        {shift.urgency === "emergency"
                          ? "🚨 Emergency"
                          : shift.urgency === "urgent"
                          ? "⚡ Urgent"
                          : "Normal"}
                      </span>
                      <span className="px-2 py-1 bg-dark-700 text-dark-300 rounded-full text-xs">
                        {typeInfo.label}
                      </span>
                      {shift.sia_required && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                          SIA Required
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-dark-400">Date</span>
                        <p className="text-white font-medium">
                          {formatDate(shift.shift_date)}
                        </p>
                      </div>
                      <div>
                        <span className="text-dark-400">Time</span>
                        <p className="text-white">
                          {formatTime(shift.start_time)} -{" "}
                          {formatTime(shift.end_time)}
                        </p>
                      </div>
                      <div>
                        <span className="text-dark-400">Rate</span>
                        <p className="text-accent font-semibold">
                          £{shift.hourly_rate.toFixed(2)}/hr
                        </p>
                      </div>
                      <div>
                        <span className="text-dark-400">Positions</span>
                        <p className="text-white">
                          {positionsLeft} of {shift.positions_available} left
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    {shift.location_address && (
                      <p className="text-sm text-dark-400 mt-3">
                        📍 {shift.location_address}
                      </p>
                    )}

                    {/* Requirements */}
                    {shift.requirements && shift.requirements.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {shift.requirements.map((req, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-dark-700 text-dark-300 rounded text-xs"
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col items-end gap-2">
                    {shift.my_application ? (
                      <div className="text-right">
                        <span
                          className={`px-3 py-1 rounded-full text-sm ${getApplicationStatusBadge(
                            shift.my_application.status
                          )}`}
                        >
                          {shift.my_application.status === "pending"
                            ? "Applied"
                            : shift.my_application.status}
                        </span>
                        {shift.my_application.status === "pending" && (
                          <button
                            onClick={() =>
                              handleWithdraw(shift.my_application!.id)
                            }
                            className="block mt-2 text-sm text-dark-400 hover:text-red-400 transition-colors"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    ) : isPersonnel && positionsLeft > 0 ? (
                      <button
                        onClick={() => setShowApplyModal(shift)}
                        disabled={applying === shift.id}
                        className="px-6 py-3 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-lg font-medium transition-colors"
                      >
                        {applying === shift.id ? "..." : "Apply"}
                      </button>
                    ) : (
                      <span className="px-4 py-2 bg-dark-700 text-dark-400 rounded-lg text-sm">
                        Filled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-dark-600">
              <h3 className="text-lg font-semibold text-white">
                Apply for Shift
              </h3>
              <p className="text-dark-400 text-sm mt-1">
                {showApplyModal.title} at{" "}
                {showApplyModal.venue?.name || showApplyModal.agency?.name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Proposed Rate (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">
                    £
                  </span>
                  <input
                    type="number"
                    step="0.50"
                    value={applicationForm.proposed_rate}
                    onChange={(e) =>
                      setApplicationForm((prev) => ({
                        ...prev,
                        proposed_rate: e.target.value,
                      }))
                    }
                    placeholder={showApplyModal.hourly_rate.toFixed(2)}
                    className="w-full pl-8 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400">
                    /hr
                  </span>
                </div>
                <p className="text-xs text-dark-500 mt-1">
                  Posted rate: £{showApplyModal.hourly_rate.toFixed(2)}/hr
                </p>
              </div>

              <div>
                <label className="block text-sm text-dark-300 mb-2">
                  Cover Letter (Optional)
                </label>
                <textarea
                  value={applicationForm.cover_letter}
                  onChange={(e) =>
                    setApplicationForm((prev) => ({
                      ...prev,
                      cover_letter: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Introduce yourself and explain why you're a good fit for this shift..."
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-accent focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-dark-600 flex gap-3">
              <button
                onClick={() => setShowApplyModal(null)}
                className="flex-1 px-4 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApply(showApplyModal)}
                disabled={applying === showApplyModal.id}
                className="flex-1 px-4 py-3 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-lg font-medium transition-colors"
              >
                {applying === showApplyModal.id ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
