/**
 * Active Shift Screen
 * 
 * Shows current shift details and location tracking status
 * Personnel can see their tracking state and manually check in/out if needed
 * Enhanced with animations and modern UI
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { colors, gradients, spacing, radius } from "../../theme";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { supabase } from "../../lib/supabase";
import { fetchApi } from "../../lib/api";
import { isMissingColumnError } from "../../lib/postgresErrors";
import { bookingDirectionsLine } from "../../lib/bookingDirections";
import { BackButton } from "../../components/ui/BackButton";
import { AnimatedBackground } from "../../components/ui/AnimatedBackground";
import { LiveIndicator } from "../../components/ui/LiveIndicator";

interface ShiftData {
  id: string;
  booking_id: string;
  personnel_id: string;
  role: string;
  hourly_rate: number;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  venue_confirmed: boolean;
  // Cover sourcing state — populated by the pre-shift travel risk cron.
  // null when not in cover search; integer 1-3 once a wave is active.
  cover_search_wave?: number | null;
  cover_search_started_at?: string | null;
  travel_risk?: string | null;
  booking: {
    id: string;
    event_name: string;
    event_date: string;
    start_time: string;
    end_time: string;
    brief_notes?: string | null;
    site_label?: string | null;
    site_address_text?: string | null;
    venue_location?: {
      label?: string | null;
      address_line1?: string | null;
      city?: string | null;
      postcode?: string | null;
    } | null;
    venue: {
      id: string;
      name: string;
      address_line1: string | null;
      city: string;
      postcode?: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  };
}

const SHIFT_SELECT_WITH_SITE_ADDRESS = `
          id,
          booking_id,
          personnel_id,
          role,
          hourly_rate,
          status,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          check_in_latitude,
          check_in_longitude,
          venue_confirmed,
          cover_search_wave,
          cover_search_started_at,
          travel_risk,
          booking:bookings(
            id,
            event_name,
            event_date,
            start_time,
            end_time,
            brief_notes,
            site_label,
            site_address_text,
            venue_location:venue_locations!venue_location_id(label, address_line1, city, postcode),
            venue:venues(id, name, address_line1, city, postcode, latitude, longitude)
          )
        `;

const SHIFT_SELECT_LEGACY = `
          id,
          booking_id,
          personnel_id,
          role,
          hourly_rate,
          status,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          check_in_latitude,
          check_in_longitude,
          venue_confirmed,
          booking:bookings(
            id,
            event_name,
            event_date,
            start_time,
            end_time,
            brief_notes,
            site_label,
            venue:venues(id, name, address_line1, city, postcode, latitude, longitude)
          )
        `;

export default function ShiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkinActionLoading, setCheckinActionLoading] = useState(false);

  const extractAttireRequirement = (briefNotes?: string | null): string | null => {
    if (!briefNotes) return null;
    const match = briefNotes.match(/Attire requirement:\s*(.+)/i);
    return match?.[1]?.trim() || null;
  };

  const {
    isTracking,
    hasPermission,
    hasBackgroundPermission,
    currentLocation,
    isLoading: locationLoading,
    error: locationError,
    requestPermissions,
    startTracking,
    stopTracking,
    loadGeofencesForBooking,
  } = useLocationTracking();

  useEffect(() => {
    if (id) {
      loadShift();
    }
  }, [id]);

  // Foreground auto-checkout: while the guard is checked in, watch the clock
  // and fire the checkout the instant scheduled end is reached. The server
  // cron is the safety net; this is the instant-UX path for an open app.
  const autoCheckoutFiredRef = useRef(false);
  useEffect(() => {
    if (!shift) return;
    if (shift.status !== "checked_in") return;
    if (shift.actual_end) return;
    if (autoCheckoutFiredRef.current) return;

    const endMs = new Date(shift.scheduled_end).getTime();
    if (!Number.isFinite(endMs)) return;

    const fire = () => {
      if (autoCheckoutFiredRef.current) return;
      autoCheckoutFiredRef.current = true;
      console.log("[Shift] Scheduled end reached — firing auto checkout");
      postCheckinAction("check_out", { auto: true });
    };

    const delay = endMs - Date.now();
    if (delay <= 0) {
      fire();
      return;
    }
    const timer = setTimeout(fire, delay);
    return () => clearTimeout(timer);
  }, [shift?.id, shift?.status, shift?.scheduled_end, shift?.actual_end]);

  const loadShift = async (opts?: { silent?: boolean }) => {
    if (!supabase) return;
    if (!opts?.silent) setIsLoading(true);
    try {
      let { data, error } = await supabase
        .from("shifts")
        .select(SHIFT_SELECT_WITH_SITE_ADDRESS)
        .eq("id", id)
        .single();

      if (error && isMissingColumnError(error)) {
        const retry = await supabase
          .from("shifts")
          .select(SHIFT_SELECT_LEGACY)
          .eq("id", id)
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      if (data) {
        const raw = data as any;
        const booking = Array.isArray(raw.booking) ? raw.booking[0] : raw.booking;
        const venue = booking ? (Array.isArray(booking.venue) ? booking.venue[0] : booking.venue) : null;
        const venueLocation = booking
          ? (Array.isArray((booking as any).venue_location)
              ? (booking as any).venue_location[0]
              : (booking as any).venue_location)
          : null;
        const emptyVenue = { id: '', name: '', address_line1: null, city: '', postcode: null as string | null, latitude: null, longitude: null };

        const transformedData: ShiftData = {
          ...raw,
          booking: booking
            ? {
                ...booking,
                venue: venue || emptyVenue,
                venue_location: venueLocation ?? undefined,
              }
            : { id: '', event_name: '', event_date: '', start_time: '', end_time: '', venue: emptyVenue },
        };
        setShift(transformedData);
      }

      // Try to load geofences but don't fail if it doesn't work
      if (data?.booking_id && data?.id) {
        try {
          await loadGeofencesForBooking(data.booking_id, data.id);
        } catch (geoError) {
          console.log("Geofences not available:", geoError);
          // Continue without geofences - not critical
        }
      }
    } catch (error: any) {
      console.error("Error loading shift:", error?.code, error?.message);
      Alert.alert("Error", "Failed to load shift details");
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  };

  const startTrackingForShift = useCallback(
    async (opts?: { showAlert?: boolean }) => {
      if (!shift?.personnel_id || !supabase) return false;
      const showAlert = opts?.showAlert ?? true;

      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          if (showAlert) {
            Alert.alert(
              "Permission Required",
              "Location permission is required for shift tracking."
            );
          }
          return false;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (showAlert) Alert.alert("Error", "Please log in again");
        return false;
      }

      await loadGeofencesForBooking(shift.booking_id, shift.id);
      const success = await startTracking(shift.personnel_id, shift.id, {
        authToken: session.access_token,
        scheduledStartIso: shift.scheduled_start,
        scheduledEndIso: shift.scheduled_end,
        autoCheckIn: true,
        autoCheckOut: true,
      });
      if (success && showAlert) {
        Alert.alert("Tracking Started", "Live tracking and auto geofence check-in are now active.");
      }
      return success;
    },
    [
      shift,
      supabase,
      hasPermission,
      requestPermissions,
      loadGeofencesForBooking,
      startTracking,
    ]
  );

  const postCheckinAction = async (
    action: "check_in" | "check_out",
    opts?: { auto?: boolean },
  ) => {
    if (!shift || !supabase) {
      if (!opts?.auto) Alert.alert("Error", "Shift not loaded");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      if (!opts?.auto) Alert.alert("Error", "Please log in again");
      return;
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted" && !opts?.auto) {
      Alert.alert(
        "Location needed",
        "We use one GPS fix when you tap check-in or check-out so the venue can see you were on site. Enable location to continue.",
      );
      return;
    }

    setCheckinActionLoading(true);
    try {
      // Best-effort GPS fix. For auto checkout we don't block on a missing
      // fix — the shift must close at scheduled end no matter what.
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (gpsErr) {
        if (!opts?.auto) throw gpsErr;
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        latitude = last?.coords.latitude ?? 0;
        longitude = last?.coords.longitude ?? 0;
      }

      const res = await fetchApi("/api/shifts/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          shift_id: shift.id,
          action,
          latitude,
          longitude,
          auto: opts?.auto === true,
        }),
      });

      let result: {
        error?: string;
        checkout_outside_geofence?: boolean;
        distance_meters?: number;
      } = {};
      try {
        result = await res.json();
      } catch {
        result = {};
      }

      if (!res.ok) {
        if (!opts?.auto) {
          Alert.alert(
            action === "check_in" ? "Can't check in" : "Can't check out",
            result.error || "Something went wrong. Try again.",
          );
        } else {
          console.warn("[Shift] Auto checkout failed:", result.error);
        }
        return;
      }

      if (action === "check_in") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Checked in",
          "You're on duty. Live tracking below is optional — most shifts only need manual check-in.",
        );
        await loadShift({ silent: true });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await stopTracking();
        const farMessage = result.checkout_outside_geofence
          ? `\n\nNote: you were ${result.distance_meters ?? "?"}m from the venue. The venue will be asked to confirm your attendance.`
          : "";
        const title = opts?.auto ? "Shift auto-ended" : "Checked out";
        const message = opts?.auto
          ? `Your shift reached its scheduled end and was closed automatically.${farMessage}`
          : `Shift complete.${farMessage}`;
        Alert.alert(title, message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      console.error("Check-in/out error:", e);
      if (!opts?.auto) {
        Alert.alert(
          "Location",
          "Could not read your GPS position. Move to an open area and try again.",
        );
      }
    } finally {
      setCheckinActionLoading(false);
    }
  };

  const handleCancelShift = () => {
    if (!shift) return;

    // Show confirmation with reason input
    Alert.prompt(
      "Cancel Shift",
      "Please provide a reason for cancelling this shift. Note: Cancelling less than 24 hours before the shift may affect your reliability rating.",
      [
        { text: "Keep Shift", style: "cancel" },
        {
          text: "Cancel Shift",
          style: "destructive",
          onPress: async (reason?: string) => {
            if (!reason || reason.trim().length < 5) {
              Alert.alert("Error", "Please provide a reason (at least 5 characters)");
              return;
            }

            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              
              if (!supabase) return;
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                Alert.alert("Error", "Please log in again");
                return;
              }

              const response = await fetchApi("/api/shifts/cancel", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  shift_id: shift.id,
                  reason: reason.trim(),
                  cancelled_by: "guard",
                }),
              });

              const raw = await response.text();
              let data: any = {};
              try {
                data = raw ? JSON.parse(raw) : {};
              } catch {
                data = {};
              }

              if (!response.ok) {
                const fallbackText =
                  typeof raw === "string" && raw.trim() && !raw.trim().startsWith("<")
                    ? raw.trim()
                    : null;
                const base =
                  data.error ||
                  fallbackText ||
                  "Failed to cancel shift";
                const dbg =
                  __DEV__ && typeof data.debug === "string" && data.debug.trim()
                    ? `\n\n${data.debug.trim()}`
                    : "";
                throw new Error(base + dbg);
              }

              if (data.mode === "reopened_for_cover") {
                Alert.alert(
                  "Shift released",
                  "Shift released: the shift has been cancelled.\n\nWhen you cancel with less than 24 hours before the shift starts, this will affect your reliability rating.",
                  [{ text: "OK", onPress: () => router.back() }],
                );
              } else {
                Alert.alert(
                  "Shift Cancelled",
                  data.cancellation_note || "Your shift has been cancelled successfully.",
                  [{ text: "OK", onPress: () => router.back() }],
                );
              }
            } catch (error: any) {
              console.error("Cancel shift error:", error);
              Alert.alert("Error", error.message || "Failed to cancel shift");
            }
          },
        },
      ],
      "plain-text",
      "",
      "default"
    );
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const autoTrackingAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && shift) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading, shift]);

  // Pulse animation for active shift
  useEffect(() => {
    if (shift?.status === "checked_in") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [shift?.status]);

  // Auto-start tracking 1 hour before scheduled start through to scheduled end.
  // Mirrors the global PreShiftTracker so opening this screen kicks off tracking
  // immediately if the user is in-window. Also re-starts tracking if the shift
  // is already checked_in but tracking happens to be off (force-quit, etc.).
  useEffect(() => {
    if (!shift) return;
    const _isCheckedOut = shift.status === "checked_out" || !!shift.actual_end;
    const _statusOk =
      shift.status === "accepted" ||
      shift.status === "checked_in" ||
      (shift.status === "pending" && !!shift.personnel_id);
    const st = new Date(shift.scheduled_start);
    const et = new Date(shift.scheduled_end);
    const _now = new Date();
    const _inTrackingWindow =
      _now >= new Date(st.getTime() - 60 * 60 * 1000) && _now <= et;

    if (_isCheckedOut || !_statusOk || !_inTrackingWindow || isTracking) return;
    if (autoTrackingAttemptRef.current === shift.id) return;
    autoTrackingAttemptRef.current = shift.id;

    startTrackingForShift({ showAlert: false }).catch((err) => {
      console.warn("[ShiftScreen] Auto tracking start failed:", err);
    });
  }, [shift, isTracking, startTrackingForShift]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <AnimatedBackground variant="subtle" />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading shift details...</Text>
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top + 20 }]}>
        <AnimatedBackground variant="subtle" />
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Shift not found</Text>
        <TouchableOpacity 
          style={styles.goBackButton} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startTime = new Date(shift.scheduled_start);
  const endTime = new Date(shift.scheduled_end);
  const isCheckedIn = shift.status === "checked_in" || !!shift.actual_start;
  const isCheckedOut = shift.status === "checked_out" || !!shift.actual_end;
  
  // Check if within 15 minutes of shift start (can check in 15 min before)
  const now = new Date();
  const fifteenMinutesBefore = new Date(startTime.getTime() - 15 * 60 * 1000);
  const inCheckInWindow = now >= fifteenMinutesBefore && now <= endTime;
  const afterShiftWindow = now > endTime && !isCheckedIn && !isCheckedOut;
  const minutesUntilCheckIn = Math.ceil(
    (fifteenMinutesBefore.getTime() - now.getTime()) / 60000,
  );
  const statusAllowsCheckIn =
    shift.status === "accepted" ||
    (shift.status === "pending" && !!shift.personnel_id);

  // Calculate shift duration and earnings
  const shiftDurationHours = (endTime.getTime() - startTime.getTime()) / 3600000;
  const estimatedEarnings = shiftDurationHours * (shift.hourly_rate || 0);
  const attireRequirement = extractAttireRequirement(shift.booking?.brief_notes);

  return (
    <View style={styles.container}>
      <AnimatedBackground variant="subtle" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        {/* Header with Live Indicator */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>
              {isCheckedIn && !isCheckedOut ? "On Shift" : isCheckedOut ? "Shift Complete" : "Upcoming Shift"}
            </Text>
            {isCheckedIn && !isCheckedOut && (
              <View style={styles.liveIndicatorContainer}>
                <LiveIndicator label="LIVE" color={colors.success} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Venue Card - Enhanced */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: isCheckedIn && !isCheckedOut ? pulseAnim : 1 },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={
              isCheckedIn && !isCheckedOut 
                ? gradients.successSoft 
                : isCheckedOut 
                  ? gradients.card 
                  : gradients.accentSoft
            }
            style={[
              styles.card,
              isCheckedIn && !isCheckedOut && styles.cardActive,
            ]}
          >
            <View style={styles.venueHeader}>
              <Text style={styles.venueIcon}>🏢</Text>
              {isCheckedIn && !isCheckedOut && (
                <View style={styles.onShiftBadge}>
                  <Text style={styles.onShiftBadgeText}>ON SHIFT</Text>
                </View>
              )}
            </View>
            <Text style={styles.venueName}>{shift.booking?.venue?.name || "Unknown Venue"}</Text>
            {shift.booking?.site_label ? (
              <Text style={styles.siteLabel}>{shift.booking.site_label}</Text>
            ) : null}
            <Text style={styles.venueAddress}>
              {shift.booking ? bookingDirectionsLine(shift.booking) : "Address not available"}
            </Text>
            <Text style={styles.eventName}>{shift.booking?.event_name || "Shift"}</Text>

            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Start</Text>
                <Text style={styles.timeValue}>
                  {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <View style={styles.timeDivider}>
                <Text style={styles.timeDividerText}>→</Text>
              </View>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>End</Text>
                <Text style={styles.timeValue}>
                  {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>

            <View style={styles.shiftMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>👤</Text>
                <Text style={styles.metaText}>{shift.role}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>💷</Text>
                <Text style={styles.metaText}>£{shift.hourly_rate}/hr</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>💰</Text>
                <Text style={[styles.metaText, { color: colors.success }]}>
                  ~£{Math.round(estimatedEarnings)}
                </Text>
              </View>
            </View>
            {attireRequirement ? (
              <View style={styles.attireBanner}>
                <Text style={styles.attireBannerText}>👔 Required attire: {attireRequirement}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </Animated.View>

        {/* Cover-sourcing banner — appears when the venue has started looking
         * for a replacement (R5+ ring or active cover search). Lets the guard
         * recover by checking in immediately, which cancels the cover search
         * and prevents double-booking. */}
        {!isCheckedOut && shift.cover_search_wave && shift.cover_search_wave > 0 ? (
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.coverRecoveryCard}>
              <Text style={styles.coverRecoveryTitle}>
                🔴 The venue is looking for cover
              </Text>
              <Text style={styles.coverRecoveryBody}>
                You're flagged as not yet on site. Wave {shift.cover_search_wave} of 3 is
                active — nearby guards have been notified you may not make it.
                {"\n\n"}
                <Text style={styles.coverRecoveryEmphasis}>
                  You can still recover.
                </Text>{" "}
                Check in below as soon as you arrive and we'll cancel the cover
                search automatically.
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Primary check-in / check-out (API + GPS — same rules as web) */}
        {!isCheckedOut && (
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <LinearGradient colors={gradients.accentSoft} style={styles.primaryActionCard}>
              {!isCheckedIn ? (
                <>
                  <Text style={styles.primaryActionTitle}>At the venue?</Text>
                  <Text style={styles.primaryActionCaption}>
                    Tap once to check in. We send a single GPS point to prove you're on site
                    (server-validated, same as the web dashboard). Live tracking below is optional.
                  </Text>
                  {statusAllowsCheckIn ? (
                    afterShiftWindow ? (
                      <Text style={styles.primaryActionWarning}>
                        This shift's check-in window has passed. Contact the venue if you still need to
                        work this job.
                      </Text>
                    ) : inCheckInWindow ? (
                      <TouchableOpacity
                        style={styles.primaryActionButtonWrap}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          postCheckinAction("check_in");
                        }}
                        disabled={checkinActionLoading}
                        activeOpacity={0.85}
                      >
                        {checkinActionLoading ? (
                          <View style={styles.primaryActionLoading}>
                            <ActivityIndicator color={colors.textInverse} />
                          </View>
                        ) : (
                          <LinearGradient
                            colors={gradients.accent}
                            style={styles.primaryActionButtonGradient}
                          >
                            <Text style={styles.primaryActionButtonText}>
                              I'm at the venue — Check in
                            </Text>
                          </LinearGradient>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.countdownBadge}>
                        <Text style={styles.countdownText}>
                          Check-in opens in{" "}
                          {minutesUntilCheckIn > 60
                            ? `${Math.floor(minutesUntilCheckIn / 60)}h ${minutesUntilCheckIn % 60}m`
                            : `${Math.max(0, minutesUntilCheckIn)}m`}
                        </Text>
                      </View>
                    )
                  ) : (
                    <Text style={styles.primaryActionWarning}>
                      Your shift must be accepted before you can check in.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.primaryActionTitle}>Leaving the venue?</Text>
                  <Text style={styles.primaryActionCaption}>
                    One GPS point is recorded for check-out. You must be within range of the venue
                    pin (same rule as check-in).
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryActionButtonWrap}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      postCheckinAction("check_out");
                    }}
                    disabled={checkinActionLoading}
                    activeOpacity={0.85}
                  >
                    {checkinActionLoading ? (
                      <View style={styles.primaryActionLoading}>
                        <ActivityIndicator color={colors.textInverse} />
                      </View>
                    ) : (
                      <LinearGradient
                        colors={gradients.accent}
                        style={styles.primaryActionButtonGradient}
                      >
                        <Text style={styles.primaryActionButtonText}>
                          End shift — Check out
                        </Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </LinearGradient>
          </Animated.View>
        )}

        {/* Status Card - Enhanced */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient colors={gradients.card} style={styles.card}>
            <Text style={styles.cardTitle}>📋 Shift Status</Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isCheckedIn && styles.statusDotActive]}>
                {isCheckedIn && <Text style={styles.statusDotIcon}>✓</Text>}
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Check In</Text>
                <Text style={styles.statusValue}>
                  {isCheckedIn && shift.actual_start
                    ? new Date(shift.actual_start).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : afterShiftWindow
                      ? "Window ended — see above"
                      : inCheckInWindow
                        ? "Ready when you are"
                        : minutesUntilCheckIn > 0
                          ? `Opens in ${minutesUntilCheckIn > 60 ? `${Math.floor(minutesUntilCheckIn / 60)}h ${minutesUntilCheckIn % 60}m` : `${minutesUntilCheckIn}m`}`
                          : "See check-in above"}
                </Text>
              </View>
            </View>

            <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.statusDot, isCheckedOut && styles.statusDotActive]}>
                {isCheckedOut && <Text style={styles.statusDotIcon}>✓</Text>}
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Check Out</Text>
                <Text style={styles.statusValue}>
                  {isCheckedOut && shift.actual_end
                    ? new Date(shift.actual_end).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Not checked out"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Tracking Card - Enhanced */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient colors={gradients.card} style={styles.card}>
            <Text style={styles.cardTitle}>📍 Live GPS tracking</Text>

            <View style={styles.trackingStatus}>
              <View style={[styles.trackingIconContainer, isTracking && styles.trackingIconActive]}>
                <Text style={styles.trackingIcon}>{isTracking ? "📍" : "📌"}</Text>
              </View>
              <View style={styles.trackingInfo}>
                <View style={styles.trackingLabelRow}>
                  <Text style={styles.trackingLabel}>
                    {isTracking ? "Tracking on" : "Tracking will start automatically"}
                  </Text>
                  {isTracking && <LiveIndicator size="sm" showLabel={false} />}
                </View>
                <Text style={styles.trackingDetail}>
                  {isCheckedOut
                    ? "Shift complete — tracking stopped."
                    : isTracking
                      ? hasBackgroundPermission
                        ? "Running in the background. The venue can see your live location during the shift window."
                        : "Running while the app is open. Enable Always-allow location so the venue can see you in the background."
                      : "Live tracking turns on automatically 1 hour before your shift starts and stays on until you check out. The venue will see your location only during this window."}
                </Text>
              </View>
            </View>

            {locationError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {locationError}</Text>
              </View>
            )}

            {!hasPermission && (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  requestPermissions();
                }}
              >
                <Text style={styles.permissionButtonText}>Grant Location Permission</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Info Card */}
        <Animated.View
          style={[
            styles.infoCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient colors={gradients.accentSoft} style={styles.infoCardGradient}>
            <Text style={styles.infoText}>
              ℹ️ Check-in uses one GPS fix when you tap the button (same rules as the web dashboard). Always-on
              live tracking is optional and may come in a later release.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Cancel Shift Button - Only show for pending/accepted shifts */}
        {(shift.status === "pending" || shift.status === "accepted") && !isCheckedIn && (
          <Animated.View
            style={[
              styles.cancelSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleCancelShift();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>❌ Cancel Shift</Text>
            </TouchableOpacity>
            <Text style={styles.cancelWarning}>
              Cancelling less than 24 hours before the shift may affect your reliability rating
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  errorIcon: {
    fontSize: 64,
  },
  errorText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  goBackButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  goBackButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  
  // Header
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  liveIndicatorContainer: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success,
  },
  
  // Card
  cardContainer: {
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardActive: {
    borderColor: colors.success,
    borderWidth: 1.5,
  },
  
  // Venue
  venueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  venueIcon: {
    fontSize: 36,
  },
  onShiftBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  onShiftBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  venueName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  siteLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.success,
    marginTop: 6,
  },
  venueAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  eventName: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 4,
    fontWeight: "600",
  },
  
  // Time
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timeValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  timeDivider: {
    paddingHorizontal: spacing.md,
  },
  timeDividerText: {
    fontSize: 20,
    color: colors.textMuted,
  },
  
  // Shift Meta
  shiftMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  attireBanner: {
    marginTop: spacing.md,
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attireBannerText: {
    fontSize: 13,
    color: "#93C5FD",
    fontWeight: "600",
  },
  coverRecoveryCard: {
    backgroundColor: "rgba(220,38,38,0.18)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.45)",
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  coverRecoveryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FCA5A5",
    marginBottom: spacing.sm,
  },
  coverRecoveryBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FECACA",
  },
  coverRecoveryEmphasis: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
  
  // Card Title
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  primaryActionCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
  },
  primaryActionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  primaryActionCaption: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  primaryActionWarning: {
    fontSize: 14,
    color: colors.warning,
    lineHeight: 20,
  },
  primaryActionButtonWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  primaryActionButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textInverse,
    textAlign: "center",
  },
  primaryActionLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
  },
  
  // Status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  statusDotIcon: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: "700",
  },
  statusInfo: {
    marginLeft: 14,
    flex: 1,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  statusValue: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  
  // Action Buttons
  actionButton: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  actionButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textInverse,
  },
  actionButtonSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  countdownBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  
  // Tracking
  trackingStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  trackingIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  trackingIconActive: {
    backgroundColor: colors.successSoft,
  },
  trackingIcon: {
    fontSize: 28,
  },
  trackingInfo: {
    flex: 1,
  },
  trackingLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  trackingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  trackingDetail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  errorBannerText: {
    fontSize: 13,
    color: colors.warning,
  },
  trackingButton: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  trackingButtonStop: {},
  trackingButtonGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  trackingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textInverse,
  },
  permissionButton: {
    marginTop: spacing.md,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  permissionButtonText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: "600",
  },
  
  // Info Card
  infoCard: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  infoCardGradient: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  
  // Cancel Section
  cancelSection: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  cancelButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorSoft,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.error,
  },
  cancelWarning: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
