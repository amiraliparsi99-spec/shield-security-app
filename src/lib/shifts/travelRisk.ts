/**
 * Pre-shift travel risk engine.
 *
 * Pure function. No Supabase, no fetch, no Date.now(). Pass it the shift, the
 * latest GPS sample (or null), the site coords, and the current time, and it
 * returns the ring the shift currently sits in plus a human-readable reason.
 *
 * Spec: docs/PRE_SHIFT_ABSENCE_ESCALATION.md §3.
 *
 * Rings:
 *   none — nothing of concern (default for everything outside the eval window)
 *   R3   — T-30m, no GPS in last 15m OR > thresholds.r3DistanceM from site
 *   R4   — T-15m, no GPS in last 10m OR > thresholds.r4DistanceM from site
 *   R5   — T-5m,  not within thresholds.r5DistanceM (default 1km) OR no recent GPS
 *   R6   — T+10m, still not checked in (status === 'accepted')
 *
 * The cron decides what to *do* with the ring (push, MC message, escalate).
 * The engine decides only what ring is currently appropriate.
 */

import { distanceToPolygonMeters, isValidPolygon } from "../geo/polygon";

export type TravelRing = "none" | "R3" | "R4" | "R5" | "R6";

export type TravelRiskInput = {
  /** Current ISO timestamp; passed in so the function is deterministic and unit-testable. */
  now: Date;
  /** Shift scheduled start (ISO). */
  scheduledStartIso: string;
  /** Shift status. We only return non-none rings for `accepted`. */
  status: string;
  /** Latest GPS sample for this shift, or null if there is none. */
  latestGps: {
    lat: number;
    lng: number;
    accuracy_m?: number | null;
    recorded_at: string;
  } | null;
  /** Site coordinates (booking site preferred, falls back to venue). */
  site: { lat: number; lng: number } | null;
  /**
   * Optional drawn geofence (GeoJSON Polygon) for the site. When present,
   * "on-site" means inside this boundary: distance is measured to the polygon
   * edge (0 when the guard is inside it) instead of to the single site pin, so
   * a guard who entered from the far side of a large site reads as on-site.
   */
  polygon?: unknown;
  /** Per-shift-type ladder adjustments. See `defaultThresholds` for shape. */
  thresholds?: TravelRiskThresholds;
};

export type TravelRiskThresholds = {
  /** R3 trigger: minutes before start when ring opens. Default 30. */
  r3MinutesBefore: number;
  /** R4 trigger: minutes before start. Default 15. */
  r4MinutesBefore: number;
  /** R5 trigger: minutes before start. Default 5. */
  r5MinutesBefore: number;
  /** R6 trigger: minutes after start when we declare no-show. Default 10. */
  r6MinutesAfter: number;
  /** R3 distance threshold (metres). Default 15_000. */
  r3DistanceM: number;
  /** R4 distance threshold (metres). Default 5_000. */
  r4DistanceM: number;
  /** R5 distance threshold (metres). Default 1_000. */
  r5DistanceM: number;
  /** GPS staleness for R3 ring (seconds). Default 900 = 15 min. */
  r3GpsStaleSeconds: number;
  /** GPS staleness for R4 ring. Default 600 = 10 min. */
  r4GpsStaleSeconds: number;
  /** GPS staleness for R5 ring. Default 300 = 5 min. */
  r5GpsStaleSeconds: number;
  /**
   * Discard GPS fixes whose accuracy radius exceeds this many metres for
   * distance checks (they tell us nothing about whether the guard is at the
   * site). Heartbeat-only fixes still count for staleness. Default 250.
   */
  gpsAccuracyFloorM: number;
};

/**
 * Default ring distance + timing thresholds.
 *
 * Distance cascade: 5 km (R3) → 2 km (R4) → 500 m (R5).
 *   - 5 km is "concerning" at T-30m (yellow flag).
 *   - 2 km is "should be very close by now" at T-15m (amber).
 *   - 500 m is "should basically be on site" at T-5m (red — sourcing cover).
 *
 * Timing defaults assume a single-guard shift adjusted later via
 * `adjustThresholdsForShiftType`. Cover sourcing (R5) defaults to T-5m here;
 * the single-guard ladder shifts it to T-15m so sourcing begins early enough
 * to fill before the venue is exposed.
 *
 * All numeric values can be overridden by env vars (see resolveThresholdsFromEnv).
 */
export const defaultThresholds: TravelRiskThresholds = {
  r3MinutesBefore: 30,
  r4MinutesBefore: 15,
  r5MinutesBefore: 5,
  r6MinutesAfter: 10,
  r3DistanceM: 5_000,
  r4DistanceM: 2_000,
  r5DistanceM: 500,
  r3GpsStaleSeconds: 900,
  r4GpsStaleSeconds: 600,
  r5GpsStaleSeconds: 300,
  gpsAccuracyFloorM: 250,
};

/**
 * Apply per-shift-type adjustments to the default ladder. Spec §4.
 *
 * `singleGuardDoor`: shift R5 from T-5m → T-15m so we start sourcing earlier.
 * `multiGuardEvent`: shift R5 from T-5m → T+5m (one missing person isn't catastrophic);
 *                    R6 also pushes from T+10m → T+15m to give a slightly larger grace.
 * `urgent`:          shift every pre-shift ring 15 min earlier (more aggressive).
 * `criticalVenue`:   shift R5 to T-20m and R6 to T+5m. For premium venue contracts.
 * `rural`:           multiply all distance thresholds by `ruralMultiplier` (default 2.5x)
 *                    so a village venue with sparse landmarks doesn't trip false positives.
 */
export function adjustThresholdsForShiftType(
  base: TravelRiskThresholds,
  flags: {
    singleGuardDoor?: boolean;
    multiGuardEvent?: boolean;
    urgent?: boolean;
    criticalVenue?: boolean;
    rural?: boolean;
    /** Multiplier applied to R3/R4/R5 distances when `rural` is true. Default 2.5. */
    ruralMultiplier?: number;
  },
): TravelRiskThresholds {
  let out = { ...base };

  // Order matters: apply timing shifts before urgent so urgent's +15 stacks on top.
  if (flags.singleGuardDoor) {
    out = { ...out, r5MinutesBefore: 15 };
  }
  if (flags.multiGuardEvent) {
    // R5 fires 5 minutes AFTER scheduled start instead of before.
    out = { ...out, r5MinutesBefore: -5, r6MinutesAfter: 15 };
  }
  if (flags.criticalVenue) {
    // Premium venue tier: source even earlier than single-guard, no-show faster.
    out = { ...out, r5MinutesBefore: 20, r6MinutesAfter: 5 };
  }
  if (flags.urgent) {
    out = {
      ...out,
      r3MinutesBefore: out.r3MinutesBefore + 15,
      r4MinutesBefore: out.r4MinutesBefore + 15,
      r5MinutesBefore: out.r5MinutesBefore + 15,
    };
  }

  if (flags.rural) {
    const m = Number.isFinite(flags.ruralMultiplier) && (flags.ruralMultiplier as number) > 0
      ? (flags.ruralMultiplier as number)
      : 2.5;
    out = {
      ...out,
      r3DistanceM: Math.round(out.r3DistanceM * m),
      r4DistanceM: Math.round(out.r4DistanceM * m),
      r5DistanceM: Math.round(out.r5DistanceM * m),
    };
  }

  return out;
}

/**
 * Resolve thresholds from environment variables, falling back to `defaultThresholds`.
 * Lets ops tune the platform from Vercel without redeploying.
 *
 *   TRAVEL_RISK_R3_DISTANCE_M, TRAVEL_RISK_R4_DISTANCE_M, TRAVEL_RISK_R5_DISTANCE_M
 *   TRAVEL_RISK_R3_MINUTES_BEFORE, TRAVEL_RISK_R4_MINUTES_BEFORE, TRAVEL_RISK_R5_MINUTES_BEFORE
 *   TRAVEL_RISK_R6_MINUTES_AFTER
 *   TRAVEL_RISK_GPS_ACCURACY_FLOOR_M
 *   TRAVEL_RISK_RURAL_MULTIPLIER
 */
export function resolveThresholdsFromEnv(
  env: Record<string, string | undefined> = process.env,
): TravelRiskThresholds {
  const num = (key: string, fallback: number): number => {
    const v = Number(env[key]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    r3MinutesBefore: num("TRAVEL_RISK_R3_MINUTES_BEFORE", defaultThresholds.r3MinutesBefore),
    r4MinutesBefore: num("TRAVEL_RISK_R4_MINUTES_BEFORE", defaultThresholds.r4MinutesBefore),
    r5MinutesBefore: num("TRAVEL_RISK_R5_MINUTES_BEFORE", defaultThresholds.r5MinutesBefore),
    r6MinutesAfter: num("TRAVEL_RISK_R6_MINUTES_AFTER", defaultThresholds.r6MinutesAfter),
    r3DistanceM: num("TRAVEL_RISK_R3_DISTANCE_M", defaultThresholds.r3DistanceM),
    r4DistanceM: num("TRAVEL_RISK_R4_DISTANCE_M", defaultThresholds.r4DistanceM),
    r5DistanceM: num("TRAVEL_RISK_R5_DISTANCE_M", defaultThresholds.r5DistanceM),
    r3GpsStaleSeconds: defaultThresholds.r3GpsStaleSeconds,
    r4GpsStaleSeconds: defaultThresholds.r4GpsStaleSeconds,
    r5GpsStaleSeconds: defaultThresholds.r5GpsStaleSeconds,
    gpsAccuracyFloorM: num("TRAVEL_RISK_GPS_ACCURACY_FLOOR_M", defaultThresholds.gpsAccuracyFloorM),
  };
}

export function ruralMultiplierFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  const v = Number(env["TRAVEL_RISK_RURAL_MULTIPLIER"]);
  return Number.isFinite(v) && v > 0 ? v : 2.5;
}

export type TravelRiskOutput = {
  ring: TravelRing;
  reason: string;
  /** Distance to site in metres if we could compute one (null otherwise). */
  distanceM: number | null;
  /** Age of the latest GPS fix in seconds, or null if there is none. */
  gpsAgeSeconds: number | null;
  /** Minutes from now() to scheduled_start (negative = past start). */
  minutesToStart: number;
};

const ACCEPTED_STATUSES = new Set(["accepted"]);

/** Haversine in metres. Inlined to keep the engine zero-dependency. */
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δφ = ((bLat - aLat) * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateTravelRisk(input: TravelRiskInput): TravelRiskOutput {
  const t = input.thresholds ?? defaultThresholds;
  const startMs = Date.parse(input.scheduledStartIso);
  const nowMs = input.now.getTime();
  const minutesToStart = Math.round((startMs - nowMs) / 60000);

  // R6 first — if status is still `accepted` past the no-show grace, that
  // beats every other ring regardless of distance/GPS.
  if (ACCEPTED_STATUSES.has(input.status) && -minutesToStart >= t.r6MinutesAfter) {
    return {
      ring: "R6",
      reason: `still accepted ${-minutesToStart} min past start — no check-in`,
      distanceM: null,
      gpsAgeSeconds: ageSeconds(input.latestGps, input.now),
      minutesToStart,
    };
  }

  // Outside the eval window or wrong status → none.
  if (!ACCEPTED_STATUSES.has(input.status)) {
    return {
      ring: "none",
      reason: `status='${input.status}' — engine ignores`,
      distanceM: null,
      gpsAgeSeconds: ageSeconds(input.latestGps, input.now),
      minutesToStart,
    };
  }

  const distanceM = computeDistance(input);
  const gpsAge = ageSeconds(input.latestGps, input.now);

  // Pick the tightest ring whose time window has opened. The engine returns
  // the *highest* (most severe) ring that currently applies — so a shift that
  // is in the R5 window with no GPS gets R5, not R3, even though R3's
  // criteria are also met.
  if (minutesToStart <= t.r5MinutesBefore) {
    const trigger = ringTrigger(distanceM, gpsAge, t.r5DistanceM, t.r5GpsStaleSeconds);
    if (trigger) {
      return {
        ring: "R5",
        reason: `red @ T${formatT(minutesToStart)}: ${trigger}`,
        distanceM,
        gpsAgeSeconds: gpsAge,
        minutesToStart,
      };
    }
  }
  if (minutesToStart <= t.r4MinutesBefore) {
    const trigger = ringTrigger(distanceM, gpsAge, t.r4DistanceM, t.r4GpsStaleSeconds);
    if (trigger) {
      return {
        ring: "R4",
        reason: `amber @ T${formatT(minutesToStart)}: ${trigger}`,
        distanceM,
        gpsAgeSeconds: gpsAge,
        minutesToStart,
      };
    }
  }
  if (minutesToStart <= t.r3MinutesBefore) {
    const trigger = ringTrigger(distanceM, gpsAge, t.r3DistanceM, t.r3GpsStaleSeconds);
    if (trigger) {
      return {
        ring: "R3",
        reason: `status unclear @ T${formatT(minutesToStart)}: ${trigger}`,
        distanceM,
        gpsAgeSeconds: gpsAge,
        minutesToStart,
      };
    }
  }

  return {
    ring: "none",
    reason: "on track",
    distanceM,
    gpsAgeSeconds: gpsAge,
    minutesToStart,
  };
}

/** "+5" / "-12" / "0" — for human-readable reasons. */
function formatT(minutesToStart: number): string {
  if (minutesToStart === 0) return "0";
  return minutesToStart > 0 ? `-${minutesToStart}m` : `+${-minutesToStart}m`;
}

function ageSeconds(
  gps: TravelRiskInput["latestGps"],
  now: Date,
): number | null {
  if (!gps) return null;
  const recordedMs = Date.parse(gps.recorded_at);
  if (!Number.isFinite(recordedMs)) return null;
  return Math.max(0, Math.round((now.getTime() - recordedMs) / 1000));
}

function computeDistance(input: TravelRiskInput): number | null {
  if (!input.latestGps) return null;
  // Discard wildly inaccurate fixes for distance purposes — a fix with 2 km
  // accuracy tells us nothing about whether the guard is at the site.
  const t = input.thresholds ?? defaultThresholds;
  if (
    typeof input.latestGps.accuracy_m === "number" &&
    input.latestGps.accuracy_m > t.gpsAccuracyFloorM
  ) {
    return null;
  }
  // Prefer the drawn boundary: distance to the polygon edge (0 when inside)
  // is the true "how far from being on site" measure for irregular sites.
  if (isValidPolygon(input.polygon)) {
    return Math.round(
      distanceToPolygonMeters(input.latestGps.lat, input.latestGps.lng, input.polygon),
    );
  }
  if (!input.site) return null;
  return Math.round(
    haversineM(
      input.latestGps.lat,
      input.latestGps.lng,
      input.site.lat,
      input.site.lng,
    ),
  );
}

/**
 * Returns a string explaining why the ring trips for these inputs, or null
 * if neither distance nor staleness condition is met. Distance condition
 * only fires when we have a usable distance — missing GPS shows up as
 * staleness instead.
 */
function ringTrigger(
  distanceM: number | null,
  gpsAgeSeconds: number | null,
  maxDistanceM: number,
  maxStaleSeconds: number,
): string | null {
  if (distanceM === null && gpsAgeSeconds === null) {
    return "no GPS fix yet";
  }
  if (gpsAgeSeconds !== null && gpsAgeSeconds > maxStaleSeconds) {
    return `last GPS ${Math.round(gpsAgeSeconds / 60)} min ago`;
  }
  if (distanceM !== null && distanceM > maxDistanceM) {
    const km = (distanceM / 1000).toFixed(1);
    return `${km} km from site`;
  }
  return null;
}

/**
 * Convert a ring to its severity ordering. Higher = more severe. Used by the
 * cron to detect "the ring just got worse, escalate" vs "ring stayed put".
 */
export function ringSeverity(ring: TravelRing): number {
  switch (ring) {
    case "none":
      return 0;
    case "R3":
      return 1;
    case "R4":
      return 2;
    case "R5":
      return 3;
    case "R6":
      return 4;
  }
}
