/**
 * Active Shift Screen
 * 
 * Shows current shift details and location tracking status
 * Personnel can see their tracking state and manually check in/out if needed
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../theme";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { supabase } from "../../lib/supabase";
import { BackButton } from "../../components/ui/BackButton";

interface ShiftData {
  id: string;
  booking_id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  booking: {
    start: string;
    end: string;
    venue: {
      name: string;
      address: string;
    };
  };
  agency_staff: {
    id: string;
    agency: {
      name: string;
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
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("booking_assignments")
        .select(`
          *,
          booking:bookings(
            start, end,
            venue:venues(name, address)
          ),
          agency_staff:agency_staff(
            id,
            agency:agencies(name)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setShift(data);

      if (data?.booking_id) {
        await loadGeofencesForBooking(data.booking_id);
      }
    } catch (error) {
      console.error("Error loading shift:", error);
      Alert.alert("Error", "Failed to load shift details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTracking = async () => {
    if (!shift?.agency_staff?.id) return;

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

    const success = await startTracking(shift.agency_staff.id, shift.id);
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
    if (!shift || !currentLocation) {
      Alert.alert("Error", "Unable to get your current location");
      return;
    }

    try {
      const { error } = await supabase
        .from("booking_assignments")
        .update({
          check_in_at: new Date().toISOString(),
          check_in_lat: currentLocation.coords.latitude,
          check_in_lng: currentLocation.coords.longitude,
          status: "confirmed",
        })
        .eq("id", shift.id);

      if (error) throw error;
      Alert.alert("Checked In", "You have been checked in successfully");
      loadShift();
    } catch (error) {
      Alert.alert("Error", "Failed to check in");
    }
  };

  const handleManualCheckOut = async () => {
    if (!shift || !currentLocation) {
      Alert.alert("Error", "Unable to get your current location");
      return;
    }

    try {
      const { error } = await supabase
        .from("booking_assignments")
        .update({
          check_out_at: new Date().toISOString(),
          check_out_lat: currentLocation.coords.latitude,
          check_out_lng: currentLocation.coords.longitude,
          status: "completed",
        })
        .eq("id", shift.id);

      if (error) throw error;
      await stopTracking();
      Alert.alert("Checked Out", "Great job!");
      router.back();
    } catch (error) {
      Alert.alert("Error", "Failed to check out");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Shift not found</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startTime = new Date(shift.booking.start);
  const endTime = new Date(shift.booking.end);
  const isCheckedIn = !!shift.check_in_at;
  const isCheckedOut = !!shift.check_out_at;

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
        <BackButton />

        <Text style={styles.title}>Active Shift</Text>

        {/* Venue Card */}
        <View style={styles.card}>
          <Text style={styles.venueIcon}>🏢</Text>
          <Text style={styles.venueName}>{shift.booking.venue.name}</Text>
          <Text style={styles.venueAddress}>{shift.booking.venue.address}</Text>

          <View style={styles.timeRow}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>Start</Text>
              <Text style={styles.timeValue}>
                {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>End</Text>
              <Text style={styles.timeValue}>
                {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>

          <View style={styles.agencyBadge}>
            <Text style={styles.agencyText}>via {shift.agency_staff.agency.name}</Text>
          </View>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shift Status</Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isCheckedIn && styles.statusDotActive]} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Check In</Text>
              <Text style={styles.statusValue}>
                {isCheckedIn
                  ? new Date(shift.check_in_at!).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Not checked in"}
              </Text>
            </View>
            {!isCheckedIn && (
              <TouchableOpacity style={styles.actionButton} onPress={handleManualCheckIn}>
                <Text style={styles.actionButtonText}>Check In</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isCheckedOut && styles.statusDotActive]} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Check Out</Text>
              <Text style={styles.statusValue}>
                {isCheckedOut
                  ? new Date(shift.check_out_at!).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Not checked out"}
              </Text>
            </View>
            {isCheckedIn && !isCheckedOut && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={handleManualCheckOut}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                  Check Out
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tracking Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location Tracking</Text>

          <View style={styles.trackingStatus}>
            <Text style={styles.trackingIcon}>{isTracking ? "📍" : "📌"}</Text>
            <View style={styles.trackingInfo}>
              <Text style={styles.trackingLabel}>
                {isTracking ? "Tracking Active" : "Tracking Inactive"}
              </Text>
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
              onPress={isTracking ? handleStopTracking : handleStartTracking}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.trackingButtonText}>
                  {isTracking ? "⏹ Stop Tracking" : "▶ Start Tracking"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {!hasPermission && (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
              <Text style={styles.permissionButtonText}>Grant Location Permission</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            ℹ️ Location tracking helps your agency monitor shift attendance. Auto check-in/out
            will trigger when you enter or leave the venue area.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 12,
  },
  goBackButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.glass,
    borderRadius: 12,
  },
  goBackButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.md,
  },
  venueIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  venueName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  venueAddress: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  timeValue: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
  },
  timeDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.glassBorder,
  },
  agencyBadge: {
    marginTop: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 180, 216, 0.1)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  agencyText: {
    fontSize: 12,
    color: colors.accent,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textMuted,
  },
  statusDotActive: {
    backgroundColor: colors.success,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  statusValue: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  actionButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  actionButtonTextSecondary: {
    color: colors.accent,
  },
  trackingStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  trackingIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  trackingInfo: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  trackingDetail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.warning,
  },
  trackingButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
  },
  trackingButtonStop: {
    backgroundColor: colors.error,
  },
  trackingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  permissionButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: "500",
  },
  infoCard: {
    padding: spacing.md,
    backgroundColor: "rgba(0, 180, 216, 0.1)",
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
