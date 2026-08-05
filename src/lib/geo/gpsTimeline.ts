import { distanceMeters } from "@/lib/geo/distance";

export type GpsTimelinePoint = {
  id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  accuracy?: number | null;
};

export type GpsDwellStop = {
  id: string;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
  durationMs: number;
  pointCount: number;
};

/** Points within this radius (metres) count as the same place. */
const STATIONARY_RADIUS_M = 75;

function averageCoord(points: GpsTimelinePoint[], key: "lat" | "lng"): number {
  const sum = points.reduce((n, p) => n + p[key], 0);
  return sum / points.length;
}

function finalizeCluster(points: GpsTimelinePoint[]): GpsDwellStop {
  const startAt = points[0].recorded_at;
  const endAt = points[points.length - 1].recorded_at;
  const durationMs = Math.max(
    0,
    new Date(endAt).getTime() - new Date(startAt).getTime(),
  );
  return {
    id: `${startAt}-${points[0].id}`,
    lat: averageCoord(points, "lat"),
    lng: averageCoord(points, "lng"),
    startAt,
    endAt,
    durationMs,
    pointCount: points.length,
  };
}

/**
 * Merge consecutive GPS fixes into dwell stops (same site, with duration).
 * Input can be any order; output is newest-first for timeline display.
 */
export function clusterGpsIntoStops(points: GpsTimelinePoint[]): GpsDwellStop[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  const clusters: GpsTimelinePoint[][] = [];
  let current: GpsTimelinePoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i];
    const centerLat = averageCoord(current, "lat");
    const centerLng = averageCoord(current, "lng");
    const dist = distanceMeters(p.lat, p.lng, centerLat, centerLng);

    if (dist <= STATIONARY_RADIUS_M) {
      current.push(p);
    } else {
      clusters.push(current);
      current = [p];
    }
  }
  clusters.push(current);

  return clusters.map(finalizeCluster).reverse();
}

export function formatDwellDuration(ms: number, pointCount: number): string {
  if (ms < 60_000) {
    if (pointCount <= 1) return "Brief ping";
    return "Under 1 min";
  }
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  if (startAt === endAt || fmt(start) === fmt(end)) {
    return fmt(start);
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Cache key for reverse-geocode deduplication (~25m grid). */
export function geocodeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function shortPlaceLabel(placeName: string): string {
  const parts = placeName.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return placeName;
  // e.g. "123 High Street, Milton Keynes, MK1 1AA, United Kingdom" → first 2-3 useful parts
  return parts.slice(0, 3).join(", ");
}
