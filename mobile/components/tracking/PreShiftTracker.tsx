/**
 * PreShiftTracker
 *
 * Mounts globally in _layout.tsx. For any accepted shift starting within the
 * next 1 hour, it silently starts background GPS tracking so the venue can
 * see the guard "en route" on the live map before the shift begins.
 *
 * - Only runs for personnel accounts (personnelId must be set).
 * - Polls every 60 s for the next upcoming accepted shift.
 * - Avoids duplicate starts via a ref that remembers the active shift ID.
 * - Automatically stops tracking when the shift is no longer relevant
 *   (e.g. cancelled, already checked in, etc.).
 *
 * NOTE: This is the 1-hour pre-shift "venue can see me en route" window.
 * Auto check-in opens at 15 min before start (separate gate). Auto
 * check-out fires at scheduled end. The location service also enforces
 * the 1-hour upload gate as a backstop, in case the guard manually starts
 * tracking earlier from the shift screen.
 */

import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "../../stores";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { supabase } from "../../lib/supabase";

const PRE_SHIFT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const POLL_INTERVAL_MS = 30_000; // 30 seconds — recover quickly if tracking ever stops

export function PreShiftTracker() {
  const { personnelId, user } = useAuthStore();
  const {
    isTracking,
    hasPermission,
    requestPermissions,
    startTracking,
    stopTracking,
    loadGeofencesForBooking,
  } = useLocationTracking();

  const activeShiftRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndStartTracking = useCallback(async () => {
    try {
      if (!supabase || !personnelId || !user) return;

      const now = new Date();
      const windowEnd = new Date(now.getTime() + PRE_SHIFT_WINDOW_MS);

      // Match shifts that are accepted OR already checked in. If a guard
      // somehow stops tracking mid-shift (force-quit, OS killed background
      // task, etc.) we want to re-start it on the next poll.
      const { data: shifts, error } = await supabase
        .from("shifts")
        .select("id, booking_id, scheduled_start, scheduled_end, status")
        .eq("personnel_id", personnelId)
        .in("status", ["accepted", "checked_in"])
        .lte("scheduled_start", windowEnd.toISOString())
        .gte("scheduled_end", now.toISOString())
        .order("scheduled_start", { ascending: true })
        .limit(1);

      if (error || !shifts || shifts.length === 0) return;

      const nextShift = shifts[0];

      if (isTracking && activeShiftRef.current === nextShift.id) return;
      if (isTracking && activeShiftRef.current && activeShiftRef.current !== nextShift.id) {
        await stopTracking();
      }

      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      try {
        await loadGeofencesForBooking(nextShift.booking_id, nextShift.id);
      } catch {
        // continue without geofences
      }

      const success = await startTracking(personnelId, nextShift.id, {
        authToken: session.access_token,
        scheduledStartIso: nextShift.scheduled_start,
        scheduledEndIso: nextShift.scheduled_end,
        autoCheckIn: true,
        autoCheckOut: false,
      });

      if (success) {
        activeShiftRef.current = nextShift.id;
        console.log(`[PreShiftTracker] Started tracking for shift ${nextShift.id} (starts ${nextShift.scheduled_start})`);
      }
    } catch (err) {
      console.warn("[PreShiftTracker] Error (non-fatal):", err);
    }
  }, [
    personnelId,
    user,
    isTracking,
    hasPermission,
    requestPermissions,
    startTracking,
    stopTracking,
    loadGeofencesForBooking,
  ]);

  // Run on mount and poll every minute
  useEffect(() => {
    if (!personnelId) return;

    checkAndStartTracking();
    pollRef.current = setInterval(checkAndStartTracking, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [personnelId, checkAndStartTracking]);

  // Re-check when app comes to foreground
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && personnelId) {
        checkAndStartTracking();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [personnelId, checkAndStartTracking]);

  return null;
}
