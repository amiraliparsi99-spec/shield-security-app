/**
 * Account Tab - Full Dashboard
 * Shows login/signup for guests, full dashboard for signed-in users
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import {
  getProfileIdAndRole,
  getPersonnelId,
  getAgencyId,
  getVenueId,
} from "../../lib/auth";
import { colors, typography, spacing, radius } from "../../theme";
import { ShieldAI, ShieldAIButton } from "../../components/ai";
import {
  GreetingHeader,
  QuickActions,
  StatsCard,
  TodayShiftCard,
  NoShiftToday,
  UpcomingShiftsList,
} from "../../components/home";

const GUEST_KEY = "shield_guest_role";
const ROLE_LABEL: Record<string, string> = { venue: "Venue", personnel: "Security", agency: "Agency" };

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

export default function AccountTab() {
  const insets = useSafeAreaInsets();
  const [guestRole, setGuestRole] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [hasProfileRecord, setHasProfileRecord] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const load = useCallback(async (showRefresh = false) => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    if (showRefresh) setRefreshing(true);
    
    const g = await AsyncStorage.getItem(GUEST_KEY);
    setGuestRole(g || null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setHasSession(!!session?.user?.id);
    if (!session?.user?.id) {
      setRole(null);
      setAuthRole(null);
      setBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const metaRole = session.user.user_metadata?.role as string | undefined;
    const metaName = session.user.user_metadata?.display_name as string | undefined;
    setAuthRole(metaRole || null);
    setDisplayName(metaName || null);

    const profileData = await getProfileIdAndRole(supabase, session.user.id);
    if (!profileData) {
      setRole(metaRole || null);
      setHasProfileRecord(false);
      setBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    const effectiveRole = profileData.role || metaRole;
    setRole(effectiveRole || null);

    if (effectiveRole === "personnel") {
      const pid = await getPersonnelId(supabase, profileData.profileId);
      setHasProfileRecord(!!pid);
      if (!pid) {
        setBookings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Load personnel details
      const { data: personnelData } = await supabase
        .from("personnel")
        .select("display_name, hourly_rate")
        .eq("id", pid)
        .single();

      if (personnelData) {
        setDisplayName(personnelData.display_name || metaName || "User");
      }
      
      // Load bookings with venue names
      const { data } = await supabase
        .from("bookings")
        .select(`
          id, event_date, start_time, end_time, guards_count, rate, currency, status, venue_id,
          venues(name)
        `)
        .eq("provider_type", "personnel")
        .eq("provider_id", pid)
        .order("event_date", { ascending: false })
        .limit(20);
      
      const formattedBookings = (data || []).map((b: any) => ({
        ...b,
        venue_name: b.venues?.name || "Unknown Venue",
      }));
      setBookings(formattedBookings);
    } else if (effectiveRole === "agency") {
      const aid = await getAgencyId(supabase, profileData.profileId);
      setHasProfileRecord(!!aid);
      if (!aid) {
        setBookings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const { data } = await supabase
        .from("bookings")
        .select("id, event_date, start_time, end_time, guards_count, rate, currency, status")
        .eq("provider_type", "agency")
        .eq("provider_id", aid)
        .order("event_date", { ascending: false })
        .limit(20);
      setBookings((data as Booking[]) || []);
    } else if (effectiveRole === "venue") {
      const vid = await getVenueId(supabase, profileData.profileId);
      setHasProfileRecord(!!vid);
      if (!vid) {
        setBookings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const { data } = await supabase
        .from("bookings")
        .select("id, event_date, start_time, end_time, guards_count, rate, currency, status")
        .eq("venue_id", vid)
        .order("event_date", { ascending: false })
        .limit(20);
      setBookings((data as Booking[]) || []);
    } else {
      setHasProfileRecord(false);
      setBookings([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  async function handleLogout() {
    if (hasSession && supabase) {
      await supabase.auth.signOut();
      setHasSession(false);
      setRole(null);
      setBookings([]);
    }
    await AsyncStorage.removeItem(GUEST_KEY);
    setGuestRole(null);
  }

  // Not signed in
  if (!hasSession) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
      >
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Sign up or log in to get the most out of Shield.</Text>

        {guestRole && (
          <View style={styles.status}>
            <Text style={styles.statusText}>Browsing as {ROLE_LABEL[guestRole] ?? guestRole}.</Text>
            <TouchableOpacity style={styles.changeBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.changeBtnText}>Change or log out</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.authButtons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/signup")} activeOpacity={0.7}>
            <Text style={styles.primaryBtnText}>Sign up</Text>
          </TouchableOpacity>
          <Text style={styles.primaryHint}>Choose Venue, Security, or Agency and start exploring.</Text>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/login")} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>Log in</Text>
          </TouchableOpacity>
          <Text style={styles.secondaryHint}>Use your Shield account (email & password).</Text>
        </View>
      </ScrollView>
    );
  }

  // Loading
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  // Signed in but no role - show role selection
  if (!role && !authRole) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
      >
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>You're signed in! Just one more step to get started.</Text>
        
        <View style={styles.completeProfileCard}>
          <Text style={styles.completeProfileIcon}>📝</Text>
          <Text style={styles.completeProfileTitle}>Choose Your Role</Text>
          <Text style={styles.completeProfileText}>
            Select whether you're a venue, security professional, or agency to unlock your dashboard.
          </Text>
          <TouchableOpacity 
            style={styles.completeProfileBtn} 
            onPress={() => router.push("/complete-profile")} 
            activeOpacity={0.7}
          >
            <Text style={styles.completeProfileBtnText}>Complete Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>Signed in</Text>
          <TouchableOpacity style={styles.changeBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.changeBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Has role but no profile record - show verification
  const effectiveRole = role || authRole;
  const roleLabel = ROLE_LABEL[effectiveRole || ""] || effectiveRole || "User";
  const roleIcon = effectiveRole === "personnel" ? "🛡️" : effectiveRole === "venue" ? "🏢" : effectiveRole === "agency" ? "🏛️" : "👤";

  if (!hasProfileRecord && effectiveRole) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 8, paddingBottom: 100 }]}
      >
        <Text style={styles.title}>Welcome, {displayName || roleLabel}!</Text>
        <Text style={styles.subtitle}>You're registered as a {roleLabel}</Text>
        
        <View style={styles.completeProfileCard}>
          <Text style={styles.completeProfileIcon}>{roleIcon}</Text>
          <Text style={styles.completeProfileTitle}>Complete Verification</Text>
          <Text style={styles.completeProfileText}>
            {effectiveRole === "personnel" 
              ? "Add your SIA license and details to start getting booked for shifts."
              : effectiveRole === "venue"
              ? "Complete your venue details to start posting security requests."
              : "Complete your agency profile to start managing staff and bookings."}
          </Text>
          <TouchableOpacity 
            style={styles.completeProfileBtn} 
            onPress={() => router.push("/verification")} 
            activeOpacity={0.7}
          >
            <Text style={styles.completeProfileBtnText}>Complete Verification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>Signed in as {roleLabel}</Text>
          <TouchableOpacity style={styles.changeBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.changeBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ============ FULL DASHBOARD FOR SIGNED IN USERS ============
  
  const past = bookings.filter((b) => b.status === "completed");
  const upcoming = bookings.filter((b) => ["pending", "confirmed"].includes(b.status));
  const todayShift = upcoming.find((b) => isToday(b.event_date));
  const totalEarnings = past.reduce((s, b) => s + (b.rate || 0), 0);

  // Quick actions for personnel
  const quickActions = [
    {
      id: "checkin",
      icon: "📍",
      label: "Check In",
      onPress: () => router.push("/shift-tracker"),
    },
    {
      id: "shifts",
      icon: "🔍",
      label: "Find Shifts",
      onPress: () => router.push("/marketplace"),
    },
    {
      id: "messages",
      icon: "💬",
      label: "Messages",
      badge: unreadMessages,
      onPress: () => router.push("/(tabs)/messages"),
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
      id: "cv",
      icon: "📋",
      label: "My Digital CV",
      onPress: () => router.push("/cv"),
    },
    {
      id: "training",
      icon: "🎓",
      label: "Training",
      onPress: () => router.push("/training"),
    },
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
      id: "settings",
      icon: "⚙️",
      label: "Settings",
      onPress: () => router.push("/(tabs)/settings"),
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
          styles.dashboardContent,
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
          name={displayName || "User"}
          subtitle={
            todayShift
              ? "You have a shift today"
              : upcoming.length > 0
              ? `${upcoming.length} upcoming shift${upcoming.length !== 1 ? "s" : ""}`
              : "No upcoming shifts"
          }
          avatarEmoji={roleIcon}
        />

        {/* Quick Actions */}
        <QuickActions actions={quickActions} title="Quick Actions" />

        {/* Today's Shift Card */}
        {role === "personnel" && (
          todayShift ? (
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
            <NoShiftToday onFindShifts={() => router.push("/marketplace")} />
          )
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
          onViewAll={() => router.push("/analytics")}
        />

        {/* Secondary Quick Actions */}
        <QuickActions actions={secondaryActions} title="More Actions" />

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Shield AI Modal */}
      <ShieldAI
        visible={showAI}
        onClose={() => setShowAI(false)}
        userRole={(role || authRole || "personnel") as "venue" | "personnel" | "agency"}
        userName={displayName || undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  scrollView: {
    flex: 1,
  },
  dashboardContent: {
    paddingHorizontal: 0,
  },
  authContent: { 
    paddingHorizontal: spacing.lg, 
    paddingBottom: spacing.lg 
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
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.label, color: colors.textMuted, marginTop: 6 },
  status: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusText: { ...typography.bodySmall, color: colors.text },
  changeBtn: { marginTop: spacing.sm },
  changeBtnText: { ...typography.label, color: colors.accent },
  authButtons: { marginTop: spacing.xxl },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBtn,
    alignItems: "center",
  },
  primaryBtnText: { ...typography.body, fontWeight: "600", color: colors.text },
  primaryHint: { ...typography.captionMuted, color: colors.textMuted, marginTop: 6 },
  secondaryBtn: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  secondaryBtnText: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  secondaryHint: { ...typography.captionMuted, color: colors.textMuted, marginTop: 6 },
  completeProfileCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
  },
  completeProfileIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  completeProfileTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
  },
  completeProfileText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  completeProfileBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
  },
  completeProfileBtnText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  logoutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  logoutBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  logoutBtnText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.error,
  },
});
