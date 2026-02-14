/**
 * GPS Location Tracking Service
 * 
 * Handles:
 * - Location permissions
 * - Foreground/background tracking during shifts
 * - Uploading coordinates to Supabase
 * - Geofence detection
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "../lib/supabase";

const LOCATION_TASK_NAME = "background-location-tracking";
const LOCATION_UPDATE_INTERVAL = 60000; // 1 minute in ms
const LOCATION_DISTANCE_INTERVAL = 50; // 50 meters minimum movement

// Types
interface LocationState {
  isTracking: boolean;
  currentAssignmentId: string | null;
  agencyStaffId: string | null;
  lastLocation: Location.LocationObject | null;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
}

interface Geofence {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  venue_id: string;
}

// State
let locationState: LocationState = {
  isTracking: false,
  currentAssignmentId: null,
  agencyStaffId: null,
  lastLocation: null,
  hasPermission: false,
  hasBackgroundPermission: false,
};

let locationSubscription: Location.LocationSubscription | null = null;
let activeGeofences: Geofence[] = [];
let geofenceState: Record<string, boolean> = {}; // Track if inside each geofence

// ===========================
// Permission Management
// ===========================

export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  // Request foreground permission first
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  locationState.hasPermission = foregroundStatus === "granted";

  if (!locationState.hasPermission) {
    return { foreground: false, background: false };
  }

  // Request background permission
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

// ===========================
// Location Tracking
// ===========================

export async function startLocationTracking(
  agencyStaffId: string,
  assignmentId?: string
): Promise<boolean> {
  if (locationState.isTracking) {
    console.log("[Location] Already tracking");
    return true;
  }

  // Check permissions
  const permissions = await checkLocationPermissions();
  if (!permissions.foreground) {
    console.error("[Location] No foreground permission");
    return false;
  }

  locationState.agencyStaffId = agencyStaffId;
  locationState.currentAssignmentId = assignmentId || null;

  try {
    // Start foreground location updates
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_UPDATE_INTERVAL,
        distanceInterval: LOCATION_DISTANCE_INTERVAL,
      },
      handleLocationUpdate
    );

    // If we have background permission, register background task
    if (permissions.background) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
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
    // Stop foreground tracking
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }

    // Stop background tracking
    const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    locationState.isTracking = false;
    locationState.currentAssignmentId = null;
    locationState.agencyStaffId = null;
    activeGeofences = [];
    geofenceState = {};

    console.log("[Location] Tracking stopped");
  } catch (error) {
    console.error("[Location] Failed to stop tracking:", error);
  }
}

async function handleLocationUpdate(location: Location.LocationObject): Promise<void> {
  locationState.lastLocation = location;

  if (!locationState.agencyStaffId) return;

  try {
    // Upload to Supabase
    await uploadLocation(location);

    // Check geofences
    await checkGeofences(location);
  } catch (error) {
    console.error("[Location] Error handling update:", error);
  }
}

async function uploadLocation(location: Location.LocationObject): Promise<void> {
  if (!locationState.agencyStaffId) return;

  const { latitude, longitude, accuracy, altitude, heading, speed } = location.coords;

  const { error } = await supabase.from("staff_locations").insert({
    agency_staff_id: locationState.agencyStaffId,
    booking_assignment_id: locationState.currentAssignmentId,
    lat: latitude,
    lng: longitude,
    accuracy: accuracy || null,
    altitude: altitude || null,
    heading: heading || null,
    speed: speed || null,
    recorded_at: new Date(location.timestamp).toISOString(),
  });

  if (error) {
    console.error("[Location] Failed to upload:", error);
  }
}

// ===========================
// Geofencing
// ===========================

export async function setActiveGeofences(geofences: Geofence[]): Promise<void> {
  activeGeofences = geofences;
  
  // Initialize geofence state (assume outside all initially)
  geofenceState = {};
  geofences.forEach((g) => {
    geofenceState[g.id] = false;
  });

  // Check current position against geofences
  if (locationState.lastLocation) {
    await checkGeofences(locationState.lastLocation);
  }
}

async function checkGeofences(location: Location.LocationObject): Promise<void> {
  if (activeGeofences.length === 0) return;

  const { latitude, longitude } = location.coords;

  for (const geofence of activeGeofences) {
    const distance = calculateDistance(
      latitude,
      longitude,
      geofence.lat,
      geofence.lng
    );

    const isInside = distance <= geofence.radius;
    const wasInside = geofenceState[geofence.id];

    if (isInside && !wasInside) {
      // Entered geofence
      geofenceState[geofence.id] = true;
      await handleGeofenceEvent(geofence, "enter", latitude, longitude);
    } else if (!isInside && wasInside) {
      // Exited geofence
      geofenceState[geofence.id] = false;
      await handleGeofenceEvent(geofence, "exit", latitude, longitude);
    }
  }
}

async function handleGeofenceEvent(
  geofence: Geofence,
  eventType: "enter" | "exit",
  lat: number,
  lng: number
): Promise<void> {
  console.log(`[Geofence] ${eventType} event for geofence ${geofence.id}`);

  if (!locationState.currentAssignmentId) return;

  // Record the event
  const { error: eventError } = await supabase.from("geofence_events").insert({
    booking_assignment_id: locationState.currentAssignmentId,
    geofence_id: geofence.id,
    event_type: eventType,
    lat,
    lng,
    auto_action_taken: eventType === "enter" ? "check_in" : "check_out",
  });

  if (eventError) {
    console.error("[Geofence] Failed to record event:", eventError);
    return;
  }

  // Auto check-in/check-out
  if (eventType === "enter") {
    await autoCheckIn(lat, lng);
  } else {
    await autoCheckOut(lat, lng);
  }
}

async function autoCheckIn(lat: number, lng: number): Promise<void> {
  if (!locationState.currentAssignmentId) return;

  const { error } = await supabase
    .from("booking_assignments")
    .update({
      check_in_at: new Date().toISOString(),
      check_in_lat: lat,
      check_in_lng: lng,
      status: "confirmed",
    })
    .eq("id", locationState.currentAssignmentId)
    .is("check_in_at", null); // Only if not already checked in

  if (error) {
    console.error("[Geofence] Auto check-in failed:", error);
  } else {
    console.log("[Geofence] Auto check-in successful");
  }
}

async function autoCheckOut(lat: number, lng: number): Promise<void> {
  if (!locationState.currentAssignmentId) return;

  const { error } = await supabase
    .from("booking_assignments")
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
    })
    .eq("id", locationState.currentAssignmentId)
    .not("check_in_at", "is", null) // Must have checked in
    .is("check_out_at", null); // Only if not already checked out

  if (error) {
    console.error("[Geofence] Auto check-out failed:", error);
  } else {
    console.log("[Geofence] Auto check-out successful");
  }
}

// ===========================
// Utility Functions
// ===========================

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Haversine formula
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (error) {
    console.error("[Location] Failed to get current location:", error);
    return null;
  }
}

// ===========================
// Background Task Definition
// ===========================

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[Background Location] Task error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      await handleLocationUpdate(location);
    }
  }
});
