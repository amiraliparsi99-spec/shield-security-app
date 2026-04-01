"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getUserMessage } from "@/lib/error-handler";
import { generatePostShiftSummaryPDF } from "@/lib/exports/pdf-generator";

type Incident = {
  id: string;
  eventName: string;
  eventDate: string;
  reportedBy: string;
  reportedAt: string;
  type: "ejection" | "medical" | "theft" | "assault" | "disturbance" | "other";
  severity: "low" | "medium" | "high" | "critical";
  location: string;
  description: string;
  actionsTaken: string;
  witnessCount?: number;
  policeInvolved: boolean;
  policeReference?: string;
  resolved: boolean;
  attachments?: string[];
};

const incidentTypeLabels: Record<Incident["type"], string> = {
  ejection: "🚪 Ejection",
  medical: "🏥 Medical",
  theft: "💰 Theft",
  assault: "👊 Assault",
  disturbance: "🔊 Disturbance",
  other: "📋 Other",
};

const severityColors: Record<Incident["severity"], string> = {
  low: "bg-blue-500/20 text-blue-400",
  medium: "bg-amber-500/20 text-amber-400",
  high: "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400",
};

type PostShiftSummary = {
  id: string;
  created_at: string;
  personnel_name: string;
  total_incidents: number;
  summary_text: string | null;
  shift_notes: string | null;
  voice_transcript: string | null;
  notable_events: string[] | null;
  ejections_count: number;
  medical_count: number;
  disturbances_count: number;
  event_name: string;
  event_date: string;
};

export function IncidentViewer() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summaries, setSummaries] = useState<PostShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Incident["type"]>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Incident["severity"]>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<PostShiftSummary | null>(null);
  const [viewMode, setViewMode] = useState<"incidents" | "summaries">("summaries");

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      // Get current user's venue
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get venue ID
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!venue) {
        setLoading(false);
        return;
      }

      // Fetch post-shift summaries for this venue
      const { data: summariesData, error: summariesError } = await supabase
        .from("post_shift_summaries")
        .select(`
          *,
          personnel:personnel_id(display_name),
          shift:shift_id(
            booking:booking_id(event_name, event_date)
          )
        `)
        .eq("venue_id", venue.id)
        .order("created_at", { ascending: false });


      if (summariesError) {
        // Error already surfaced via empty summaries; optional: setError(getUserMessage(summariesError))
      }
      if (!summariesError) {
        const transformedSummaries: PostShiftSummary[] = (summariesData || []).map((s: any) => ({
          id: s.id,
          created_at: s.created_at,
          personnel_name: s.personnel?.display_name || "Security Staff",
          total_incidents: s.total_incidents || 0,
          summary_text: s.summary_text,
          shift_notes: s.shift_notes,
          voice_transcript: s.voice_transcript,
          notable_events: s.notable_events,
          ejections_count: s.ejections_count || 0,
          medical_count: s.medical_count || 0,
          disturbances_count: s.disturbances_count || 0,
          event_name: s.shift?.booking?.event_name || "Shift Report",
          event_date: s.shift?.booking?.event_date || s.created_at?.split("T")[0],
        }));
        setSummaries(transformedSummaries);
      }

      // Fetch incidents for this venue (simplified query)
      const { data: incidentsData, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("venue_id", venue.id)
        .order("created_at", { ascending: false });


      if (error) {
        // Error already surfaced via empty incidents
      }

      // Transform data to match the Incident type
      const transformedIncidents: Incident[] = (incidentsData || []).map((inc: any) => ({
        id: inc.id,
        eventName: "Shift",
        eventDate: inc.occurred_at?.split("T")[0] || inc.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        reportedBy: "Security Staff",
        reportedAt: inc.occurred_at ? new Date(inc.occurred_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : new Date(inc.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        type: inc.type || "other",
        severity: inc.severity || "medium",
        location: inc.location || "Not specified",
        description: inc.description || "No description provided",
        actionsTaken: inc.actions_taken || "See post-shift summary",
        witnessCount: inc.witness_count,
        policeInvolved: inc.police_involved || false,
        policeReference: inc.police_reference,
        resolved: inc.resolved ?? true,
      }));

      setIncidents(transformedIncidents);
      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredIncidents = incidents.filter(inc => {
    const matchesType = filter === "all" || inc.type === filter;
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;
    return matchesType && matchesSeverity;
  });

  const stats = {
    total: incidents.length,
    summaries: summaries.length,
    thisMonth: incidents.filter(i => i.eventDate >= "2026-01-01").length,
    unresolved: incidents.filter(i => !i.resolved).length,
    policeInvolved: incidents.filter(i => i.policeInvolved).length,
    noIncidentShifts: summaries.filter(s => s.total_incidents === 0).length,
  };

  const incidentsByType = Object.keys(incidentTypeLabels).map(type => ({
    type: type as Incident["type"],
    count: incidents.filter(i => i.type === type).length,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Incident Reports</h2>
            <p className="text-sm text-zinc-400">Loading incidents...</p>
          </div>
        </div>
        <div className="glass rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-shield-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading incident reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Incident Reports</h2>
          <p className="text-sm text-zinc-400">Security-logged incidents at your venue</p>
        </div>
        <button
          type="button"
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
        >
          📥 Export Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Shift Reports</p>
          <p className="text-2xl font-bold text-white">{stats.summaries}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Incidents</p>
          <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Clean Shifts</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.noIncidentShifts}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Police Involved</p>
          <p className="text-2xl font-bold text-red-400">{stats.policeInvolved}</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("summaries")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            viewMode === "summaries"
              ? "bg-shield-500 text-white"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          📋 Shift Reports ({summaries.length})
        </button>
        <button
          onClick={() => setViewMode("incidents")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            viewMode === "incidents"
              ? "bg-shield-500 text-white"
              : "bg-white/5 text-zinc-400 hover:text-white"
          }`}
        >
          ⚠️ Incidents ({incidents.length})
        </button>
      </div>

      {/* Shift Reports List */}
      {viewMode === "summaries" && (
        <div className="space-y-4">
          {summaries.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-zinc-400">No shift reports yet</p>
              <p className="text-sm text-zinc-500 mt-2">Reports will appear here when guards submit their post-shift summaries</p>
            </div>
          ) : (
            summaries.map(summary => (
              <div
                key={summary.id}
                className="glass rounded-xl p-4 cursor-pointer"
                onClick={() => setSelectedSummary(summary)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                      summary.total_incidents > 0 ? "bg-amber-500/20" : "bg-emerald-500/20"
                    }`}>
                      {summary.total_incidents > 0 ? "⚠️" : "✅"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{summary.event_name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          summary.total_incidents > 0 
                            ? "bg-amber-500/20 text-amber-400" 
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}>
                          {summary.total_incidents > 0 
                            ? `${summary.total_incidents} incident${summary.total_incidents !== 1 ? "s" : ""}` 
                            : "No incidents"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        {new Date(summary.event_date).toLocaleDateString("en-GB")} • Reported by {summary.personnel_name}
                      </p>
                      {(summary.summary_text || summary.shift_notes) && (
                        <p className="text-sm text-zinc-300 mt-2 line-clamp-2">
                          {summary.summary_text || summary.shift_notes}
                        </p>
                      )}
                      {/* Show incident breakdown if there are incidents */}
                      {summary.total_incidents > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {summary.ejections_count > 0 && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                              🚪 {summary.ejections_count} ejection{summary.ejections_count !== 1 ? "s" : ""}
                            </span>
                          )}
                          {summary.medical_count > 0 && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                              🏥 {summary.medical_count} medical
                            </span>
                          )}
                          {summary.disturbances_count > 0 && (
                            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                              🔊 {summary.disturbances_count} disturbance{summary.disturbances_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      {new Date(summary.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Shift Report Detail Modal */}
      {selectedSummary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setSelectedSummary(null)}
        >
          <div
            className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{selectedSummary.total_incidents > 0 ? "📋" : "✅"}</span>
                  <h2 className="text-xl font-bold text-white">
                    {selectedSummary.event_name}
                  </h2>
                </div>
                <p className="text-sm text-zinc-400">
                  {new Date(selectedSummary.event_date).toLocaleDateString("en-GB")} • Reported by {selectedSummary.personnel_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="text-zinc-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status Badge */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className={`text-sm px-3 py-1 rounded-full ${
                selectedSummary.total_incidents > 0 
                  ? "bg-amber-500/20 text-amber-400" 
                  : "bg-emerald-500/20 text-emerald-400"
              }`}>
                {selectedSummary.total_incidents > 0 
                  ? `${selectedSummary.total_incidents} incident${selectedSummary.total_incidents !== 1 ? "s" : ""} reported` 
                  : "✓ No incidents"}
              </span>
              <span className="text-sm bg-white/10 text-zinc-300 px-3 py-1 rounded-full">
                Submitted {new Date(selectedSummary.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Incident Breakdown */}
            {selectedSummary.total_incidents > 0 && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Incident Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">{selectedSummary.ejections_count}</p>
                    <p className="text-xs text-zinc-400">🚪 Ejections</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{selectedSummary.medical_count}</p>
                    <p className="text-xs text-zinc-400">🏥 Medical</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-400">{selectedSummary.disturbances_count}</p>
                    <p className="text-xs text-zinc-400">🔊 Disturbances</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notable Events */}
            {selectedSummary.notable_events && selectedSummary.notable_events.length > 0 && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Notable Events</h3>
                <ul className="space-y-2">
                  {selectedSummary.notable_events.map((event, idx) => (
                    <li key={idx} className="text-white text-sm flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      {event}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Voice Transcript */}
            {selectedSummary.voice_transcript && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">🎤 Voice Report</h3>
                <p className="text-white italic">"{selectedSummary.voice_transcript}"</p>
              </div>
            )}

            {/* Shift Notes */}
            {selectedSummary.shift_notes && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">📝 Additional Notes</h3>
                <p className="text-white">{selectedSummary.shift_notes}</p>
              </div>
            )}

            {/* Summary Text */}
            {selectedSummary.summary_text && selectedSummary.summary_text !== selectedSummary.shift_notes && (
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Summary</h3>
                <p className="text-white">{selectedSummary.summary_text}</p>
              </div>
            )}

            {/* No additional details message */}
            {!selectedSummary.notable_events?.length && 
             !selectedSummary.voice_transcript && 
             !selectedSummary.shift_notes && 
             !selectedSummary.summary_text && 
             selectedSummary.total_incidents === 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                <p className="text-emerald-400">✓ Clean shift - no incidents or issues reported</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => generatePostShiftSummaryPDF({
                  event_name: selectedSummary.event_name,
                  event_date: selectedSummary.event_date,
                  personnel_name: selectedSummary.personnel_name,
                  created_at: selectedSummary.created_at,
                  total_incidents: selectedSummary.total_incidents,
                  ejections_count: selectedSummary.ejections_count,
                  medical_count: selectedSummary.medical_count,
                  disturbances_count: selectedSummary.disturbances_count,
                  notable_events: selectedSummary.notable_events,
                  voice_transcript: selectedSummary.voice_transcript,
                  summary_text: selectedSummary.summary_text,
                  shift_notes: selectedSummary.shift_notes,
                })}
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
              >
                📄 Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") window.alert("Email report will be available soon. Use Download PDF for now.");
                }}
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
              >
                📧 Email Report
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Incidents View */}
      {viewMode === "incidents" && (
        <>
          {/* Type Breakdown */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Incident Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {incidentsByType.map(({ type, count }) => (
                <button
                  key={type}
                  onClick={() => setFilter(filter === type ? "all" : type)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    filter === type
                      ? "bg-shield-500 text-white"
                      : "bg-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {incidentTypeLabels[type]} ({count})
                </button>
          ))}
        </div>
      </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex gap-2">
              <span className="text-sm text-zinc-400 py-2">Severity:</span>
              {(["all", "low", "medium", "high", "critical"] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    severityFilter === sev
                      ? "bg-shield-500 text-white"
                      : "bg-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Incident List */}
          <div className="space-y-4">
        {filteredIncidents.map(incident => (
          <div
            key={incident.id}
            className={`glass rounded-xl p-4 cursor-pointer transition ${
              !incident.resolved ? "border border-amber-500/30" : ""
            }`}
            onClick={() => setSelectedIncident(incident)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                  incident.severity === "critical" || incident.severity === "high"
                    ? "bg-red-500/20"
                    : incident.severity === "medium"
                    ? "bg-amber-500/20"
                    : "bg-blue-500/20"
                }`}>
                  {incidentTypeLabels[incident.type].split(" ")[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">{incidentTypeLabels[incident.type].split(" ")[1]}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityColors[incident.severity]}`}>
                      {incident.severity}
                    </span>
                    {!incident.resolved && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                        Unresolved
                      </span>
                    )}
                    {incident.policeInvolved && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                        🚔 Police
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">
                    {incident.eventName} • {new Date(incident.eventDate).toLocaleDateString("en-GB")} • {incident.reportedAt}
                  </p>
                  <p className="text-sm text-zinc-400">
                    📍 {incident.location} • Reported by {incident.reportedBy}
                  </p>
                </div>
              </div>
              <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-zinc-300 line-clamp-2">{incident.description}</p>
          </div>
          ))}
          </div>

          {/* Incident Detail Modal */}
          {selectedIncident && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{incidentTypeLabels[selectedIncident.type].split(" ")[0]}</span>
                  <h2 className="text-xl font-bold text-white">
                    {incidentTypeLabels[selectedIncident.type].split(" ")[1]} Incident
                  </h2>
                </div>
                <p className="text-sm text-zinc-400">
                  {selectedIncident.eventName} • {new Date(selectedIncident.eventDate).toLocaleDateString("en-GB")}
                </p>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-zinc-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className={`text-sm px-3 py-1 rounded-full ${severityColors[selectedIncident.severity]}`}>
                Severity: {selectedIncident.severity}
              </span>
              <span className={`text-sm px-3 py-1 rounded-full ${
                selectedIncident.resolved ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {selectedIncident.resolved ? "✓ Resolved" : "⏳ Unresolved"}
              </span>
              {selectedIncident.policeInvolved && (
                <span className="text-sm bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                  🚔 Police Involved
                </span>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
                <p className="text-white">{selectedIncident.description}</p>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Actions Taken</h3>
                <p className="text-white">{selectedIncident.actionsTaken}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">Location</h3>
                  <p className="text-white">{selectedIncident.location}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">Time Reported</h3>
                  <p className="text-white">{selectedIncident.reportedAt}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">Reported By</h3>
                  <p className="text-white">{selectedIncident.reportedBy}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">Witnesses</h3>
                  <p className="text-white">{selectedIncident.witnessCount || "Not recorded"}</p>
                </div>
              </div>

              {selectedIncident.policeReference && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-400 mb-1">Police Reference</h3>
                  <p className="text-white font-mono">{selectedIncident.policeReference}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                type="button"
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
              >
                📄 Download PDF
              </button>
              <button
                type="button"
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
              >
                📧 Email Report
              </button>
              <button
                type="button"
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition active:scale-[0.98]"
              >
                🎥 View CCTV
              </button>
            </div>
          </div>
        </motion.div>
      )}

          {filteredIncidents.length === 0 && (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-zinc-400">No incidents match your filters</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
