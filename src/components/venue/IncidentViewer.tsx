"use client";

import { useState } from "react";
import { motion } from "framer-motion";

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

const mockIncidents: Incident[] = [
  {
    id: "1",
    eventName: "Friday Night",
    eventDate: "2026-01-26",
    reportedBy: "Marcus Johnson",
    reportedAt: "23:45",
    type: "ejection",
    severity: "medium",
    location: "Main Bar Area",
    description: "Male patron refused service due to intoxication. Became verbally aggressive towards bar staff. Escorted from premises.",
    actionsTaken: "Verbal warning, refused re-entry, CCTV footage saved.",
    witnessCount: 3,
    policeInvolved: false,
    resolved: true,
  },
  {
    id: "2",
    eventName: "Friday Night",
    eventDate: "2026-01-26",
    reportedBy: "Sarah Williams",
    reportedAt: "01:15",
    type: "medical",
    severity: "low",
    location: "Dance Floor",
    description: "Female patron fainted, likely due to heat/dehydration. First aid administered.",
    actionsTaken: "First aid provided, patron recovered after 10 mins, friend took her home.",
    policeInvolved: false,
    resolved: true,
  },
  {
    id: "3",
    eventName: "Saturday Special",
    eventDate: "2026-01-18",
    reportedBy: "David Chen",
    reportedAt: "00:30",
    type: "assault",
    severity: "high",
    location: "VIP Area",
    description: "Physical altercation between two male patrons. One sustained minor injuries.",
    actionsTaken: "Both parties separated, ejected from venue, CCTV preserved, police report filed.",
    witnessCount: 5,
    policeInvolved: true,
    policeReference: "WM-2026-0118-4521",
    resolved: true,
  },
  {
    id: "4",
    eventName: "VIP Night",
    eventDate: "2026-01-24",
    reportedBy: "Emma Thompson",
    reportedAt: "22:00",
    type: "theft",
    severity: "medium",
    location: "Cloakroom",
    description: "Patron reported phone stolen from coat pocket while in cloakroom.",
    actionsTaken: "CCTV reviewed, suspect identified, police informed.",
    policeInvolved: true,
    policeReference: "WM-2026-0124-1823",
    resolved: false,
  },
];

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

export function IncidentViewer() {
  const [incidents] = useState<Incident[]>(mockIncidents);
  const [filter, setFilter] = useState<"all" | Incident["type"]>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Incident["severity"]>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const filteredIncidents = incidents.filter(inc => {
    const matchesType = filter === "all" || inc.type === filter;
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;
    return matchesType && matchesSeverity;
  });

  const stats = {
    total: incidents.length,
    thisMonth: incidents.filter(i => i.eventDate >= "2026-01-01").length,
    unresolved: incidents.filter(i => !i.resolved).length,
    policeInvolved: incidents.filter(i => i.policeInvolved).length,
  };

  const incidentsByType = Object.keys(incidentTypeLabels).map(type => ({
    type: type as Incident["type"],
    count: incidents.filter(i => i.type === type).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Incident Reports</h2>
          <p className="text-sm text-zinc-400">Security-logged incidents at your venue</p>
        </div>
        <motion.button
          className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          📥 Export Report
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Incidents</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">This Month</p>
          <p className="text-2xl font-bold text-blue-400">{stats.thisMonth}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Unresolved</p>
          <p className="text-2xl font-bold text-amber-400">{stats.unresolved}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Police Involved</p>
          <p className="text-2xl font-bold text-red-400">{stats.policeInvolved}</p>
        </div>
      </div>

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
          <motion.div
            key={incident.id}
            className={`glass rounded-xl p-4 cursor-pointer transition ${
              !incident.resolved ? "border border-amber-500/30" : ""
            }`}
            onClick={() => setSelectedIncident(incident)}
            whileHover={{ scale: 1.005 }}
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
          </motion.div>
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
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
              <motion.button
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                📄 Download PDF
              </motion.button>
              <motion.button
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                📧 Email Report
              </motion.button>
              <motion.button
                className="flex-1 glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                🎥 View CCTV
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {filteredIncidents.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-400">No incidents match your filters</p>
        </div>
      )}
    </div>
  );
}
