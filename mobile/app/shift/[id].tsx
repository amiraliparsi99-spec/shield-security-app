/**
 * Active Shift Screen
 * 
 * Shows current shift details and location tracking status
 * Personnel can see their tracking state and manually check in/out if needed
 * Enhanced with animations and modern UI
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, gradients, spacing, radius } from "../../theme";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { supabase } from "../../lib/supabase";
import { BackButton } from "../../components/ui/BackButton";
import { AnimatedBackground } from "../../components/ui/AnimatedBackground";
import { LiveIndicator } from "../../components/ui/LiveIndicator";

const { width } = Dimensions.get("window");

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
  booking: {
    id: string;
    event_name: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue: {
      id: string;
      name: string;
      address_line1: string | null;
      city: string;
      latitude: number | null;
      longitude: number | null;
    };
  };
}

export default function ShiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadShift = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
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
            venue:venues(id, name, address_line1, city, latitude, longitude)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      // Transform the data to match ShiftData type
      if (data) {
        const bookingArray = data.booking as any[];
        const booking = bookingArray?.[0];
        const venueArray = booking?.venue as any[];
        const venue = venueArray?.[0];
        
        const transformedData: ShiftData = {
          ...data,
          booking: booking ? {
            ...booking,
            venue: venue || { id: '', name: '', address_line1: null, city: '', latitude: null, longitude: null }
          } : { id: '', event_name: '', event_date: '', start_time: '', end_time: '', venue: { id: '', name: '', address_line1: null, city: '', latitude: null, longitude: null } }
        };
        setShift(transformedData);
      }

      // Try to load geofences but don't fail if it doesn't work
      if (data?.booking_id) {
        try {
          await loadGeofencesForBooking(data.booking_id);
        } catch (geoError) {
          console.log("Geofences not available:", geoError);
          // Continue without geofences - not critical
        }
      }
    } catch (error: any) {
      console.error("Error loading shift:", error?.code, error?.message);
      Alert.alert("Error", "Failed to load shift details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTracking = async () => {
    if (!shift?.personnel_id) return;

    if (!hasPermission) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Location permission is required for shift tracking."
        );
        return;
      }
    }

    const success = await startTracking(shift.personnel_id, shift.id);
    if (success) {
      Alert.alert("Tracking Started", "Your location is now being tracked.");
    }
  };

  const handleStopTracking = async () => {
    Alert.alert("Stop Tracking", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Stop", style: "destructive", onPress: () => stopTracking() },
    ]);
  };

  const handleManualCheckIn = async () => {
    if (!shift) {
      Alert.alert("Error", "Shift not loaded");
      return;
    }

    try {
      const updateData: any = {
        actual_start: new Date().toISOString(),
        status: "checked_in",
      };
      
      if (currentLocation) {
        updateData.check_in_latitude = currentLocation.coords.latitude;
        updateData.check_in_longitude = currentLocation.coords.longitude;
      }

      if (!supabase) return;
      const { error } = await supabase
        .from("shifts")
        .update(updateData)
        .eq("id", shift.id);

      if (error) throw error;
      Alert.alert("Checked In", "You have been checked in successfully");
      loadShift();
    } catch (error) {
      console.error("Check in error:", error);
      Alert.alert("Error", "Failed to check in");
    }
  };

  const handleManualCheckOut = async () => {
    if (!shift) {
      Alert.alert("Error", "Shift not loaded");
      return;
    }

    try {
      const updateData: any = {
        actual_end: new Date().toISOString(),
        status: "checked_out",
      };
      
      if (currentLocation) {
        updateData.check_out_latitude = currentLocation.coords.latitude;
        updateData.check_out_longitude = currentLocation.coords.longitude;
      }

      if (!supabase) return;
      const { error } = await supabase
        .from("shifts")
        .update(updateData)
        .eq("id", shift.id);

      if (error) throw error;
      await stopTracking();
      Alert.alert("Checked Out", "Great job! Your shift is complete.");
      router.back();
    } catch (error) {
      console.error("Check out error:", error);
      Alert.alert("Error", "Failed to check out");
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

              const response = await fetch(
                `${process.env.EXPO_PUBLIC_API_URL || ""}/api/shifts/cancel`,
                {
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
                }
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || "Failed to cancel shift");
              }

              Alert.alert(
                "Shift Cancelled",
                data.cancellation_note || "Your shift has been cancelled successfully.",
                [{ text: "OK", onPress: () => router.back() }]
              );
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
  const canCheckIn = now >= fifteenMinutesBefore && now <= endTime;
  const minutesUntilCheckIn = Math.ceil((fifteenMinutesBefore.getTime() - now.getTime()) / 60000);

  // Calculate shift duration and earnings
  const shiftDurationHours = (endTime.getTime() - startTime.getTime()) / 3600000;
  const estimatedEarnings = shiftDurationHours * (shift.hourly_rate || 0);

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
            <Text style={styles.venueAddress}>
              {shift.booking?.venue?.address_line1 || shift.booking?.venue?.city || "Address not available"}
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
          </LinearGradient>
        </Animated.View>

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
                    : canCheckIn 
                      ? "Ready to check in"
                      : `Available in ${minutesUntilCheckIn} min`}
                </Text>
              </View>
              {!isCheckedIn && (
                canCheckIn ? (
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleManualCheckIn();
                    }}
                  >
                    <LinearGradient colors={gradients.accent} style={styles.actionButtonGradient}>
                      <Text style={styles.actionButtonText}>Check In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.countdownBadge}>
                    <Text style={styles.countdownText}>
                      {minutesUntilCheckIn > 60 
                        ? `${Math.floor(minutesUntilCheckIn / 60)}h ${minutesUntilCheckIn % 60}m`
                        : `${minutesUntilCheckIn}m`}
                    </Text>
                  </View>
                )
              )}
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
              {isCheckedIn && !isCheckedOut && (
                <TouchableOpacity
                  style={styles.actionButtonSecondary}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleManualCheckOut();
                  }}
                >
                  <Text style={styles.actionButtonTextSecondary}>Check Out</Text>
                </TouchableOpacity>
              )}
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
            <Text style={styles.cardTitle}>📍 Location Tracking</Text>

            <View style={styles.trackingStatus}>
              <View style={[styles.trackingIconContainer, isTracking && styles.trackingIconActive]}>
                <Text style={styles.trackingIcon}>{isTracking ? "📍" : "📌"}</Text>
              </View>
              <View style={styles.trackingInfo}>
                <View style={styles.trackingLabelRow}>
                  <Text style={styles.trackingLabel}>
                    {isTracking ? "Tracking Active" : "Tracking Inactive"}
                  </Text>
                  {isTracking && <LiveIndicator size="sm" showLabel={false} />}
                </View>
                <Text style={styles.trackingDetail}>
                  {isTracking
                    ? hasBackgroundPermission
                      ? "Running in background"
                      : "Only while app is open"
                    : "Start tracking to enable auto check-in"}
                </Text>
              </View>
            </View>

            {locationError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {locationError}</Text>
              </View>
            )}

            {!isCheckedOut && (
              <TouchableOpacity
                style={[styles.trackingButton, isTracking && styles.trackingButtonStop]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  isTracking ? handleStopTracking() : handleStartTracking();
                }}
                disabled={locationLoading}
                activeOpacity={0.8}
              >
                {locationLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <LinearGradient
                    colors={isTracking ? gradients.error : gradients.accent}
                    style={styles.trackingButtonGradient}
                  >
                    <Text style={styles.trackingButtonText}>
                      {isTracking ? "⏹ Stop Tracking" : "▶ Start Tracking"}
                    </Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
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
              ℹ️ Location tracking helps your agency monitor shift attendance. Auto check-in/out
              will trigger when you enter or leave the venue area.
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
  
  // Card Title
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.lg,
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
