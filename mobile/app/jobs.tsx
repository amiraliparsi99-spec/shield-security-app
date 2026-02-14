/**
 * Jobs Screen - Uber-style Job Board for Guards
 * Claim shifts instantly, first come first served
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";

interface Shift {
  id: string;
  booking_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  venue_name: string;
  venue_city: string;
  event_name: string;
}

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [personnel, setPersonnel] = useState<any>(null);
  const [tab, setTab] = useState<"available" | "my-shifts">("available");

  const loadData = useCallback(async () => {
    console.log("🔄 Jobs: Loading data...");
    
    if (!supabase) {
      console.log("❌ Jobs: No Supabase client!");
      setLoading(false);
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log("👤 Jobs: User:", user?.id, "Error:", authError?.message);
      
      if (!user) {
        console.log("❌ Jobs: No user logged in!");
        setLoading(false);
        return;
      }

      const profileData = await getProfileIdAndRole(supabase, user.id);
      console.log("📋 Jobs: Profile data:", profileData);
      
      if (!profileData) {
        console.log("❌ Jobs: No profile found!");
        setLoading(false);
        return;
      }

      const personnelId = await getPersonnelId(supabase, profileData.profileId);
      console.log("🛡️ Jobs: Personnel ID:", personnelId);
      
      if (!personnelId) {
        console.log("❌ Jobs: No personnel ID!");
        setLoading(false);
        return;
      }

      // Get personnel details
      const { data: personnelData } = await supabase
        .from("personnel")
        .select("*")
        .eq("id", personnelId)
        .single();

      if (personnelData) {
        setPersonnel(personnelData);
      }

      // Fetch available shifts (unclaimed)
      const { data: available, error: availableError } = await supabase
        .from("shifts")
        .select("id, booking_id, role, hourly_rate, scheduled_start, scheduled_end")
        .is("personnel_id", null)
        .gte("scheduled_start", new Date().toISOString());
      
      console.log("📦 Jobs: Available shifts:", available?.length, "Error:", availableError?.message);

      // Fetch my shifts
      const { data: mine, error: mineError } = await supabase
        .from("shifts")
        .select("id, booking_id, role, hourly_rate, scheduled_start, scheduled_end")
        .eq("personnel_id", personnelId)
        .gte("scheduled_start", new Date().toISOString());
      
      console.log("📦 Jobs: My shifts:", mine?.length, "Error:", mineError?.message);

      // Get booking details
      const allShifts = [...(available || []), ...(mine || [])];
      const bookingIds = [...new Set(allShifts.map((s) => s.booking_id).filter(Boolean))];

      let bookingsMap: Record<string, any> = {};
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, event_name, venue_id")
          .in("id", bookingIds);

        if (bookings && bookings.length > 0) {
          const venueIds = [...new Set(bookings.map((b) => b.venue_id).filter(Boolean))];
          
          let venuesMap: Record<string, any> = {};
          if (venueIds.length > 0) {
            const { data: venues } = await supabase
              .from("venues")
              .select("id, name, city")
              .in("id", venueIds);

            if (venues) {
              venues.forEach((v) => {
                venuesMap[v.id] = v;
              });
            }
          }

          bookings.forEach((b) => {
            bookingsMap[b.id] = {
              event_name: b.event_name,
              venue: venuesMap[b.venue_id] || { name: "Venue", city: "" },
            };
          });
        }
      }

      const formatShift = (s: any): Shift => {
        const booking = bookingsMap[s.booking_id] || {};
        return {
          id: s.id,
          booking_id: s.booking_id,
          role: s.role,
          hourly_rate: s.hourly_rate,
          scheduled_start: s.scheduled_start,
          scheduled_end: s.scheduled_end,
          venue_name: booking.venue?.name || "Venue",
          venue_city: booking.venue?.city || "",
          event_name: booking.event_name || "Event",
        };
      };

      setAvailableShifts((available || []).map(formatShift));
      setMyShifts((mine || []).map(formatShift));
    } catch (e) {
      console.error("Error loading jobs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll for new shifts every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getHours = (start: string, end: string) => {
    return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000).toFixed(1);
  };

  const claimShift = async (shift: Shift) => {
    if (!personnel || !supabase) return;

    const hours = getHours(shift.scheduled_start, shift.scheduled_end);
    const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);

    Alert.alert(
      "Claim This Shift?",
      `📍 ${shift.venue_name}\n📅 ${formatDate(shift.scheduled_start)}\n🕐 ${formatTime(shift.scheduled_start)} - ${formatTime(shift.scheduled_end)}\n💰 £${pay}\n\nYou're committing to this shift.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Claim It!",
          style: "default",
          onPress: async () => {
            safeHaptic("medium");
            setClaiming(shift.id);

            try {
              // Use atomic claim function
              const { data: result, error } = await supabase.rpc("claim_shift", {
                p_shift_id: shift.id,
                p_personnel_id: personnel.id,
              });

              if (error || !result?.success) {
                safeHaptic("error");
                if (result?.error === "ALREADY_CLAIMED") {
                  Alert.alert("Too Slow!", "This shift was just claimed by another guard.");
                } else {
                  Alert.alert("Error", result?.message || "Failed to claim. Try again.");
                }
                setAvailableShifts((prev) => prev.filter((s) => s.id !== shift.id));
                setClaiming(null);
                return;
              }

              // Success!
              safeHaptic("success");
              
              // Notify venue
              const { data: booking } = await supabase
                .from("bookings")
                .select("venue_id")
                .eq("id", shift.booking_id)
                .single();

              if (booking?.venue_id) {
                const { data: venue } = await supabase
                  .from("venues")
                  .select("user_id")
                  .eq("id", booking.venue_id)
                  .single();

                if (venue?.user_id) {
                  await supabase.from("notifications").insert({
                    user_id: venue.user_id,
                    type: "shift",
                    title: "✅ Shift Confirmed!",
                    body: `${personnel.display_name} accepted the ${shift.role} shift for ${shift.event_name}`,
                    data: { booking_id: shift.booking_id },
                  });
                }
              }

              // Create Mission Control chat for this booking
              try {
                await supabase.rpc("create_mission_control_chat", { p_booking_id: shift.booking_id });
                console.log("Mission Control chat created for booking:", shift.booking_id);
              } catch (chatErr) {
                console.log("Mission Control chat (non-critical):", chatErr);
              }

              // Move to my shifts
              setAvailableShifts((prev) => prev.filter((s) => s.id !== shift.id));
              setMyShifts((prev) => [...prev, shift]);

              Alert.alert("✅ Shift Claimed!", "You're confirmed for this job. Mission Control is now active!");
              setTab("my-shifts");
            } catch (e) {
              console.error("Claim error:", e);
              Alert.alert("Error", "Something went wrong. Try again.");
            }

            setClaiming(null);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading jobs...</Text>
        <Text style={[styles.loadingText, { marginTop: 8, fontSize: 12 }]}>
          Connecting to server...
        </Text>
      </View>
    );
  }

  // Not logged in state
  if (!personnel) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Jobs</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptySubtitle}>
            Please log in with your security guard account to view and claim jobs
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 16 }}
            onPress={() => router.push("/login")}
          >
            <Text style={{ color: "#000", fontWeight: "bold" }}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Jobs</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Live Banner */}
      {availableShifts.length > 0 && (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {availableShifts.length} shift{availableShifts.length !== 1 ? "s" : ""} available - claim now!
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "available" && styles.tabActive]}
          onPress={() => {
            safeHaptic("selection");
            setTab("available");
          }}
        >
          <Text style={[styles.tabText, tab === "available" && styles.tabTextActive]}>
            Available ({availableShifts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "my-shifts" && styles.tabActive]}
          onPress={() => {
            safeHaptic("selection");
            setTab("my-shifts");
          }}
        >
          <Text style={[styles.tabText, tab === "my-shifts" && styles.tabTextActive]}>
            My Shifts ({myShifts.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
      >
        {/* Available Shifts */}
        {tab === "available" && (
          <>
            {availableShifts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No shifts available</Text>
                <Text style={styles.emptySubtitle}>Check back soon for new opportunities</Text>
              </View>
            ) : (
              availableShifts.map((shift) => {
                const hours = getHours(shift.scheduled_start, shift.scheduled_end);
                const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);

                return (
                  <View key={shift.id} style={styles.shiftCard}>
                    <View style={styles.shiftContent}>
                      <View style={styles.shiftHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shiftTitle}>{shift.event_name}</Text>
                          <Text style={styles.shiftVenue}>
                            {shift.venue_name} • {shift.venue_city}
                          </Text>
                        </View>
                        <View style={styles.payContainer}>
                          <Text style={styles.payAmount}>£{pay}</Text>
                          <Text style={styles.payRate}>{hours}h @ £{shift.hourly_rate}/hr</Text>
                        </View>
                      </View>

                      <View style={styles.shiftDetails}>
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipText}>📅 {formatDate(shift.scheduled_start)}</Text>
                        </View>
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipText}>
                            🕐 {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
                          </Text>
                        </View>
                        <View style={styles.detailChip}>
                          <Text style={styles.detailChipText}>{shift.role}</Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.claimButton, claiming === shift.id && styles.claimButtonDisabled]}
                      onPress={() => claimShift(shift)}
                      disabled={claiming === shift.id}
                    >
                      {claiming === shift.id ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.claimButtonText}>Claim This Shift</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* My Shifts */}
        {tab === "my-shifts" && (
          <>
            {myShifts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗓️</Text>
                <Text style={styles.emptyTitle}>No upcoming shifts</Text>
                <Text style={styles.emptySubtitle}>Claim a shift from the Available tab</Text>
              </View>
            ) : (
              myShifts.map((shift) => {
                const hours = getHours(shift.scheduled_start, shift.scheduled_end);
                const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);

                return (
                  <View key={shift.id} style={styles.myShiftCard}>
                    <View style={styles.confirmedBadge}>
                      <Text style={styles.confirmedBadgeText}>CONFIRMED</Text>
                    </View>

                    <View style={styles.shiftHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shiftTitle}>{shift.event_name}</Text>
                        <Text style={styles.shiftVenue}>
                          {shift.venue_name} • {shift.venue_city}
                        </Text>
                      </View>
                      <View style={styles.payContainer}>
                        <Text style={styles.payAmount}>£{pay}</Text>
                        <Text style={styles.payRate}>{hours}h</Text>
                      </View>
                    </View>

                    <View style={styles.shiftDetails}>
                      <View style={styles.myShiftChip}>
                        <Text style={styles.myShiftChipText}>📅 {formatDate(shift.scheduled_start)}</Text>
                      </View>
                      <View style={styles.myShiftChip}>
                        <Text style={styles.myShiftChipText}>
                          🕐 {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
                        </Text>
                      </View>
                      <View style={styles.myShiftChip}>
                        <Text style={styles.myShiftChipText}>{shift.role}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveText: {
    ...typography.body,
    color: "#10B981",
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    ...typography.body,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: "#000",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
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
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  shiftContent: {
    padding: spacing.lg,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  shiftTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 18,
  },
  shiftVenue: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  payContainer: {
    alignItems: "flex-end",
  },
  payAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
  },
  payRate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  shiftDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailChip: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  detailChipText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  claimButton: {
    backgroundColor: "#10B981",
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  myShiftCard: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  confirmedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#10B981",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  confirmedBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
  },
  myShiftChip: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  myShiftChipText: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
});
