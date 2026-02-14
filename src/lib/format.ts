import type { Personnel } from "@/types/database";

/**
 * Display location for a personnel profile.
 * Uses location_name if set, otherwise builds from city, region, country.
 */
export function formatLocation(p: Personnel): string {
  if (p.location_name && p.location_name.trim()) return p.location_name;
  const parts = [p.city, p.region].filter(Boolean);
  if (parts.length) return `${parts.join(", ")}${p.country ? `, ${p.country}` : ""}`;
  return p.country || "—";
}

/**
 * How long they have been in security.
 * e.g. "5 years in security" or "In security since 2019" or both.
 */
export function formatExperience(p: Personnel): string {
  const years = p.experience_years ?? null;
  const since = p.experience_since_year ?? null;

  if (years != null && since != null) {
    return `${years} years in security · Since ${since}`;
  }
  if (years != null) {
    return `${years} ${years === 1 ? "year" : "years"} in security`;
  }
  if (since != null) {
    return `In security since ${since}`;
  }
  return "—";
}

/**
 * Format a rating out of 5 for display (e.g. "4.8").
 */
export function formatRating(value: number): string {
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

/**
 * Format an ISO date for requests: "Fri, 24 Jan, 7:00 pm".
 */
export function formatRequestDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/**
 * Format time range for a shift: "7:00 pm – 2:00 am".
 */
export function formatTimeRange(start: string, end?: string): string {
  try {
    const s = new Date(start);
    const startStr = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (end) {
      const e = new Date(end);
      return `${startStr} – ${e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return startStr;
  } catch {
    return start;
  }
}
