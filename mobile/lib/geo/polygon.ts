/**
 * Geofence geometry helpers (mobile mirror of src/lib/geo/polygon.ts).
 *
 * Polygons are stored as GeoJSON Polygons: `coordinates[0]` is the outer ring,
 * coordinates in `[longitude, latitude]` order. Self-contained (own haversine)
 * so it can run anywhere in the Expo app without extra imports.
 */

export type LngLat = [number, number];

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: LngLat[][];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Haversine distance in metres between two WGS84 points. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const f1 = (lat1 * Math.PI) / 180;
  const f2 = (lat2 * Math.PI) / 180;
  const df = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(df / 2) * Math.sin(df / 2) +
    Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function outerRing(polygon: unknown): LngLat[] | null {
  if (!polygon || typeof polygon !== "object") return null;

  const maybeFeature = polygon as { type?: string; geometry?: unknown };
  if (maybeFeature.type === "Feature" && maybeFeature.geometry) {
    return outerRing(maybeFeature.geometry);
  }

  let ring: unknown;
  const maybePoly = polygon as { type?: string; coordinates?: unknown };
  if (Array.isArray(maybePoly.coordinates)) {
    ring = maybePoly.coordinates[0];
  } else if (Array.isArray(polygon)) {
    ring = polygon;
  } else {
    return null;
  }

  if (!Array.isArray(ring)) return null;

  const cleaned: LngLat[] = [];
  for (const pt of ring) {
    if (
      Array.isArray(pt) &&
      pt.length >= 2 &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
    ) {
      cleaned.push([Number(pt[0]), Number(pt[1])]);
    }
  }
  return cleaned.length >= 3 ? cleaned : null;
}

export function isValidPolygon(polygon: unknown): boolean {
  return outerRing(polygon) !== null;
}

function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: unknown,
): boolean {
  const ring = outerRing(polygon);
  if (!ring) return false;
  return pointInRing(lng, lat, ring);
}

export function polygonCentroid(polygon: unknown): LatLng | null {
  const ring = outerRing(polygon);
  if (!ring) return null;

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = xj * yi - xi * yj;
    twiceArea += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }

  if (Math.abs(twiceArea) < 1e-12) {
    const sum = ring.reduce(
      (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
      { x: 0, y: 0 },
    );
    return { lng: sum.x / ring.length, lat: sum.y / ring.length };
  }

  const factor = 1 / (3 * twiceArea);
  return { lng: cx * factor, lat: cy * factor };
}

export function distanceToPolygonMeters(
  lat: number,
  lng: number,
  polygon: unknown,
): number {
  const ring = outerRing(polygon);
  if (!ring) return Number.POSITIVE_INFINITY;
  if (pointInRing(lng, lat, ring)) return 0;

  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const px = lng * metersPerDegLng;
  const py = lat * metersPerDegLat;

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0] * metersPerDegLng;
    const ay = ring[j][1] * metersPerDegLat;
    const bx = ring[i][0] * metersPerDegLng;
    const by = ring[i][1] * metersPerDegLat;
    min = Math.min(min, pointToSegmentMeters(px, py, ax, ay, bx, by));
  }
  return min;
}

function pointToSegmentMeters(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export type GeofenceMode = "polygon" | "radius" | "none";

export interface GeofenceCheckInput {
  lat: number;
  lng: number;
  polygon?: unknown;
  center?: LatLng | null;
  radiusMeters?: number;
  toleranceMeters?: number;
}

export interface GeofenceCheckResult {
  mode: GeofenceMode;
  inside: boolean;
  distanceMeters: number | null;
  allowedMeters: number | null;
}

export function isWithinGeofence(input: GeofenceCheckInput): GeofenceCheckResult {
  const { lat, lng, polygon, center, radiusMeters, toleranceMeters } = input;

  if (isValidPolygon(polygon)) {
    const tolerance = Number.isFinite(toleranceMeters)
      ? Math.max(0, toleranceMeters as number)
      : 0;
    const d = distanceToPolygonMeters(lat, lng, polygon);
    return {
      mode: "polygon",
      inside: d <= tolerance,
      distanceMeters: Math.round(d),
      allowedMeters: tolerance,
    };
  }

  if (
    center &&
    Number.isFinite(center.lat) &&
    Number.isFinite(center.lng) &&
    Number.isFinite(radiusMeters)
  ) {
    const d = distanceMeters(lat, lng, center.lat, center.lng);
    return {
      mode: "radius",
      inside: d <= (radiusMeters as number),
      distanceMeters: Math.round(d),
      allowedMeters: radiusMeters as number,
    };
  }

  return { mode: "none", inside: true, distanceMeters: null, allowedMeters: null };
}
