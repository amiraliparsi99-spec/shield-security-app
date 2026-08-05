import { distanceMeters } from "./distance";

/**
 * Geofence geometry helpers.
 *
 * Polygons are stored as GeoJSON Polygons — `coordinates` is an array of linear
 * rings, the first being the outer ring and the rest holes. Coordinate order is
 * GeoJSON's `[longitude, latitude]`, which is exactly what Mapbox GL Draw emits.
 *
 * All maths runs in plain JS so the same logic can run server-side (check-in
 * API, travel-risk engine) and on the mobile client (a mirror of this file
 * lives at mobile/lib/geo/polygon.ts).
 */

/** A `[longitude, latitude]` coordinate pair, GeoJSON order. */
export type LngLat = [number, number];

/** A GeoJSON Polygon geometry. `coordinates[0]` is the outer ring. */
export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: LngLat[][];
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Returns the polygon's outer ring, or null when the value is not a usable
 * polygon (needs at least 3 distinct vertices). Accepts a GeoJSON Polygon, a
 * GeoJSON Feature wrapping one, or a bare ring of coordinates — anything that
 * might come back from the DB (jsonb) or a drawing control.
 */
export function outerRing(polygon: unknown): LngLat[] | null {
  if (!polygon || typeof polygon !== "object") return null;

  // Feature -> unwrap geometry.
  const maybeFeature = polygon as { type?: string; geometry?: unknown };
  if (maybeFeature.type === "Feature" && maybeFeature.geometry) {
    return outerRing(maybeFeature.geometry);
  }

  let ring: unknown;
  const maybePoly = polygon as { type?: string; coordinates?: unknown };
  if (Array.isArray(maybePoly.coordinates)) {
    ring = maybePoly.coordinates[0];
  } else if (Array.isArray(polygon)) {
    // Bare ring already.
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

/** True when the supplied value is a usable polygon (>= 3 vertices). */
export function isValidPolygon(polygon: unknown): boolean {
  return outerRing(polygon) !== null;
}

/**
 * Ray-casting point-in-ring test. `ring` is in `[lng, lat]` order. The ring may
 * be open or closed (first === last); both work.
 */
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

/** True when (lat, lng) falls inside the polygon's outer ring. */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: unknown,
): boolean {
  const ring = outerRing(polygon);
  if (!ring) return false;
  return pointInRing(lng, lat, ring);
}

/** Area-weighted centroid of the polygon's outer ring, or null when invalid. */
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

  // Degenerate (zero-area) ring — fall back to the vertex average.
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

/**
 * Shortest distance in metres from (lat, lng) to the polygon. Returns 0 when the
 * point is inside. Distances are computed in a local equirectangular projection
 * around the test point, which is accurate at the scale of a single site.
 */
export function distanceToPolygonMeters(
  lat: number,
  lng: number,
  polygon: unknown,
): number {
  const ring = outerRing(polygon);
  if (!ring) return Number.POSITIVE_INFINITY;
  if (pointInRing(lng, lat, ring)) return 0;

  // Local planar metres per degree at this latitude.
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

/** Approximate area of the polygon in square metres (shoelace, local planar). */
export function polygonAreaSqMeters(polygon: unknown): number {
  const ring = outerRing(polygon);
  if (!ring) return 0;
  // Project to local metres around the ring's first vertex.
  const lat0 = ring[0][1];
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  let twiceArea = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] * mPerLng;
    const yi = ring[i][1] * mPerLat;
    const xj = ring[j][0] * mPerLng;
    const yj = ring[j][1] * mPerLat;
    twiceArea += xj * yi - xi * yj;
  }
  return Math.abs(twiceArea) / 2;
}

/**
 * Build a square GeoJSON Polygon centred on a point, with the given half-size
 * (metres) from centre to edge. Used to seed a sensible default boundary that
 * the venue can then reshape.
 */
export function squarePolygonAround(
  lat: number,
  lng: number,
  halfSizeMeters = 60,
): GeoJsonPolygon {
  const dLat = halfSizeMeters / 111_320;
  const dLng = halfSizeMeters / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  const ring: LngLat[] = [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

export type GeofenceMode = "polygon" | "radius" | "none";

export interface GeofenceCheckInput {
  /** Reported device latitude. */
  lat: number;
  /** Reported device longitude. */
  lng: number;
  /** Drawn boundary, when one is configured for this site/booking. */
  polygon?: unknown;
  /** Fallback check-in pin used when no polygon is configured. */
  center?: LatLng | null;
  /** Radius in metres for the fallback pin. */
  radiusMeters?: number;
  /** GPS-accuracy buffer applied to the polygon boundary. */
  toleranceMeters?: number;
}

export interface GeofenceCheckResult {
  mode: GeofenceMode;
  /** True when the point is within the geofence (or none is configured). */
  inside: boolean;
  /**
   * Distance in metres to the polygon edge (0 when inside) for polygon mode, or
   * to the pin for radius mode. Null when no geofence is configured.
   */
  distanceMeters: number | null;
  /** Effective allowed distance: radius (radius mode) or tolerance (polygon). */
  allowedMeters: number | null;
}

/**
 * Single decision function for "is this device on-site?".
 *
 * - Polygon configured -> inside the boundary, expanded by `toleranceMeters` to
 *   absorb GPS jitter near the edge.
 * - No polygon but a pin -> classic radius check (backwards compatible).
 * - Neither -> no geofence to enforce; treated as inside.
 */
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
