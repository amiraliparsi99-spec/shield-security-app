/**
 * Shared constants and types for incident reporting (post-shift summary).
 */

export const INCIDENT_TEMPLATES = [
  { id: "none", icon: "✅", label: "No Incidents", color: "#22c55e" },
  { id: "ejection", icon: "🚫", label: "Ejection", color: "#ef4444" },
  { id: "disturbance", icon: "⚠️", label: "Disturbance", color: "#f59e0b" },
  { id: "medical", icon: "🚑", label: "Medical", color: "#3b82f6" },
  { id: "theft", icon: "🔓", label: "Theft", color: "#8b5cf6" },
  { id: "assault", icon: "⚔️", label: "Assault", color: "#dc2626" },
  { id: "refused_entry", icon: "🚷", label: "Refused Entry", color: "#f97316" },
  { id: "property_damage", icon: "🔧", label: "Property Damage", color: "#6366f1" },
  { id: "police_called", icon: "🚨", label: "Police Called", color: "#0ea5e9" },
  { id: "suspicious", icon: "👤", label: "Suspicious Person", color: "#a855f7" },
  { id: "other", icon: "📝", label: "Other", color: "#6b7280" },
] as const;

export interface IncidentEntry {
  id: string;
  type: string;
  description: string;
  time?: string;
  severity?: "low" | "medium" | "high" | "critical";
}
