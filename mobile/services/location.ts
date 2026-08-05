/**
 * GPS location + geofence service for shift tracking.
 *
 * Uses Expo location updates, logs GPS points to shift_gps_log,
 * and auto-calls /api/shifts/checkin when guard enters/leaves venue radius.
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";
import { fetchApi } from "../lib/api";
import { BACKGROUND_LOCATION_TASK } from "../constants/locationTask";
import {
  distanceToPolygonMeters,
  isValidPolygon,
  type GeoJsonPolygon,
} from "../lib/geo/polygon";

const LOCATION_UPDATE_INTERVAL = 15000;
const LOCATION_DISTANCE_INTERVAL = 10;
const DEFAULT_GEOFENCE_RADIUS_METERS = 100;
// GPS-accuracy buffer applied to a drawn polygon boundary (mirrors the server).
const GEOFENCE_GPS_TOLERANCE_METERS = 25;
const AUTO_CHECKOUT_RADIUS_METERS = 300;
const AUTO_CHECKOUT_OUTSIDE_MS = 5 * 60 * 1000;
// Guards may only check in within this many minutes before scheduled start.
const CHECK_IN_EARLIEST_MINUTES_BEFORE_START = 15;
// GPS uploads to shift_gps_log only happen within this many minutes before
// scheduled start (and through to scheduled end). Outside this window the
// venue should not be able to see the guard's live location.
const TRACKING_EARLIEST_MINUTES_BEFORE_START = 60;

type CheckinAction = "check_in" | "check_out";

type TrackingOptions = {
  authToken?: string | null;
  scheduledStartIso?: string | null;
  scheduledEndIso?: string | null;
  autoCheckIn?: boolean;
  autoCheckOut?: boolean;
};

export type Geofence = {
  id: string;
  shift_id: string;
  lat: number;
  lng: number;
  radius?: number;
  venue_id?: string | null;
  /** Drawn on-site boundary. When present, inside it = on-site (not the radius). */
  polygon?: GeoJsonPolygon | null;
};

interface LocationState {
  isTracking: boolean;
  personnelId: string | null;
  activeShiftId: string | null;
  authToken: string | null;
  scheduledStartIso: string | null;
  scheduledEndIso: string | null;
  autoCheckIn: boolean;
  autoCheckOut: boolean;
  autoCheckInDone: boolean;
  autoCheckOutDone: boolean;
  outsideCheckoutSinceMs: number | null;
  lastLocation: Location.LocationObject | null;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  /** The active booking's drawn on-site boundary, if one is configured. */
  activeGeofencePolygon: GeoJsonPolygon | null;
}

const locationState: LocationState = {
  isTracking: false,
  personnelId: null,
  activeShiftId: null,
  authToken: null,
  scheduledStartIso: null,
  scheduledEndIso: null,
  autoCheckIn: true,
  autoCheckOut: false,
  autoCheckInDone: false,
  autoCheckOutDone: false,
  outsideCheckoutSinceMs: null,
  lastLocation: null,
  hasPermission: false,
  hasBackgroundPermission: false,
  activeGeofencePolygon: null,
};

export type PatrolCheckpoint = {
  id: string;
  lat: number;
  lng: number;
  radius_m: number;
};

let locationSubscription: Location.LocationSubscription | null = null;
let activeGeofences: Geofence[] = [];
let geofenceInsideState: Record<string, boolean> = {};
let activeCheckpoints: PatrolCheckpoint[] = [];
let visitedCheckpointIds: Set<string> = new Set();

export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  locationState.hasPermission = foregroundStatus === "granted";

  if (!locationState.hasPermission) {
    return { foreground: false, background: false };
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  locationState.hasBackgroundPermission = backgroundStatus === "granted";

  return {
    foreground: locationState.hasPermission,
    background: locationState.hasBackgroundPermission,
  };
}

export async function checkLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  locationState.hasPermission = foreground.status === "granted";
  locationState.hasBackgroundPermission = background.status === "granted";

  return {
    foreground: locationState.hasPermission,
    background: locationState.hasBackgroundPermission,
  };
}

export async function startLocationTracking(
  personnelId: string,
  shiftId?: string,
  options?: TrackingOptions
): Promise<boolean> {
  const permissions = await checkLocationPermissions();
  if (!permissions.foreground) {
    console.error("[Location] No foreground permission");
    return false;
  }

  locationState.personnelId = personnelId;
  locationState.activeShiftId = shiftId ?? locationState.activeShiftId;
  locationState.authToken = options?.authToken ?? locationState.authToken;
  locationState.scheduledStartIso = options?.scheduledStartIso ?? locationState.scheduledStartIso;
  locationState.scheduledEndIso = options?.scheduledEndIso ?? locationState.scheduledEndIso;
  locationState.autoCheckIn = options?.autoCheckIn ?? true;
  locationState.autoCheckOut = options?.autoCheckOut ?? false;
  locationState.autoCheckInDone = false;
  locationState.autoCheckOutDone = false;
  locationState.outsideCheckoutSinceMs = null;

  if (options?.scheduledStartIso) {
    const startMs = new Date(options.scheduledStartIso).getTime();
    const earliestMs = startMs - TRACKING_EARLIEST_MINUTES_BEFORE_START * 60_000;
    if (Number.isFinite(startMs) && Date.now() < earliestMs) {
      console.log("[Location] Refusing to start — more than 60 minutes before shift");
      return false;
    }
  }

  if (locationState.isTracking) {
    return true;
  }

  try {
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_UPDATE_INTERVAL,
        distanceInterval: LOCATION_DISTANCE_INTERVAL,
      },
      handleLocationUpdate
    );

    // Force an immediate location evaluation so auto check-in can trigger even
    // when the guard is already stationary inside the geofence.
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await handleLocationUpdate(current);
    } catch (currentErr) {
      console.warn("[Location] Immediate location sample unavailable:", currentErr);
    }

    if (permissions.background) {
      try {
        const taskAvailable = await TaskManager.isAvailableAsync();
        if (!taskAvailable) {
          console.warn(
            "[Location] Background tasks unavailable in this build — using foreground tracking only",
          );
        } else if (Constants.isDevice === false) {
          console.warn(
            "[Location] Skipping background updates on simulator — foreground tracking only",
          );
        } else {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_UPDATE_INTERVAL,
            distanceInterval: LOCATION_DISTANCE_INTERVAL,
            foregroundService: {
              notificationTitle: "Shield - Tracking Active",
              notificationBody: "Your location is being tracked for this shift",
              notificationColor: "#00B4D8",
            },
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
          });
        }
      } catch (bgErr) {
        console.warn("[Location] Background updates unavailable:", bgErr);
      }
    }

    locationState.isTracking = true;
    console.log("[Location] Tracking started");
    return true;
  } catch (error) {
    console.error("[Location] Failed to start tracking:", error);
    return false;
  }
}

export async function stopLocationTracking(): Promise<void> {
  if (!locationState.isTracking) return;

  try {
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }

    const isTaskRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    console.error("[Location] Failed to stop tracking:", error);
  } finally {
    locationState.isTracking = false;
    locationState.personnelId = null;
    locationState.activeShiftId = null;
    locationState.authToken = null;
    locationState.scheduledStartIso = null;
    locationState.scheduledEndIso = null;
    locationState.autoCheckInDone = false;
    locationState.autoCheckOutDone = false;
    locationState.outsideCheckoutSinceMs = null;
    locationState.activeGeofencePolygon = null;
    activeGeofences = [];
    geofenceInsideState = {};
    activeCheckpoints = [];
    visitedCheckpointIds = new Set();
  }
}

export async function setActiveGeofences(geofences: Geofence[]): Promise<void> {
  activeGeofences = geofences.map((g) => ({
    ...g,
    radius: Number.isFinite(g.radius) ? Number(g.radius) : DEFAULT_GEOFENCE_RADIUS_METERS,
  }));
  const polyFence = activeGeofences.find((g) => isValidPolygon(g.polygon));
  locationState.activeGeofencePolygon =
    (polyFence?.polygon as GeoJsonPolygon | null) ?? null;
  geofenceInsideState = {};
  for (const g of activeGeofences) {
    geofenceInsideState[g.id] = false;
    console.log(
      `[Geofence] Active fence ${g.id} shift=${g.shift_id} lat=${g.lat} lng=${g.lng} radius=${Math.round(
        Number(g.radius ?? DEFAULT_GEOFENCE_RADIUS_METERS)
      )}m`
    );
  }
  if (locationState.lastLocation) {
    await checkGeofences(locationState.lastLocation);
  }
}

/** Patrol checkpoints the guard should reach during the shift. */
export async function setActiveCheckpoints(
  checkpoints: PatrolCheckpoint[],
): Promise<void> {
  activeCheckpoints = checkpoints
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => ({ ...c, radius_m: Number.isFinite(c.radius_m) ? c.radius_m : 30 }));
  visitedCheckpointIds = new Set();
  console.log(`[Checkpoints] ${activeCheckpoints.length} active`);
  if (locationState.lastLocation) {
    await checkCheckpoints(locationState.lastLocation);
  }
}

async function checkCheckpoints(location: Location.LocationObject): Promise<void> {
  if (activeCheckpoints.length === 0) return;
  if (!supabase || !locationState.activeShiftId || !locationState.personnelId) return;
  const { latitude, longitude } = location.coords;
  for (const cp of activeCheckpoints) {
    if (visitedCheckpointIds.has(cp.id)) continue;
    const d = calculateDistance(latitude, longitude, cp.lat, cp.lng);
    if (d > cp.radius_m) continue;
    // Mark immediately to avoid duplicate inserts from rapid updates.
    visitedCheckpointIds.add(cp.id);
    const { error } = await supabase.from("checkpoint_visits").insert({
      checkpoint_id: cp.id,
      shift_id: locationState.activeShiftId,
      personnel_id: locationState.personnelId,
      lat: latitude,
      lng: longitude,
      visited_at: new Date().toISOString(),
    } as any);
    if (error && (error as any).code !== "23505") {
      // 23505 = unique violation (already visited this shift) — fine.
      console.warn("[Checkpoints] visit log skipped:", error.message);
      // Keep it marked so we don't hammer the API; a later run re-syncs anyway.
    } else {
      console.log(`[Checkpoints] visit logged for ${cp.id} (${Math.round(d)}m)`);
    }
  }
}

/** Entry point for the background TaskManager task (see tasks/backgroundLocation.ts). */
export async function processLocationUpdate(
  location: Location.LocationObject,
): Promise<void> {
  await handleLocationUpdate(location);
}

async function handleLocationUpdate(location: Location.LocationObject): Promise<void> {
  if (locationState.autoCheckOutDone) {
    await stopLocationTracking();
    return;
  }

  if (locationState.scheduledEndIso) {
    const endMs = new Date(locationState.scheduledEndIso).getTime();
    if (Number.isFinite(endMs) && Date.now() > endMs) {
      if (locationState.autoCheckOut && !locationState.autoCheckOutDone) {
        await autoCheckOut(location.coords.latitude, location.coords.longitude);
      } else {
        await stopLocationTracking();
      }
      return;
    }
  }

  locationState.lastLocation = location;
  try {
    await uploadLocation(location);
    await checkGeofences(location);
    await checkCheckpoints(location);
    await maybeAutoCheckOutOnTime(location);
  } catch (error) {
    console.error("[Location] Error handling update:", error);
  }
}

async function maybeAutoCheckOutOnTime(location: Location.LocationObject): Promise<void> {
  if (!locationState.autoCheckOut || locationState.autoCheckOutDone) return;
  if (!locationState.scheduledEndIso) return;
  if (Date.now() < new Date(locationState.scheduledEndIso).getTime()) return;
  await autoCheckOut(location.coords.latitude, location.coords.longitude);
}

async function uploadLocation(location: Location.LocationObject): Promise<void> {
  if (!supabase || !locationState.activeShiftId || !locationState.personnelId) return;

  if (!isWithinTrackingUploadWindow()) {
    // Suppress GPS uploads outside the 60-minute pre-shift window so the venue
    // can't see the guard until they're approaching the shift.
    return;
  }

  const { latitude, longitude, accuracy, altitude, heading, speed } = location.coords;
  const { error } = await supabase.from("shift_gps_log").insert({
    shift_id: locationState.activeShiftId,
    personnel_id: locationState.personnelId,
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ?? null,
    altitude: altitude ?? null,
    heading: heading ?? null,
    speed: speed ?? null,
    recorded_at: new Date(location.timestamp).toISOString(),
  });

  if (error) {
    const msg = String((error as { message?: string })?.message ?? error);
    const code = String((error as { code?: string })?.code ?? "");
    if (
      msg.includes("Could not find the table") ||
      code === "PGRST205" ||
      code === "42P01"
    ) {
      console.error(
        "[Location] shift_gps_log table missing — apply migration 0050_shift_gps_log.sql in Supabase",
      );
    } else if (
      msg.includes("row-level security") ||
      code === "42501"
    ) {
      console.error(
        "[Location] GPS upload blocked by policy — shift must be assigned to you, in pending/accepted/checked_in, and within the tracking window (60 min before start through shift end).",
        msg,
      );
    } else {
      console.error("[Location] Failed to upload:", code || msg, error);
    }
  }
}

async function checkGeofences(location: Location.LocationObject): Promise<void> {
  if (activeGeofences.length === 0) return;
  const { latitude, longitude } = location.coords;
  const nowMs = Date.now();

  for (const geofence of activeGeofences) {
    // Prefer the drawn boundary: distance to the polygon edge (0 inside),
    // expanded by a small GPS tolerance. Falls back to the pin + radius.
    const hasPolygon = isValidPolygon(geofence.polygon);
    const distanceMeters = hasPolygon
      ? distanceToPolygonMeters(latitude, longitude, geofence.polygon)
      : calculateDistance(latitude, longitude, geofence.lat, geofence.lng);
    const insideCheckin = hasPolygon
      ? distanceMeters <= GEOFENCE_GPS_TOLERANCE_METERS
      : distanceMeters <= (geofence.radius ?? DEFAULT_GEOFENCE_RADIUS_METERS);
    const outsideCheckout = distanceMeters > AUTO_CHECKOUT_RADIUS_METERS;
    const wasInside = geofenceInsideState[geofence.id] === true;

    if (distanceMeters <= 2000) {
      console.log(
        `[Geofence] probe shift=${geofence.shift_id} distance=${Math.round(distanceMeters)}m inside=${insideCheckin} ` +
          `user=(${latitude.toFixed(6)},${longitude.toFixed(6)}) venue=(${geofence.lat.toFixed(6)},${geofence.lng.toFixed(6)})`
      );
    }

    if (insideCheckin && !wasInside) {
      geofenceInsideState[geofence.id] = true;
      await handleGeofenceEvent(geofence, "enter", latitude, longitude, distanceMeters);
    }

    if (!insideCheckin && wasInside) {
      geofenceInsideState[geofence.id] = false;
      await handleGeofenceEvent(geofence, "exit", latitude, longitude, distanceMeters);
    }
  }
}

async function handleGeofenceEvent(
  geofence: Geofence,
  eventType: "enter" | "exit",
  lat: number,
  lng: number,
  distanceMeters: number
): Promise<void> {
  console.log(
    `[Geofence] ${eventType} ${geofence.id} distance=${Math.round(distanceMeters)}m shift=${geofence.shift_id}`
  );

  if (!supabase) return;
  if (locationState.personnelId && locationState.activeShiftId) {
    const { error } = await supabase.from("geofence_events").insert({
      personnel_id: locationState.personnelId,
      shift_id: locationState.activeShiftId,
      geofence_id: geofence.id,
      event_type: eventType,
      lat,
      lng,
      auto_action_taken: eventType === "enter" ? "check_in" : "none",
      occurred_at: new Date().toISOString(),
    } as any);
    if (error) {
      console.warn("[Geofence] Event log skipped:", error.message);
    }
  }

  if (eventType === "enter" && locationState.autoCheckIn && !locationState.autoCheckInDone) {
    if (!isWithinCheckInWindow()) {
      const earliest = earliestCheckInIso();
      console.log(
        `[Geofence] Inside venue but auto check-in suppressed — earliest allowed: ${earliest ?? "unknown"}`
      );
      return;
    }
    await autoCheckIn(lat, lng);
  }
}

function isWithinCheckInWindow(): boolean {
  if (!locationState.scheduledStartIso) {
    // No schedule info -> don't enforce client-side; let server be the source of truth.
    return true;
  }
  const startMs = new Date(locationState.scheduledStartIso).getTime();
  if (!Number.isFinite(startMs)) return true;
  const earliestMs = startMs - CHECK_IN_EARLIEST_MINUTES_BEFORE_START * 60_000;
  return Date.now() >= earliestMs;
}

function isWithinTrackingUploadWindow(): boolean {
  // Without schedule info we don't know when to start, so be conservative
  // and DON'T upload — venue should never see GPS from a shift we don't know
  // the timing of.
  if (!locationState.scheduledStartIso) return false;
  const startMs = new Date(locationState.scheduledStartIso).getTime();
  if (!Number.isFinite(startMs)) return false;
  const earliestMs = startMs - TRACKING_EARLIEST_MINUTES_BEFORE_START * 60_000;
  if (Date.now() < earliestMs) return false;
  // Stop uploading once the shift has ended (auto-checkout already handles
  // closing the shift; no need to keep tracking afterwards).
  if (locationState.scheduledEndIso) {
    const endMs = new Date(locationState.scheduledEndIso).getTime();
    if (Number.isFinite(endMs) && Date.now() > endMs) return false;
  }
  return true;
}

function earliestCheckInIso(): string | null {
  if (!locationState.scheduledStartIso) return null;
  const startMs = new Date(locationState.scheduledStartIso).getTime();
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs - CHECK_IN_EARLIEST_MINUTES_BEFORE_START * 60_000).toISOString();
}

async function resolveAuthToken(): Promise<string | null> {
  if (locationState.authToken) return locationState.authToken;
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function shouldTreatAsAlreadyDone(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("already checked in") || m.includes("already checked out");
}

async function callShiftCheckinApi(action: CheckinAction, lat: number, lng: number): Promise<boolean> {
  if (!locationState.activeShiftId) return false;
  const token = await resolveAuthToken();
  if (!token) return false;

  const res = await fetchApi("/api/shifts/checkin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shift_id: locationState.activeShiftId,
      action,
      latitude: lat,
      longitude: lng,
      // Android exposes whether the fix came from a mock-location provider.
      mocked: locationState.lastLocation?.mocked === true,
    }),
  });

  const raw = await res.text();
  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    const message = String(parsed?.error || raw || `HTTP ${res.status}`);
    if (shouldTreatAsAlreadyDone(message)) return true;
    console.warn(
      `[Geofence] ${action} failed for shift ${locationState.activeShiftId}:`,
      message
    );
    return false;
  }
  return true;
}

async function autoCheckIn(lat: number, lng: number): Promise<void> {
  if (locationState.autoCheckInDone) return;
  const ok = await callShiftCheckinApi("check_in", lat, lng);
  if (ok) {
    locationState.autoCheckInDone = true;
    console.log("[Geofence] Auto check-in successful");
  }
}

async function autoCheckOut(lat: number, lng: number): Promise<void> {
  if (locationState.autoCheckOutDone) return;
  const ok = await callShiftCheckinApi("check_out", lat, lng);
  if (ok) {
    locationState.autoCheckOutDone = true;
    console.log("[Geofence] Auto check-out successful");
    await stopLocationTracking();
  }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function getLocationState(): LocationState {
  return { ...locationState };
}

export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  if (!locationState.hasPermission) {
    const permissions = await requestLocationPermissions();
    if (!permissions.foreground) return null;
  }
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    locationState.lastLocation = location;
    return location;
  } catch (error) {
    console.error("[Location] Failed to get current location:", error);
    return null;
  }
}
