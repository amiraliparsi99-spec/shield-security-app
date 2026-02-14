"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Incident = {
  id: string;
  date: string;
  time: string;
  venue: string;
  type: "ejection" | "medical" | "theft" | "assault" | "disturbance" | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  actionsTaken: string;
  witnessCount: number;
  policeInvolved: boolean;
  policeReference?: string;
  status: "draft" | "submitted" | "acknowledged";
};

const mockIncidents: Incident[] = [
  {
    id: "1",
    date: "2026-01-26",
    time: "23:45",
    venue: "The Grand Club",
    type: "ejection",
    severity: "medium",
    description: "Male patron refused service due to intoxication. Became verbally aggressive. Escorted from premises.",
    actionsTaken: "Verbal warning, refused re-entry, CCTV footage saved.",
    witnessCount: 3,
    policeInvolved: false,
    status: "submitted",
  },
  {
    id: "2",
    date: "2026-01-19",
    time: "01:15",
    venue: "Pryzm",
    type: "medical",
    severity: "low",
    description: "Female patron fainted on dance floor. Possible dehydration.",
    actionsTaken: "First aid administered, patron recovered, friend escorted her home.",
    witnessCount: 2,
    policeInvolved: false,
    status: "acknowledged",
  },
];

const incidentTypes = [
  { value: "ejection", label: "Ejection", icon: "🚪" },
  { value: "medical", label: "Medical", icon: "🏥" },
  { value: "theft", label: "Theft", icon: "💰" },
  { value: "assault", label: "Assault", icon: "👊" },
  { value: "disturbance", label: "Disturbance", icon: "🔊" },
  { value: "other", label: "Other", icon: "📋" },
];

const severityLevels = [
  { value: "low", label: "Low", color: "bg-blue-500" },
  { value: "medium", label: "Medium", color: "bg-amber-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "bg-red-500" },
];

export function IncidentReporter() {
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    venue: "",
    type: "ejection" as Incident["type"],
    severity: "medium" as Incident["severity"],
    description: "",
    actionsTaken: "",
    witnessCount: 0,
    policeInvolved: false,
    policeReference: "",
  });

  const handleSubmit = () => {
    const newIncident: Incident = {
      id: String(Date.now()),
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      venue: formData.venue,
      type: formData.type,
      severity: formData.severity,
      description: formData.description,
      actionsTaken: formData.actionsTaken,
      witnessCount: formData.witnessCount,
      policeInvolved: formData.policeInvolved,
      policeReference: formData.policeReference || undefined,
      status: "submitted",
    };

    setIncidents(prev => [newIncident, ...prev]);
    setShowForm(false);
    setFormData({
      venue: "",
      type: "ejection",
      severity: "medium",
      description: "",
      actionsTaken: "",
      witnessCount: 0,
      policeInvolved: false,
      policeReference: "",
    });
  };

  const getStatusBadge = (status: Incident["status"]) => {
    switch (status) {
      case "draft":
        return <span className="text-xs bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded-full">Draft</span>;
      case "submitted":
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Submitted</span>;
      case "acknowledged":
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Acknowledged</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Incident Reporter</h2>
          <p className="text-sm text-zinc-400">Log and track incidents from your shifts</p>
        </div>
        <motion.button
          onClick={() => setShowForm(true)}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Report Incident
        </motion.button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Reports</p>
          <p className="text-2xl font-bold text-white">{incidents.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">This Month</p>
          <p className="text-2xl font-bold text-blue-400">
            {incidents.filter(i => i.date.startsWith("2026-01")).length}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Police Involved</p>
          <p className="text-2xl font-bold text-amber-400">
            {incidents.filter(i => i.policeInvolved).length}
          </p>
        </div>
      </div>

      {/* New Incident Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6 border border-red-500/30"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-xl">🚨</span> Report New Incident
            </h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Venue */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Venue *</label>
              <select
                value={formData.venue}
                onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none transition"
              >
                <option value="">Select venue...</option>
                <option value="The Grand Club">The Grand Club</option>
                <option value="Birmingham Arena">Birmingham Arena</option>
                <option value="Pryzm">Pryzm</option>
                <option value="Mailbox Tower">Mailbox Tower</option>
              </select>
            </div>

            {/* Incident Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Incident Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {incidentTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value as Incident["type"] }))}
                    className={`p-3 rounded-lg text-center transition ${
                      formData.type === type.value
                        ? "bg-red-500/20 border border-red-500 text-white"
                        : "bg-white/5 border border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className="text-xl block mb-1">{type.icon}</span>
                    <span className="text-xs">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Severity *</label>
              <div className="flex gap-2">
                {severityLevels.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setFormData(prev => ({ ...prev, severity: level.value as Incident["severity"] }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      formData.severity === level.value
                        ? `${level.color} text-white`
                        : "bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none transition h-24 resize-none"
                placeholder="Describe what happened..."
              />
            </div>

            {/* Actions Taken */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Actions Taken *</label>
              <textarea
                value={formData.actionsTaken}
                onChange={(e) => setFormData(prev => ({ ...prev, actionsTaken: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none transition h-20 resize-none"
                placeholder="What did you do in response?"
              />
            </div>

            {/* Witnesses & Police */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Witnesses</label>
                <input
                  type="number"
                  value={formData.witnessCount}
                  onChange={(e) => setFormData(prev => ({ ...prev, witnessCount: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none transition"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Police Involved?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, policeInvolved: false }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      !formData.policeInvolved ? "bg-emerald-500 text-white" : "bg-white/5 text-zinc-400"
                    }`}
                  >
                    No
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, policeInvolved: true }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      formData.policeInvolved ? "bg-blue-500 text-white" : "bg-white/5 text-zinc-400"
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>

            {formData.policeInvolved && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Police Reference Number</label>
                <input
                  type="text"
                  value={formData.policeReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, policeReference: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none transition"
                  placeholder="e.g. WM-2026-0130-1234"
                />
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-zinc-400 hover:text-white transition">
                Cancel
              </button>
              <motion.button
                onClick={handleSubmit}
                disabled={!formData.venue || !formData.description || !formData.actionsTaken}
                className="bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Submit Report
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Incident History */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Your Reports</h3>
        </div>
        <div className="divide-y divide-white/5">
          {incidents.map(incident => (
            <div key={incident.id} className="p-4 hover:bg-white/5 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {incidentTypes.find(t => t.value === incident.type)?.icon}
                    </span>
                    <span className="font-medium text-white capitalize">{incident.type}</span>
                    {getStatusBadge(incident.status)}
                    {incident.policeInvolved && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">🚔 Police</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">
                    {incident.venue} • {new Date(incident.date).toLocaleDateString("en-GB")} at {incident.time}
                  </p>
                  <p className="text-sm text-zinc-300 mt-2 line-clamp-2">{incident.description}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  incident.severity === "critical" ? "bg-red-500/20 text-red-400" :
                  incident.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                  incident.severity === "medium" ? "bg-amber-500/20 text-amber-400" :
                  "bg-blue-500/20 text-blue-400"
                }`}>
                  {incident.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {incidents.length === 0 && (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-zinc-400">No incidents reported</p>
        </div>
      )}
    </div>
  );
}
