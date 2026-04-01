/**
 * Account Tab - Full Dashboard
 * Shows login/signup for guests, full dashboard for signed-in users
 * Enhanced with animations and modern UI
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import {
  getProfileIdAndRole,
  getPersonnelId,
  getAgencyId,
  getVenueId,
} from "../../lib/auth";
import { colors, gradients, typography, spacing, radius } from "../../theme";
import { getPricingBreakdown } from "../../lib/pricing";
import { ShieldAI, ShieldAIButton } from "../../components/ai";
import {
  GreetingHeader,
  QuickActions,
  StatsCard,
  TodayShiftCard,
  NoShiftToday,
  UpcomingShiftsList,
} from "../../components/home";
import { AnimatedBackground } from "../../components/ui/AnimatedBackground";
import { LiveIndicator } from "../../components/ui/LiveIndicator";
import {
  EnhancedGreeting,
  EnhancedStats,
  EnhancedTodayShift,
  EnhancedNoShift,
  QuickActionButton,
} from "../../components/home/EnhancedDashboard";

const { width } = Dimensions.get("window");

function VenuePersonnelList() {
  const [staff, setStaff] = useState<{ id: string; display_name: string | null; shield_score: number | null; total_shifts: number | null; hourly_rate: number | null; city: string | null }[]>([]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, display_name, shield_score, total_shifts, hourly_rate, city")
        .eq("is_active", true)
        .order("shield_score", { ascending: false })
        .limit(6);
      if (data) setStaff(data as any[]);
    })();
  }, []);

  if (staff.length === 0) {
    return <Text style={{ ...typography.bodySmall, color: colors.textMuted }}>No personnel available yet.</Text>;
  }

  return (
    <>
      {staff.map((p) => {
        const initials = (p.display_name || "?").split(" ").map(w => w.charAt(0).toUpperCase()).slice(0, 2).join("");
        return (
          <TouchableOpacity
            key={p.id}
            style={personnelStyles.card}
            onPress={() => router.push(`/personnel/${p.id}`)}
            activeOpacity={0.75}
          >
            <View style={personnelStyles.avatar}>
              <Text style={personnelStyles.avatarText}>{initials}</Text>
            </View>
            <View style={personnelStyles.info}>
              <Text style={personnelStyles.name}>{p.display_name || "Guard"}</Text>
              <View style={personnelStyles.metaRow}>
                {p.city ? <Text style={personnelStyles.metaChip}>📍 {p.city}</Text> : null}
                <Text style={personnelStyles.metaChip}>🛡 {p.shield_score ?? 0}</Text>
                {p.total_shifts ? <Text style={personnelStyles.metaChip}>{p.total_shifts} shifts</Text> : null}
              </View>
            </View>
            <View style={personnelStyles.rateWrap}>
              <Text style={personnelStyles.rateVal}>£{p.hourly_rate ?? 16}</Text>
              <Text style={personnelStyles.rateUnit}>/hr</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const personnelStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,212,170,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  info: { flex: 1 },
  name: { ...typography.body, color: colors.text, fontWeight: "600", marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaChip: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  rateWrap: { flexDirection: "row", alignItems: "baseline" },
  rateVal: { ...typography.title, color: colors.accent, fontWeight: "700", fontSize: 16 },
  rateUnit: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginLeft: 1 },
});

const GUEST_KEY = "shield_guest_role";
const ROLE_LABEL: Record<string, string> = { venue: "Venue", personnel: "Security", agency: "Agency" };

type Booking = {
  id: string;
  event_name?: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guards_count?: number;
  rate?: number;
  currency?: string;
  status: string;
  venue_id?: string;
  venue_name?: string;
  estimated_total?: number | null;
  final_total?: number | null;
  staff_requirements?: any;
};

function getBookingCost(b: Booking): number {
  return getPricingBreakdown(b).totalGBP;
}

function getBookingStaffCount(b: Booking): number {
  return getPricingBreakdown(b).staffCount || b.guards_count || 1;
}

type Shift = {
  id: string;
  booking_id: string;
  personnel_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  venue_confirmed: boolean;
  venue_name?: string;
  event_name?: string;
  event_date?: string;
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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [activeVenueTab, setActiveVenueTab] = useState("overview");

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
      console.log("[Account] Personnel ID:", pid);
      setHasProfileRecord(!!pid);
      setPersonnelId(pid);
      if (!pid) {
        console.log("[Account] No personnel ID found, showing empty state");
        setBookings([]);
        setShifts([]);
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

      console.log("[Account] Personnel data:", personnelData);

      if (personnelData) {
        setDisplayName(personnelData.display_name || metaName || "User");
      }
      
      // Load SHIFTS for this guard (not bookings)
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select(`
          id,
          booking_id,
          personnel_id,
          role,
          hourly_rate,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          status,
          venue_confirmed,
          booking:bookings (
            id,
            event_name,
            event_date,
            venue_id,
            venues (
              id,
              name
            )
          )
        `)
        .eq("personnel_id", pid)
        .in("status", ["accepted", "checked_in", "checked_out", "pending"])
        .order("scheduled_start", { ascending: true })
        .limit(50);

      console.log("[Account] Shifts query result:", { shiftsData, shiftsError });
      
      if (shiftsError) {
        console.error("Error loading shifts:", shiftsError);
      }
      
      // Format shifts with venue info
      const formattedShifts = (shiftsData || []).map((s: any) => ({
        ...s,
        venue_name: s.booking?.venues?.name || "Unknown Venue",
        event_name: s.booking?.event_name || "Shift",
        event_date: s.booking?.event_date,
      }));
      console.log("[Account] Formatted shifts:", formattedShifts.length);
      setShifts(formattedShifts);
      
      // Also load bookings for backward compatibility
      const { data } = await supabase
        .from("bookings")
        .select(`
          id, event_name, event_date, start_time, end_time, estimated_total, final_total, status, venue_id,
          venues(name)
        `)
        .eq("provider_type", "personnel")
        .eq("provider_id", pid)
        .order("event_date", { ascending: false })
        .limit(20);
      
      const formattedBookings = (data || []).map((b: any) => ({
        ...b,
        rate: b.final_total ?? b.estimated_total ?? 0,
        currency: "GBP",
        guards_count: 0,
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
        .select("id, event_name, event_date, start_time, end_time, estimated_total, final_total, status")
        .eq("provider_type", "agency")
        .eq("provider_id", aid)
        .order("event_date", { ascending: false })
        .limit(20);
      setBookings(((data as any[]) || []).map((b) => ({
        ...b,
        rate: b.final_total ?? b.estimated_total ?? 0,
        currency: "GBP",
        guards_count: 0,
      })));
    } else if (effectiveRole === "venue") {
      const vid = await getVenueId(supabase, profileData.profileId);
      console.log("[Account] Venue role detected. profileId:", profileData.profileId, "venueId:", vid);
      setHasProfileRecord(!!vid);
      if (!vid) {
        console.log("[Account] No venue ID found, showing empty state");

        setBookings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const { data } = await supabase
        .from("bookings")
        .select("id, event_name, event_date, start_time, end_time, estimated_total, final_total, status, staff_requirements")
        .eq("venue_id", vid)
        .order("event_date", { ascending: false })
        .limit(20);
      setBookings(((data as any[]) || []).map((b) => ({
        ...b,
        rate: b.final_total ?? b.estimated_total ?? 0,
        currency: "GBP",
        guards_count: 0,
      })));
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
        <Text style={styles.subtitle}>Sign up or log in to get the most out of Shield HQ.</Text>

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
          <Text style={styles.secondaryHint}>Use your Shield HQ account (email & password).</Text>
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
  
  // Calculate shift stats
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isVenueRole = effectiveRole === "venue";
  console.log("[Account] Render: role=", effectiveRole, "isVenue=", isVenueRole, "hasProfileRecord=", hasProfileRecord, "loading=", loading);
  
  // Filter shifts by status
  const completedShifts = shifts.filter((s) => s.status === "checked_out");
  const activeShift = shifts.find((s) => s.status === "checked_in");
  const upcomingShifts = shifts.filter((s) => 
    (s.status === "accepted" || s.status === "pending") && 
    new Date(s.scheduled_start) > now
  );
  
  // Today's shift - either active or upcoming today
  const todayShift = activeShift || shifts.find((s) => {
    if (s.status !== "accepted" && s.status !== "pending") return false;
    const shiftDate = new Date(s.scheduled_start).toISOString().split('T')[0];
    return shiftDate === todayStr;
  });
  
  // Calculate earnings from completed shifts
  const totalEarnings = completedShifts.reduce((sum, s) => {
    const hours = s.actual_start && s.actual_end 
      ? (new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime()) / 3600000
      : (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 3600000;
    return sum + (hours * (s.hourly_rate || 0));
  }, 0);
  
  // Legacy bookings stats (for backward compatibility)
  const past = bookings.filter((b) => b.status === "completed");
  const upcoming = bookings.filter((b) => ["pending", "confirmed"].includes(b.status));

  // Quick actions for personnel
  const quickActions = [
    {
      id: "checkin",
      icon: "📍",
      label: activeShift ? "On Shift" : "Check In",
      badge: activeShift ? "LIVE" : undefined,
      onPress: () => {
        if (todayShift) {
          router.push(`/shift/${todayShift.id}`);
        } else {
          router.push("/(tabs)/explore");
        }
      },
    },
    {
      id: "shifts",
      icon: "🔍",
      label: "Find Shifts",
      badge: undefined,
      onPress: () => router.push("/(tabs)/explore"),
    },
    {
      id: "messages",
      icon: "💬",
      label: "Messages",
      badge: unreadMessages > 0 ? unreadMessages : undefined,
      onPress: () => router.push("/(tabs)/messages"),
    },
    {
      id: "ai",
      icon: "🛡️",
      label: "Shield AI",
      gradient: ["rgba(0, 212, 170, 0.2)", "rgba(0, 212, 170, 0.05)"] as [string, string],
      onPress: () => setShowAI(true),
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

  // Upcoming shifts for list (from shifts table, excluding today)
  const upcomingForList = upcomingShifts
    .filter((s) => {
      const shiftDate = new Date(s.scheduled_start).toISOString().split('T')[0];
      return shiftDate !== todayStr;
    })
    .slice(0, 5)
    .map((s) => {
      const hours = (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 3600000;
      return {
        id: s.id,
        venueName: s.venue_name || "Unknown Venue",
        date: s.event_date || new Date(s.scheduled_start).toISOString().split('T')[0],
        startTime: new Date(s.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(s.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        earnings: hours * (s.hourly_rate || 0),
        status: s.status === "accepted" ? "confirmed" as const : "pending" as const,
        role: s.role,
      };
    });

  if (isVenueRole) {
    const upcomingBookings = bookings.filter((b) => ["pending", "confirmed"].includes(b.status)).slice(0, 4);
    const activeCount = bookings.filter((b) => ["pending", "confirmed", "in_progress"].includes(b.status)).length;
    const completedCount = bookings.filter((b) => b.status === "completed").length;
    const totalSpend = bookings.reduce((sum, b) => sum + getBookingCost(b), 0);

    const VENUE_TABS = [
      { id: "overview", label: "Overview" },
      { id: "personnel", label: "Personnel" },
      { id: "bookings", label: "Bookings" },
      { id: "preferred", label: "Preferred Staff" },
      { id: "spend", label: "Spend Dashboard" },
      { id: "settings", label: "Settings" },
    ] as const;

    const handleVenueTab = (tabId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (tabId === "overview") { setActiveVenueTab("overview"); return; }
      switch (tabId) {
        case "personnel": router.push("/preferred-staff"); break;
        case "bookings": router.push("/venue-bookings"); break;
        case "preferred": router.push("/preferred-staff"); break;
        case "spend": router.push("/spend-dashboard"); break;
        case "settings": router.push("/venue-settings"); break;
      }
    };

    return (
      <View style={styles.container}>
        <AnimatedBackground variant="subtle" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.dashboardContent, { paddingTop: insets.top, paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {/* Hero Header */}
          <LinearGradient
            colors={["rgba(0,212,170,0.08)", "rgba(0,212,170,0.02)", "transparent"]}
            style={v.heroWrap}
          >
            <View style={v.heroRow}>
              <View style={v.heroLeft}>
                <Text style={v.heroGreeting}>Welcome back</Text>
                <Text style={v.heroName} numberOfLines={1}>{displayName || "Your Venue"}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/booking/new")} activeOpacity={0.85}>
                <LinearGradient colors={[colors.accent, "#0d9488"]} style={v.heroCta}>
                  <Text style={v.heroCtaText}>+ Book Security</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Summary strip */}
            <View style={v.summaryRow}>
              <View style={v.summaryChip}>
                <Text style={v.summaryVal}>{activeCount}</Text>
                <Text style={v.summaryLabel}>Active</Text>
              </View>
              <View style={v.summaryDot} />
              <View style={v.summaryChip}>
                <Text style={v.summaryVal}>{completedCount}</Text>
                <Text style={v.summaryLabel}>Completed</Text>
              </View>
              <View style={v.summaryDot} />
              <View style={v.summaryChip}>
                <Text style={[v.summaryVal, { color: colors.accent }]}>£{totalSpend > 0 ? totalSpend.toFixed(0) : "0"}</Text>
                <Text style={v.summaryLabel}>Total Spend</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Tab Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={v.tabScroll} contentContainerStyle={v.tabRow}>
            {VENUE_TABS.map((t) => {
              const isActive = t.id === activeVenueTab;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[v.tab, isActive && v.tabActive]}
                  onPress={() => handleVenueTab(t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[v.tabText, isActive && v.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Upcoming Bookings */}
          <View style={v.section}>
            <View style={v.sectionHead}>
              <Text style={v.sectionTitle}>Upcoming Bookings</Text>
              <TouchableOpacity onPress={() => router.push("/venue-bookings")} style={v.sectionLinkWrap}>
                <Text style={v.sectionLink}>View all</Text>
                <Text style={v.sectionArrow}>›</Text>
              </TouchableOpacity>
            </View>
            {upcomingBookings.length === 0 ? (
              <TouchableOpacity style={v.emptyCard} onPress={() => router.push("/booking/new")} activeOpacity={0.8}>
                <View style={v.emptyIconWrap}>
                  <Text style={{ fontSize: 24 }}>📅</Text>
                </View>
                <Text style={v.emptyTitle}>No upcoming bookings</Text>
                <Text style={v.emptySub}>Book security for your next event</Text>
              </TouchableOpacity>
            ) : (
              upcomingBookings.map((b) => {
                const cost = getBookingCost(b);
                const staffCount = getBookingStaffCount(b);
                const isPending = b.status === "pending";
                const dateObj = b.event_date ? new Date(b.event_date) : null;
                return (
                  <TouchableOpacity key={b.id} style={v.bookingCard} onPress={() => router.push(`/booking-manage?id=${b.id}`)} activeOpacity={0.7}>
                    {/* Date column */}
                    <View style={[v.dateBadge, isPending ? v.dateBadgePending : v.dateBadgeConfirmed]}>
                      <Text style={[v.dateDay, isPending ? v.dateDayPending : v.dateDayConfirmed]}>
                        {dateObj ? dateObj.getDate() : "—"}
                      </Text>
                      <Text style={[v.dateMonth, isPending ? v.dateMonthPending : v.dateMonthConfirmed]}>
                        {dateObj ? dateObj.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() : ""}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={v.bookingName} numberOfLines={1}>{b.event_name || "Security Booking"}</Text>
                      <Text style={v.bookingTime}>
                        {b.start_time || "—"} – {b.end_time || "—"}
                      </Text>
                      <View style={v.bookingChips}>
                        <View style={v.bookingChip}>
                          <Text style={v.bookingChipText}>👥 {staffCount}</Text>
                        </View>
                        <View style={[v.bookingStatusPill, isPending ? v.pillPending : v.pillConfirmed]}>
                          <Text style={[v.pillText, isPending ? v.pillTextPending : v.pillTextConfirmed]}>
                            {isPending ? "Pending" : "Confirmed"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Price */}
                    <Text style={v.bookingPrice}>
                      {cost > 0 ? `£${cost.toFixed(0)}` : "—"}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Available Personnel */}
          <View style={v.section}>
            <View style={v.sectionHead}>
              <Text style={v.sectionTitle}>Available Personnel</Text>
              <TouchableOpacity onPress={() => router.push("/preferred-staff")} style={v.sectionLinkWrap}>
                <Text style={v.sectionLink}>See all</Text>
                <Text style={v.sectionArrow}>›</Text>
              </TouchableOpacity>
            </View>
            <VenuePersonnelList />
          </View>

          {/* Logout */}
          <View style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleLogout(); }} activeOpacity={0.7}>
              <Text style={styles.logoutBtnText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <AnimatedBackground variant="subtle" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.dashboardContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: 120 },
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
        {/* Enhanced Greeting Header */}
        <EnhancedGreeting
          name={displayName || "User"}
          hasActiveShift={!!activeShift}
          shiftCount={upcomingShifts.length}
        />

        {/* Quick Actions Row */}
        <View style={styles.quickActionsRow}>
          {quickActions.map((action, index) => (
            <QuickActionButton
              key={action.id}
              icon={action.icon}
              label={action.label}
              onPress={action.onPress}
              badge={action.badge}
              gradient={action.gradient}
              delay={index * 100}
            />
          ))}
        </View>

        {/* Today's Shift Card - Enhanced */}
        {role === "personnel" && (
          todayShift ? (
            <EnhancedTodayShift
              venueName={todayShift.venue_name || "Unknown Venue"}
              eventName={todayShift.event_name || "Security Shift"}
              startTime={new Date(todayShift.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              endTime={new Date(todayShift.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              role={todayShift.role || "Security"}
              hourlyRate={todayShift.hourly_rate || 0}
              isActive={!!activeShift}
              onPress={() => router.push(`/shift/${todayShift.id}`)}
              onCheckIn={!activeShift ? () => router.push(`/shift/${todayShift.id}`) : undefined}
            />
          ) : (
            <EnhancedNoShift onFindShifts={() => router.push("/(tabs)/explore")} />
          )
        )}

        {/* Enhanced Stats Card */}
        <EnhancedStats
          earnings={Math.round(totalEarnings)}
          completed={completedShifts.length}
          upcoming={upcomingShifts.length}
          onPress={() => router.push("/stats")}
        />

        {/* Upcoming Shifts List */}
        {upcomingForList.length > 0 && (
          <View style={styles.upcomingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Upcoming Shifts</Text>
              <TouchableOpacity onPress={() => router.push("/upcoming-shifts")}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            {upcomingForList.map((shift, index) => (
              <AnimatedShiftCard
                key={shift.id}
                shift={shift}
                onPress={() => router.push(`/shift/${shift.id}`)}
                delay={index * 80}
              />
            ))}
          </View>
        )}

        {/* Secondary Actions */}
        <View style={styles.secondarySection}>
          <Text style={styles.sectionTitle}>🛠️ More Actions</Text>
          <View style={styles.secondaryGrid}>
            {secondaryActions.map((action, index) => (
              <TouchableOpacity
                key={action.id}
                style={styles.secondaryItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  action.onPress();
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={gradients.card}
                  style={styles.secondaryItemGradient}
                >
                  <Text style={styles.secondaryIcon}>{action.icon}</Text>
                  <Text style={styles.secondaryLabel}>{action.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity 
            style={styles.logoutBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleLogout();
            }} 
            activeOpacity={0.7}
          >
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

// Animated Shift Card Component
function AnimatedShiftCard({ 
  shift, 
  onPress, 
  delay = 0 
}: { 
  shift: any; 
  onPress: () => void; 
  delay?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <LinearGradient
          colors={gradients.card}
          style={styles.shiftCard}
        >
          <View style={styles.shiftCardHeader}>
            <Text style={styles.shiftVenue}>{shift.venueName}</Text>
            <View style={[
              styles.shiftStatus,
              shift.status === "confirmed" ? styles.statusConfirmed : styles.statusPending
            ]}>
              <Text style={[
                styles.shiftStatusText,
                shift.status === "confirmed" ? styles.statusTextConfirmed : styles.statusTextPending
              ]}>
                {shift.status === "confirmed" ? "✓ Confirmed" : "⏳ Pending"}
              </Text>
            </View>
          </View>
          <View style={styles.shiftCardDetails}>
            <View style={styles.shiftDetail}>
              <Text style={styles.shiftDetailLabel}>📅</Text>
              <Text style={styles.shiftDetailValue}>
                {new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={styles.shiftDetail}>
              <Text style={styles.shiftDetailLabel}>⏰</Text>
              <Text style={styles.shiftDetailValue}>{shift.startTime} - {shift.endTime}</Text>
            </View>
            <View style={styles.shiftDetail}>
              <Text style={styles.shiftDetailLabel}>💷</Text>
              <Text style={[styles.shiftDetailValue, { color: colors.success }]}>
                £{Math.round(shift.earnings)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const v = StyleSheet.create({
  /* ---- Hero header ---- */
  heroWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, marginBottom: spacing.sm },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  heroLeft: { flex: 1, marginRight: spacing.md },
  heroGreeting: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 2 },
  heroName: { ...typography.display, color: colors.text, fontSize: 26 },
  heroCta: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: radius.full },
  heroCtaText: { ...typography.bodySmall, color: "#000", fontWeight: "700" },

  /* ---- Summary strip ---- */
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: spacing.lg },
  summaryChip: { alignItems: "center", flex: 1 },
  summaryVal: { ...typography.title, color: colors.text, fontSize: 18, fontWeight: "700" },
  summaryLabel: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  summaryDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  /* ---- Tabs ---- */
  tabScroll: { marginBottom: spacing.lg },
  tabRow: { paddingHorizontal: spacing.lg, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { ...typography.caption, color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: "#000", fontWeight: "700" },

  /* ---- Section ---- */
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { ...typography.titleCard, color: colors.text, fontWeight: "600" },
  sectionLinkWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionLink: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  sectionArrow: { color: colors.accent, fontSize: 16, fontWeight: "600", marginTop: -1 },

  /* ---- Empty state ---- */
  emptyCard: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.xl, borderWidth: 1, borderColor: colors.glassBorder, borderStyle: "dashed" as any, paddingVertical: 28, paddingHorizontal: spacing.lg, alignItems: "center" },
  emptyIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,212,170,0.08)", alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyTitle: { ...typography.body, color: colors.text, fontWeight: "600", marginBottom: 4 },
  emptySub: { ...typography.caption, color: colors.textMuted, textAlign: "center" },

  /* ---- Booking Card ---- */
  bookingCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 14, marginBottom: 10, gap: 12 },

  dateBadge: { width: 48, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dateBadgeConfirmed: { backgroundColor: "rgba(16,185,129,0.1)" },
  dateBadgePending: { backgroundColor: "rgba(245,158,11,0.1)" },
  dateDay: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
  dateDayConfirmed: { color: "#10B981" },
  dateDayPending: { color: "#F59E0B" },
  dateMonth: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  dateMonthConfirmed: { color: "#10B981" },
  dateMonthPending: { color: "#F59E0B" },

  bookingName: { ...typography.body, color: colors.text, fontWeight: "600", marginBottom: 2 },
  bookingTime: { ...typography.caption, color: colors.textSecondary, marginBottom: 6 },
  bookingChips: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookingChip: { backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  bookingChipText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  bookingStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  pillConfirmed: { backgroundColor: "rgba(16,185,129,0.12)" },
  pillPending: { backgroundColor: "rgba(245,158,11,0.12)" },
  pillText: { fontSize: 10, fontWeight: "700" },
  pillTextConfirmed: { color: "#10B981" },
  pillTextPending: { color: "#F59E0B" },
  bookingPrice: { ...typography.title, color: colors.text, fontWeight: "700", fontSize: 17, minWidth: 40, textAlign: "right" },
});

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
  
  // Quick Actions Row
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  venueActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  venueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  venueHeaderName: {
    ...typography.display,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  venueBookBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  venueBookBtnText: {
    ...typography.bodySmall,
    color: "#000",
    fontWeight: "700",
  },
  venueTabScroll: {
    marginBottom: spacing.md,
  },
  venueTabContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  venueTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  venueTabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  venueTabText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
  venueTabTextActive: {
    color: "#000",
    fontWeight: "700",
  },
  venueEmptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingVertical: spacing.md,
  },
  venueBookingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  venueBookingLeft: { flex: 1, marginRight: spacing.md },
  venueBookingName: { ...typography.body, color: colors.text, fontWeight: "600" },
  venueBookingMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  venueBookingPrice: { ...typography.titleCard, color: colors.accent },
  
  // Section Styles
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  sectionLink: {
    ...typography.label,
    color: colors.accent,
  },
  
  // Upcoming Section
  upcomingSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  
  // Shift Card
  shiftCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  shiftCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  shiftVenue: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  shiftStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusConfirmed: {
    backgroundColor: colors.successSoft,
  },
  statusPending: {
    backgroundColor: colors.warningSoft,
  },
  shiftStatusText: {
    ...typography.caption,
    fontWeight: "600",
  },
  statusTextConfirmed: {
    color: colors.success,
  },
  statusTextPending: {
    color: colors.warning,
  },
  shiftCardDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shiftDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shiftDetailLabel: {
    fontSize: 12,
  },
  shiftDetailValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  
  // Secondary Section
  secondarySection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  secondaryItem: {
    width: (width - spacing.lg * 2 - spacing.sm * 2) / 3,
  },
  secondaryItemGradient: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  secondaryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  secondaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  
  // Logout
  logoutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  logoutBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.errorSoft,
    backgroundColor: colors.errorSoft,
    alignItems: "center",
  },
  logoutBtnText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.error,
  },
});
