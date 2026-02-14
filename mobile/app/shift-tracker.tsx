/**
 * Premium Shift Tracker
 * Map-centric interface with live tracking, timeline, and incident reporting
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ShiftCheckin {
  id: string;
  booking_id: string;
  check_in_time: string | null;
  check_in_address: string | null;
  check_out_time: string | null;
  check_out_address: string | null;
  total_hours: number | null;
  status: string;
  booking?: {
    id: string;
    event_name: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue?: { name: string; address?: string };
    agency?: { name: string };
  };
}

interface TimelineEvent {
  id: string;
  time: string;
  type: "check_in" | "check_out" | "break_start" | "break_end" | "incident";
  title: string;
  description: string;
}

// Timer display component
function ShiftTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - start;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setElapsed(
        `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerLabel}>Time on shift</Text>
      <Text style={styles.timerValue}>{elapsed}</Text>
    </View>
  );
}

// Live location indicator
function LiveIndicator() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.liveIndicator}>
      <Animated.View
        style={[
          styles.livePulse,
          { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({
            inputRange: [1, 1.3],
            outputRange: [0.6, 0],
          }) },
        ]}
      />
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

// Map placeholder (replace with actual MapView when ready)
function MapPlaceholder({ location }: { location: { lat: number; lng: number } | null }) {
  return (
    <View style={styles.mapContainer}>
      <LinearGradient
        colors={["rgba(45, 212, 191, 0.1)", "rgba(12, 13, 16, 0.95)"]}
        style={styles.mapGradient}
      >
        {location ? (
          <>
            <View style={styles.mapPin}>
              <Text style={styles.mapPinIcon}>📍</Text>
            </View>
            <Text style={styles.mapCoords}>
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
            <Text style={styles.mapPlaceholderText}>Location tracking active</Text>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

// Timeline event component
function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const getIcon = () => {
    switch (event.type) {
      case "check_in": return "✅";
      case "check_out": return "🏁";
      case "break_start": return "☕";
      case "break_end": return "▶️";
      case "incident": return "⚠️";
      default: return "📌";
    }
  };

  const getColor = () => {
    switch (event.type) {
      case "check_in": return colors.success;
      case "check_out": return colors.accent;
      case "incident": return colors.warning;
      default: return colors.textMuted;
    }
  };

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, { backgroundColor: getColor() }]}>
          <Text style={styles.timelineIcon}>{getIcon()}</Text>
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineTime}>{event.time}</Text>
        <Text style={styles.timelineTitle}>{event.title}</Text>
        <Text style={styles.timelineDesc}>{event.description}</Text>
      </View>
    </View>
  );
}

// Quick action buttons
function QuickActions({
  onBreak,
  onIncident,
  onEmergency,
  isOnBreak,
}: {
  onBreak: () => void;
  onIncident: () => void;
  onEmergency: () => void;
  isOnBreak: boolean;
}) {
  return (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={[styles.quickAction, isOnBreak && styles.quickActionActive]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBreak();
        }}
      >
        <Text style={styles.quickActionIcon}>{isOnBreak ? "▶️" : "☕"}</Text>
        <Text style={styles.quickActionLabel}>{isOnBreak ? "End Break" : "Take Break"}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onIncident();
        }}
      >
        <Text style={styles.quickActionIcon}>📝</Text>
        <Text style={styles.quickActionLabel}>Report</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.quickAction, styles.quickActionEmergency]}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onEmergency();
        }}
      >
        <Text style={styles.quickActionIcon}>🚨</Text>
        <Text style={styles.quickActionLabel}>Emergency</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ShiftTrackerScreen() {
  const insets = useSafeAreaInsets();
  const [activeShift, setActiveShift] = useState<ShiftCheckin | null>(null);
  const [todaysShifts, setTodaysShifts] = useState<ShiftCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    initializeAndLoad();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const initializeAndLoad = async () => {
    try {
      const result = await getProfileIdAndRole(supabase);
      if (result?.profileId) {
        const pId = await getPersonnelId(supabase, result.profileId);
        setPersonnelId(pId);
        if (pId) {
          await loadShifts(pId);
        }
      }
    } catch (e) {
      console.error("Failed to initialize:", e);
    }
    setLoading(false);
  };

  const loadShifts = async (pId: string) => {
    const today = new Date().toISOString().split("T")[0];

    const { data: bookings } = await supabase
      .from("bookings")
      .select(`
        id, event_name, event_date, start_time, end_time,
        venue:venues(name, address),
        agency:agencies(name)
      `)
      .eq("event_date", today)
      .or(`provider_id.eq.${pId},assigned_personnel.cs.{${pId}}`);

    const { data: checkins } = await supabase
      .from("shift_checkins")
      .select("*")
      .eq("personnel_id", pId)
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    const shifts: ShiftCheckin[] = (bookings || []).map((booking: any) => {
      const checkin = checkins?.find((c) => c.booking_id === booking.id);
      return {
        id: checkin?.id || "",
        booking_id: booking.id,
        check_in_time: checkin?.check_in_time || null,
        check_in_address: checkin?.check_in_address || null,
        check_out_time: checkin?.check_out_time || null,
        check_out_address: checkin?.check_out_address || null,
        total_hours: checkin?.total_hours || null,
        status: checkin?.status || "pending",
        booking,
      };
    });

    setTodaysShifts(shifts);
    const active = shifts.find((s) => s.status === "checked_in");
    setActiveShift(active || null);

    // Build timeline
    if (active) {
      const events: TimelineEvent[] = [];
      if (active.check_in_time) {
        events.push({
          id: "checkin",
          time: new Date(active.check_in_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          type: "check_in",
          title: "Checked In",
          description: active.check_in_address || "Location recorded",
        });
      }
      setTimeline(events);
    }
  };

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission not granted");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    setCurrentLocation({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    });

    const [address] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    const addressStr = address
      ? `${address.street || ""}, ${address.city || ""}, ${address.postalCode || ""}`.trim()
      : `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      address: addressStr,
    };
  };

  const handleCheckIn = async (shift: ShiftCheckin) => {
    if (!personnelId) return;

    setProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const location = await getCurrentLocation();

      const { error } = await supabase.from("shift_checkins").insert({
        booking_id: shift.booking_id,
        personnel_id: personnelId,
        check_in_time: new Date().toISOString(),
        check_in_lat: location.lat,
        check_in_lng: location.lng,
        check_in_address: location.address,
        status: "checked_in",
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadShifts(personnelId);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Check-in Failed", error.message || "Failed to check in");
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeShift || !personnelId) return;

    Alert.alert(
      "End Shift",
      "Are you sure you want to check out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check Out",
          onPress: async () => {
            setProcessing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            try {
              const location = await getCurrentLocation();

              const checkInTime = new Date(activeShift.check_in_time!).getTime();
              const totalHours = (Date.now() - checkInTime) / (1000 * 60 * 60);

              const { error } = await supabase
                .from("shift_checkins")
                .update({
                  check_out_time: new Date().toISOString(),
                  check_out_lat: location.lat,
                  check_out_lng: location.lng,
                  check_out_address: location.address,
                  total_hours: parseFloat(totalHours.toFixed(2)),
                  status: "checked_out",
                })
                .eq("id", activeShift.id);

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadShifts(personnelId);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Check-out Failed", error.message || "Failed to check out");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleBreak = () => {
    setIsOnBreak(!isOnBreak);
    const event: TimelineEvent = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      type: isOnBreak ? "break_end" : "break_start",
      title: isOnBreak ? "Break Ended" : "Break Started",
      description: isOnBreak ? "Back on duty" : "Taking a break",
    };
    setTimeline((prev) => [...prev, event]);
  };

  const handleIncident = () => {
    Alert.alert(
      "Report Incident",
      "What type of incident would you like to report?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "🎙️ Voice Report (AI)", 
          onPress: () => router.push("/incidents/report") 
        },
        { text: "Manual Entry", onPress: () => logIncident("Manual incident report") },
      ]
    );
  };

  const logIncident = (description: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const event: TimelineEvent = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      type: "incident",
      title: "Incident Reported",
      description,
    };
    setTimeline((prev) => [...prev, event]);
    Alert.alert("Incident Logged", "Your report has been recorded.");
  };

  const handleEmergency = () => {
    Alert.alert(
      "🚨 Emergency",
      "This will alert your supervisor and emergency contacts. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Alert",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Alert Sent", "Emergency services and your supervisor have been notified.");
          },
        },
      ]
    );
  };

  const formatTime = (time: string) => {
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return time;
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading shift data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Background */}
      <MapPlaceholder location={currentLocation} />

      {/* Header Overlay */}
      <BlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shift Tracker</Text>
        {activeShift && <LiveIndicator />}
        {!activeShift && <View style={styles.headerBtn} />}
      </BlurView>

      {/* Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Shift Card */}
          {activeShift && (
            <View style={styles.activeCard}>
              <LinearGradient
                colors={["rgba(16, 185, 129, 0.2)", "rgba(16, 185, 129, 0.05)"]}
                style={styles.activeCardGradient}
              >
                <View style={styles.activeHeader}>
                  <View style={styles.activeStatus}>
                    <View style={styles.activeStatusDot} />
                    <Text style={styles.activeStatusText}>On Shift</Text>
                  </View>
                  {activeShift.check_in_time && (
                    <ShiftTimer startTime={activeShift.check_in_time} />
                  )}
                </View>

                <Text style={styles.activeVenue}>
                  {activeShift.booking?.venue?.name || activeShift.booking?.agency?.name || "Unknown Venue"}
                </Text>
                <Text style={styles.activeAddress}>
                  {activeShift.booking?.venue?.address || activeShift.check_in_address || "Address not available"}
                </Text>

                <View style={styles.activeSchedule}>
                  <Text style={styles.scheduleLabel}>Scheduled</Text>
                  <Text style={styles.scheduleTime}>
                    {formatTime(activeShift.booking?.start_time || "")} - {formatTime(activeShift.booking?.end_time || "")}
                  </Text>
                </View>

                <QuickActions
                  onBreak={handleBreak}
                  onIncident={handleIncident}
                  onEmergency={handleEmergency}
                  isOnBreak={isOnBreak}
                />

                {/* Check Out Button */}
                <TouchableOpacity
                  style={styles.checkOutBtn}
                  onPress={handleCheckOut}
                  disabled={processing}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={["#ef4444", "#dc2626"]}
                    style={styles.checkOutGradient}
                  >
                    <Text style={styles.checkOutText}>
                      {processing ? "Processing..." : "🏁 End Shift"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <View style={styles.timelineSection}>
              <Text style={styles.sectionTitle}>Shift Timeline</Text>
              {timeline.map((event, index) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  isLast={index === timeline.length - 1}
                />
              ))}
            </View>
          )}

          {/* Today's Shifts (when not active) */}
          {!activeShift && (
            <View style={styles.shiftsSection}>
              <Text style={styles.sectionTitle}>Today's Shifts</Text>
              {todaysShifts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📅</Text>
                  <Text style={styles.emptyTitle}>No Shifts Today</Text>
                  <Text style={styles.emptyText}>Check the marketplace for available shifts</Text>
                  <TouchableOpacity
                    style={styles.findShiftsBtn}
                    onPress={() => router.push("/marketplace")}
                  >
                    <Text style={styles.findShiftsBtnText}>Find Shifts</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                todaysShifts.map((shift) => (
                  <View key={shift.booking_id} style={styles.shiftCard}>
                    <View style={styles.shiftInfo}>
                      <Text style={styles.shiftVenue}>
                        {shift.booking?.venue?.name || shift.booking?.agency?.name || "Unknown"}
                      </Text>
                      <Text style={styles.shiftTime}>
                        {formatTime(shift.booking?.start_time || "")} - {formatTime(shift.booking?.end_time || "")}
                      </Text>
                      <View style={[
                        styles.shiftStatus,
                        shift.status === "checked_out" && styles.shiftStatusComplete
                      ]}>
                        <Text style={[
                          styles.shiftStatusText,
                          shift.status === "checked_out" && styles.shiftStatusTextComplete
                        ]}>
                          {shift.status === "checked_out" ? "✓ Completed" : "Pending"}
                        </Text>
                      </View>
                    </View>
                    {shift.status === "pending" && (
                      <TouchableOpacity
                        style={styles.checkInBtn}
                        onPress={() => handleCheckIn(shift)}
                        disabled={processing}
                      >
                        <LinearGradient
                          colors={[colors.accent, "#1fa89e"]}
                          style={styles.checkInGradient}
                        >
                          <Text style={styles.checkInText}>
                            {processing ? "..." : "Check In"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },

  // Map
  mapContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
  },
  mapGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(45, 212, 191, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  mapPinIcon: {
    fontSize: 24,
  },
  mapCoords: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: "monospace",
  },
  mapPlaceholderIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  mapPlaceholderText: {
    ...typography.body,
    color: colors.textMuted,
  },

  // Header
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },

  // Live Indicator
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  livePulse: {
    position: "absolute",
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  liveText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "700",
    fontSize: 10,
  },

  // Content
  contentContainer: {
    flex: 1,
    marginTop: SCREEN_HEIGHT * 0.3,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  scrollContent: {
    padding: spacing.lg,
  },

  // Active Shift Card
  activeCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  activeCardGradient: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  activeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  activeStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  activeStatusText: {
    ...typography.body,
    color: colors.success,
    fontWeight: "600",
  },
  timerContainer: {
    alignItems: "flex-end",
  },
  timerLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  timerValue: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
    fontFamily: "monospace",
  },
  activeVenue: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
    marginBottom: 4,
  },
  activeAddress: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  activeSchedule: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  scheduleLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  scheduleTime: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  quickActionActive: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  quickActionEmergency: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  quickActionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.text,
    fontSize: 11,
  },

  // Check Out Button
  checkOutBtn: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  checkOutGradient: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  checkOutText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },

  // Timeline
  timelineSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  timelineLeft: {
    width: 40,
    alignItems: "center",
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIcon: {
    fontSize: 14,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  timelineTime: {
    ...typography.caption,
    color: colors.textMuted,
  },
  timelineTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  timelineDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Shifts Section
  shiftsSection: {
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  findShiftsBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  findShiftsBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftVenue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  shiftTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  shiftStatus: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  shiftStatusComplete: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  shiftStatusText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    fontWeight: "600",
  },
  shiftStatusTextComplete: {
    color: colors.success,
  },
  checkInBtn: {
    borderRadius: radius.md,
    overflow: "hidden",
    marginLeft: spacing.md,
  },
  checkInGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  checkInText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
