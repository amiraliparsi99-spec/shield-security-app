/**
 * React hook for location tracking
 * 
 * Provides easy-to-use interface for components to:
 * - Start/stop tracking
 * - Get current location
 * - Check permissions
 * - Monitor tracking state
 */

import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import {
  requestLocationPermissions,
  checkLocationPermissions,
  startLocationTracking,
  stopLocationTracking,
  setActiveGeofences,
  getLocationState,
  getCurrentLocation,
} from "../services/location";
import { supabase } from "../lib/supabase";

interface UseLocationTrackingReturn {
  // State
  isTracking: boolean;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  currentLocation: Location.LocationObject | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  requestPermissions: () => Promise<boolean>;
  startTracking: (
    personnelId: string,
    shiftId?: string,
    options?: {
      authToken?: string | null;
      scheduledStartIso?: string | null;
      scheduledEndIso?: string | null;
      autoCheckIn?: boolean;
      autoCheckOut?: boolean;
    }
  ) => Promise<boolean>;
  stopTracking: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  loadGeofencesForBooking: (bookingId: string, shiftId: string) => Promise<void>;
}

export function useLocationTracking(): UseLocationTrackingReturn {
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const permissions = await checkLocationPermissions();
    setHasPermission(permissions.foreground);
    setHasBackgroundPermission(permissions.background);
    
    const state = getLocationState();
    setIsTracking(state.isTracking);
    setCurrentLocation(state.lastLocation);
  };

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const permissions = await requestLocationPermissions();
      setHasPermission(permissions.foreground);
      setHasBackgroundPermission(permissions.background);

      if (!permissions.foreground) {
        setError("Location permission denied. Please enable in settings.");
        return false;
      }

      if (!permissions.background) {
        setError("Background location not enabled. Tracking will only work while app is open.");
      }

      return permissions.foreground;
    } catch (err: any) {
      setError(err.message || "Failed to request permissions");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startTracking = useCallback(
    async (
      personnelId: string,
      shiftId?: string,
      options?: {
        authToken?: string | null;
        scheduledStartIso?: string | null;
        scheduledEndIso?: string | null;
        autoCheckIn?: boolean;
        autoCheckOut?: boolean;
      }
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Ensure permissions
        if (!hasPermission) {
          const granted = await requestPermissions();
          if (!granted) return false;
        }

        const success = await startLocationTracking(personnelId, shiftId, options);
        
        if (success) {
          setIsTracking(true);
          // Get initial location
          const location = await getCurrentLocation();
          if (location) {
            setCurrentLocation(location);
          }
        } else {
          setError("Failed to start location tracking");
        }

        return success;
      } catch (err: any) {
        setError(err.message || "Failed to start tracking");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [hasPermission, requestPermissions]
  );

  const stopTracking = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await stopLocationTracking();
      setIsTracking(false);
    } catch (err: any) {
      setError(err.message || "Failed to stop tracking");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshLocation = useCallback(async (): Promise<void> => {
    setIsLoading(true);

    try {
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
      }
    } catch (err: any) {
      setError(err.message || "Failed to get location");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadGeofencesForBooking = useCallback(async (bookingId: string, shiftId: string): Promise<void> => {
    if (!supabase) return;
    try {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("venue_id, site_latitude, site_longitude")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("[Geofence] Failed to get booking:", bookingError);
        return;
      }

      const isValidCoord = (v: unknown): v is number =>
        v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) !== 0;

      let lat = booking.site_latitude;
      let lng = booking.site_longitude;
      const hasSiteCoords = isValidCoord(lat) && isValidCoord(lng);

      if (!hasSiteCoords) {
        const { data: venue, error: venueError } = await supabase
          .from("venues")
          .select("latitude, longitude")
          .eq("id", booking.venue_id)
          .single();

        if (venueError || !venue) {
          console.warn("[Geofence] Failed to resolve venue coordinates:", venueError?.message);
          return;
        }
        lat = venue.latitude;
        lng = venue.longitude;
      }

      if (!isValidCoord(lat) || !isValidCoord(lng)) {
        console.warn("[Geofence] Booking/venue has no valid coordinates — skipping geofence");
        return;
      }

      const numLat = Number(lat);
      const numLng = Number(lng);
      await setActiveGeofences([
        {
          id: `booking-${bookingId}`,
          shift_id: shiftId,
          venue_id: booking.venue_id,
          lat: numLat,
          lng: numLng,
          radius: 100,
        },
      ]);
      console.log(`[Geofence] Loaded derived geofence for booking ${bookingId} lat=${numLat} lng=${numLng}`);
    } catch (err) {
      console.error("[Geofence] Error loading geofences:", err);
    }
  }, []);

  return {
    isTracking,
    hasPermission,
    hasBackgroundPermission,
    currentLocation,
    isLoading,
    error,
    requestPermissions,
    startTracking,
    stopTracking,
    refreshLocation,
    loadGeofencesForBooking,
  };
}
