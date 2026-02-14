/**
 * Premium Personnel Dashboard
 * A beautiful, animated dashboard for security personnel
 */

import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../../lib/auth";
import { colors, typography, spacing, radius } from "../../theme";
import {
  GreetingHeader,
  QuickActions,
  StatsCard,
  TodayShiftCard,
  NoShiftToday,
  UpcomingShiftsList,
} from "../../components/home";

type Booking = {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guards_count: number;
  rate: number;
  currency: string;
  status: string;
  venue_id?: string;
  venue_name?: string;
};

type UserProfile = {
  display_name: string;
  rating?: number;
};

function formatMoney(rate: number): string {
  return `£${(rate / 100).toFixed(0)}`;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(dateStr);
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function PersonnelDashboard() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ display_name: "User" });
  const [unreadMessages, setUnreadMessages] = useState(0);

  const load = useCallback(async (showRefresh = false) => {
    if (!supabase) {
      setError("Not connected");
      setLoading(false);
      return;
    }

    if (showRefresh) setRefreshing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Sign in to view your dashboard");
        return;
      }

      const profileData = await getProfileIdAndRole(supabase, user.id);
      if (!profileData) {
        setError("Complete your profile to use the dashboard.");
        return;
      }

      // Get personnel profile
      const personnelId = await getPersonnelId(supabase, profileData.profileId);
      if (!personnelId) {
        setError("No security profile found. Complete setup in the web app.");
        return;
      }

      // Load personnel details
      const { data: personnelData } = await supabase
        .from("personnel")
        .select("display_name, hourly_rate")
        .eq("id", personnelId)
        .single();

      if (personnelData) {
        setProfile({
          display_name: personnelData.display_name || "User",
        });
      }

      // Load bookings with venue names
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(`
          id, event_date, start_time, end_time, guards_count, rate, currency, status, venue_id,
          venues(name)
        `)
        .eq("provider_type", "personnel")
        .eq("provider_id", personnelId)
        .order("event_date", { ascending: false });

      const formattedBookings = (bookingsData || []).map((b: any) => ({
        ...b,
        venue_name: b.venues?.name || "Unknown Venue",
      }));

      setBookings(formattedBookings);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <LinearGradient
          colors={[colors.accent, "#1fa89e"]}
          style={styles.retryButton}
        >
          <Text style={styles.retryText} onPress={() => load()}>
            Try Again
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Process bookings
  const past = bookings.filter((b) => b.status === "completed");
  const upcoming = bookings.filter((b) => ["pending", "confirmed"].includes(b.status));
  const todayShift = upcoming.find((b) => isToday(b.event_date));
  const totalEarnings = past.reduce((s, b) => s + (b.rate || 0), 0);

  // Quick actions configuration
  const quickActions = [
    {
      id: "checkin",
      icon: "📍",
      label: "Check In",
      onPress: () => router.push("/shift-tracker"),
    },
    {
      id: "jobs",
      icon: "💼",
      label: "Jobs",
      gradient: ["rgba(16, 185, 129, 0.2)", "rgba(16, 185, 129, 0.05)"] as [string, string],
      onPress: () => router.push("/jobs"),
    },
    {
      id: "messages",
      icon: "💬",
      label: "Messages",
      badge: unreadMessages,
      onPress: () => router.push("/messages"),
    },
    {
      id: "ai",
      icon: "🛡️",
      label: "Shield AI",
      gradient: ["rgba(0, 212, 170, 0.2)", "rgba(0, 212, 170, 0.05)"] as [string, string],
      onPress: () => router.push("/ai-assistant"),
    },
  ];

  const secondaryActions = [
    {
      id: "documents",
      icon: "📄",
      label: "Documents",
      onPress: () => router.push("/documents"),
    },
    {
      id: "reviews",
      icon: "⭐",
      label: "Reviews",
      onPress: () => router.push("/reviews"),
    },
    {
      id: "profile",
      icon: "✏️",
      label: "Edit Profile",
      onPress: () => router.push("/profile-edit"),
    },
    {
      id: "analytics",
      icon: "📊",
      label: "Analytics",
      onPress: () => router.push("/analytics"),
    },
  ];

  // Upcoming shifts for list (excluding today)
  const upcomingForList = upcoming
    .filter((b) => !isToday(b.event_date))
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      venueName: b.venue_name || "Unknown Venue",
      date: b.event_date,
      startTime: b.start_time,
      endTime: b.end_time,
      earnings: b.rate / 100,
      status: b.status as "confirmed" | "pending",
    }));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Greeting Header */}
        <GreetingHeader
          name={profile.display_name}
          subtitle={
            todayShift
              ? "You have a shift today"
              : upcoming.length > 0
              ? `${upcoming.length} upcoming shift${upcoming.length !== 1 ? "s" : ""}`
              : "No upcoming shifts"
          }
          avatarEmoji="🛡️"
        />

        {/* Quick Actions */}
        <QuickActions actions={quickActions} title="Quick Actions" />

        {/* Today's Shift Card */}
        {todayShift ? (
          <TodayShiftCard
            venueName={todayShift.venue_name || "Unknown Venue"}
            venueAddress="View details for address"
            startTime={todayShift.start_time}
            endTime={todayShift.end_time}
            role="Door Supervisor"
            status="upcoming"
            onPress={() => router.push(`/shift/${todayShift.id}`)}
            onCheckIn={() => router.push("/shift-tracker")}
          />
        ) : (
          <NoShiftToday onFindShifts={() => router.push("/jobs")} />
        )}

        {/* Stats Card */}
        <StatsCard
          title="Your Stats"
          icon="📈"
          stats={[
            {
              label: "Earnings",
              value: formatMoney(totalEarnings),
              change: "12%",
              changePositive: true,
            },
            {
              label: "Completed",
              value: past.length,
            },
            {
              label: "Upcoming",
              value: upcoming.length,
            },
          ]}
          onPress={() => router.push("/analytics")}
        />

        {/* Upcoming Shifts List */}
        <UpcomingShiftsList
          shifts={upcomingForList}
          onShiftPress={(shift) => router.push(`/shift/${shift.id}`)}
          onViewAll={() => router.push("/(tabs)/account")}
        />

        {/* Secondary Quick Actions */}
        <QuickActions actions={secondaryActions} title="More Actions" />
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
    paddingHorizontal: 0,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  retryText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
