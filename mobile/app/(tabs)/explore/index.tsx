import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BIRMINGHAM_CENTER, BIRMINGHAM_VENUES } from "../../../data/dashboard";
import type { Venue, VenueRequest } from "../../../data/dashboard";
import { VenuesMap } from "../../../components/VenuesMap";
import { colors, typography, spacing, radius } from "../../../theme";
import { supabase } from "../../../lib/supabase";
import { getProfileIdAndRole, getPersonnelId, getVenueId, isPersonnelVerified, isPersonnelBankConnected } from "../../../lib/auth";
import { safeHaptic } from "../../../lib/haptics";
import { getApiBaseUrl } from "../../../lib/api";

type Tab = "venues" | "jobs";

interface AvailableShift {
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

// Grouped job (multiple shifts for same booking/role)
interface GroupedJob {
  booking_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  venue_name: string;
  venue_city: string;
  event_name: string;
  positions_available: number;
  shift_ids: string[];
}

interface VenueBookingItem {
  id: string;
  event_name: string;
  event_date: string | null;
  status: string;
  estimated_total: number | null;
  final_total: number | null;
}

interface RecommendedStaffItem {
  id: string;
  display_name: string | null;
  rating: number;
  shifts_count: number;
}

function filterVenues(venues: Venue[], q: string): Venue[] {
  if (!q.trim()) return venues;
  const lower = q.trim().toLowerCase();
  return venues.filter(
    (v) =>
      v.name.toLowerCase().includes(lower) ||
      (v.address && v.address.toLowerCase().includes(lower)) ||
      (v.venueType && v.venueType.toLowerCase().includes(lower)) ||
      v.openRequests.some((r) => r.title.toLowerCase().includes(lower))
  );
}

export default function ExploreTab() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("jobs"); // Default to jobs tab
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Job board state
  const [availableShifts, setAvailableShifts] = useState<AvailableShift[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [personnel, setPersonnel] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueBookings, setVenueBookings] = useState<VenueBookingItem[]>([]);
  const [recommendedStaff, setRecommendedStaff] = useState<RecommendedStaffItem[]>([]);

  const filteredVenues = useMemo(() => filterVenues(BIRMINGHAM_VENUES, search), [search]);

  // Load available jobs from Supabase
  const loadJobs = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Resolve role
      const profileData = await getProfileIdAndRole(supabase, user.id);
      if (profileData) {
        setRole(profileData.role);

        if (profileData.role === "venue") {
          const vid = await getVenueId(supabase, profileData.profileId);
          setVenueId(vid);
          if (!vid) {
            setVenueBookings([]);
            setRecommendedStaff([]);
            setAvailableShifts([]);
            return;
          }

          const { data: bookingRows } = await supabase
            .from("bookings")
            .select("id, event_name, event_date, status, estimated_total, final_total")
            .eq("venue_id", vid)
            .order("event_date", { ascending: true })
            .limit(20);

          const bookings = (bookingRows || []) as VenueBookingItem[];
          setVenueBookings(bookings);
          setAvailableShifts([]);

          const bookingIdsForStaff = bookings.map((b) => b.id);
          if (bookingIdsForStaff.length === 0) {
            setRecommendedStaff([]);
            return;
          }

          const { data: shiftRows } = await supabase
            .from("shifts")
            .select("personnel_id")
            .in("booking_id", bookingIdsForStaff)
            .not("personnel_id", "is", null);

          const personnelCount = new Map<string, number>();
          for (const row of shiftRows || []) {
            const pid = row.personnel_id as string | null;
            if (!pid) continue;
            personnelCount.set(pid, (personnelCount.get(pid) || 0) + 1);
          }

          const staffIds = [...personnelCount.keys()];
          if (staffIds.length === 0) {
            setRecommendedStaff([]);
            return;
          }

          const { data: staffRows } = await supabase
            .from("personnel")
            .select("id, display_name")
            .in("id", staffIds);

          const { data: reviewRows } = await supabase
            .from("reviews")
            .select("reviewee_id, rating")
            .in("reviewee_id", staffIds);

          const ratingsMap = new Map<string, { sum: number; count: number }>();
          for (const review of reviewRows || []) {
            const reviewee = review.reviewee_id as string | null;
            if (!reviewee) continue;
            const prev = ratingsMap.get(reviewee) || { sum: 0, count: 0 };
            ratingsMap.set(reviewee, {
              sum: prev.sum + Number(review.rating || 0),
              count: prev.count + 1,
            });
          }

          const recommended = (staffRows || [])
            .map((s) => {
              const aggregate = ratingsMap.get(s.id);
              const rating = aggregate && aggregate.count > 0 ? aggregate.sum / aggregate.count : 0;
              return {
                id: s.id,
                display_name: s.display_name || "Security Professional",
                shifts_count: personnelCount.get(s.id) || 0,
                rating,
              };
            })
            .sort((a, b) => {
              if (b.shifts_count !== a.shifts_count) return b.shifts_count - a.shifts_count;
              return b.rating - a.rating;
            })
            .slice(0, 8);

          setRecommendedStaff(recommended);
          return;
        }

        const personnelId = await getPersonnelId(supabase, profileData.profileId);
        if (personnelId) {
          const { data: personnelData } = await supabase
            .from("personnel")
            .select("*")
            .eq("id", personnelId)
            .single();
          if (personnelData) setPersonnel(personnelData);
        }
      }

      // Fetch available shifts (unclaimed, future only)
      const { data: available } = await supabase
        .from("shifts")
        .select("id, booking_id, role, hourly_rate, scheduled_start, scheduled_end")
        .is("personnel_id", null)
        .gte("scheduled_start", new Date().toISOString());

      if (!available || available.length === 0) {
        setAvailableShifts([]);
        return;
      }

      // Get booking + venue details
      const bookingIds = [...new Set(available.map((s) => s.booking_id).filter(Boolean))];
      let bookingsMap: Record<string, any> = {};

      if (bookingIds.length > 0) {
        // Try direct Supabase query first (works if RLS allows it)
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
              venues.forEach((v) => { venuesMap[v.id] = v; });
            }
          }

          bookings.forEach((b) => {
            bookingsMap[b.id] = {
              event_name: b.event_name,
              venue: venuesMap[b.venue_id] || { name: "Venue", city: "" },
            };
          });
        }

        // Fallback: if RLS blocked the query, fetch metadata via the API
        const missingIds = bookingIds.filter((id) => !bookingsMap[id]);
        if (missingIds.length > 0) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const metaRes = await fetch(`${getApiBaseUrl()}/api/shifts/metadata`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ booking_ids: missingIds }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (metaRes.ok) {
              const { data: metaData } = await metaRes.json();
              if (metaData) {
                for (const [id, meta] of Object.entries(metaData) as [string, any][]) {
                  bookingsMap[id] = {
                    event_name: meta.event_name,
                    venue: { name: meta.venue_name, city: meta.venue_city },
                  };
                }
              }
            }
          } catch {
            // API unreachable — names will fall back to defaults
          }
        }
      }

      const shifts: AvailableShift[] = available.map((s) => {
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
      });

      // Deduplicate
      const seen = new Set<string>();
      setAvailableShifts(shifts.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      }));
    } catch (e) {
      console.error("Error loading jobs:", e);
    } finally {
      setLoadingJobs(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoadingJobs(true);
    loadJobs();
    const interval = setInterval(loadJobs, 15000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const getHours = (start: string, end: string) => {
    return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000).toFixed(1);
  };

  const claimShift = async (job: GroupedJob) => {
    if (!personnel || !supabase) {
      Alert.alert("Login Required", "Please log in with your guard account to claim shifts.");
      return;
    }

    const verified = await isPersonnelVerified(supabase, personnel.id);
    if (!verified) {
      Alert.alert(
        "Verification Required",
        "You need to complete your ID and SIA licence verification before you can claim shifts.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Verify Now",
            onPress: () => router.push("/verification"),
          },
        ]
      );
      return;
    }

    const bankConnected = await isPersonnelBankConnected(supabase, personnel.id);
    if (!bankConnected) {
      Alert.alert(
        "Connect Bank Account",
        "Your identity is verified! Now connect your bank account in the Payments tab to start accepting shifts and getting paid.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Go to Payments",
            onPress: () => router.push("/(tabs)/payments"),
          },
        ]
      );
      return;
    }

    const hours = getHours(job.scheduled_start, job.scheduled_end);
    const pay = (job.hourly_rate * parseFloat(hours)).toFixed(0);
    
    // Pick the first available shift from this group
    const shiftId = job.shift_ids[0];

    Alert.alert(
      "Claim This Shift?",
      `📍 ${job.venue_name}\n📅 ${formatDate(job.scheduled_start)}\n🕐 ${formatTime(job.scheduled_start)} - ${formatTime(job.scheduled_end)}\n💰 £${pay}\n\nYou're committing to this shift.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Claim It!",
          style: "default",
          onPress: async () => {
            safeHaptic("medium");
            setClaiming(shiftId);

            if (!supabase) return;
            try {
              const { data: result, error } = await supabase.rpc("claim_shift", {
                p_shift_id: shiftId,
                p_personnel_id: personnel.id,
              });

              if (error || !result?.success) {
                safeHaptic("error");
                if (result?.error === "ALREADY_CLAIMED") {
                  Alert.alert("Too Slow!", "This shift was just claimed by another guard.");
                } else {
                  Alert.alert("Error", result?.message || "Failed to claim. Try again.");
                }
                // Remove the claimed shift from available shifts
                setAvailableShifts((prev) => prev.filter((s) => s.id !== shiftId));
                setClaiming(null);
                return;
              }

              safeHaptic("success");

              // Create Mission Control chat
              if (!supabase) return;
              try {
                await supabase.rpc("create_mission_control_chat", { p_booking_id: job.booking_id });
              } catch (chatErr) {
                console.log("Mission Control chat (non-critical):", chatErr);
              }

              // Notify venue
              if (!supabase) return;
              const { data: booking } = await supabase
                .from("bookings")
                .select("venue_id")
                .eq("id", job.booking_id)
                .single();

              if (booking?.venue_id && supabase) {
                const { data: venue } = await supabase
                  .from("venues")
                  .select("user_id")
                  .eq("id", booking.venue_id)
                  .single();

                if (venue?.user_id && supabase) {
                  await supabase.from("notifications").insert({
                    user_id: venue.user_id,
                    type: "shift",
                    title: "✅ Shift Confirmed!",
                    body: `${personnel.display_name} accepted the ${job.role} shift for ${job.event_name}`,
                    data: { booking_id: job.booking_id },
                  });
                }
              }

              // Remove just the claimed shift (others in group may still be available)
              setAvailableShifts((prev) => prev.filter((s) => s.id !== shiftId));
              Alert.alert("✅ Shift Claimed!", "You're confirmed for this job. Check Mission Control for team updates.");
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

  // Group shifts by booking + role (so 2 Door Security shifts show as "2 positions")
  const groupedJobs = useMemo((): GroupedJob[] => {
    const groups: Record<string, GroupedJob> = {};
    
    for (const shift of availableShifts) {
      const key = `${shift.booking_id}-${shift.role}`;
      
      if (!groups[key]) {
        groups[key] = {
          booking_id: shift.booking_id,
          role: shift.role,
          hourly_rate: shift.hourly_rate,
          scheduled_start: shift.scheduled_start,
          scheduled_end: shift.scheduled_end,
          venue_name: shift.venue_name,
          venue_city: shift.venue_city,
          event_name: shift.event_name,
          positions_available: 1,
          shift_ids: [shift.id],
        };
      } else {
        groups[key].positions_available += 1;
        groups[key].shift_ids.push(shift.id);
      }
    }
    
    return Object.values(groups);
  }, [availableShifts]);

  // Filter jobs by search
  const filteredJobs = useMemo(() => {
    if (!search.trim()) return groupedJobs;
    const lower = search.trim().toLowerCase();
    return groupedJobs.filter(
      (s) =>
        s.event_name.toLowerCase().includes(lower) ||
        s.venue_name.toLowerCase().includes(lower) ||
        s.venue_city.toLowerCase().includes(lower) ||
        s.role.toLowerCase().includes(lower)
    );
  }, [groupedJobs, search]);

  const isVenueRole = role === "venue";
  const roleResolved = role !== null;
  const filteredVenueBookings = useMemo(() => {
    if (!search.trim()) return venueBookings;
    const lower = search.trim().toLowerCase();
    return venueBookings.filter(
      (b) =>
        (b.event_name || "").toLowerCase().includes(lower) ||
        (b.status || "").toLowerCase().includes(lower)
    );
  }, [venueBookings, search]);

  if (loadingJobs && !roleResolved) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isVenueRole) {
    return (
      <View style={[styles.container, { paddingTop: 0 }]}>
        {/* Full-screen map with roaming guards */}
        <View style={styles.venueMapContainer}>
          <VenuesMap venues={filteredVenues} center={BIRMINGHAM_CENTER} showGuards />
        </View>

        {/* Top gradient fade for status bar readability */}
        <LinearGradient
          colors={["rgba(8,10,15,0.8)", "rgba(8,10,15,0.4)", "transparent"]}
          style={[styles.venueTopGradient, { height: insets.top + 60 }]}
          pointerEvents="none"
        />

        {/* Bottom gradient fade */}
        <LinearGradient
          colors={["transparent", "rgba(8,10,15,0.5)", "rgba(8,10,15,0.85)"]}
          style={styles.venueBottomGradient}
          pointerEvents="none"
        />

        {/* Top bar: guard count */}
        <View style={[styles.venueTopBar, { top: insets.top + spacing.sm }]}>
          <View />
          <View style={styles.venueGuardBadge}>
            <View style={styles.venueLiveDot} />
            <Text style={styles.venueGuardBadgeText}>10 guards nearby</Text>
          </View>
        </View>

        {/* Bottom action area */}
        <View style={[styles.venueBottomActions, { paddingBottom: insets.bottom + 90 }]}>
          <TouchableOpacity
            style={styles.venueBookBtn}
            onPress={() => { safeHaptic("medium"); router.push("/booking/new"); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.accent, "#1fa89e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.venueBookGradient}
            >
              <Text style={styles.venueBookBtnIcon}>🛡️</Text>
              <Text style={styles.venueBookBtnText}>Book Security</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.venueBookingsBtn}
            onPress={() => { safeHaptic("light"); router.push("/venue-bookings"); }}
            activeOpacity={0.85}
          >
            <Text style={styles.venueBookingsBtnText}>📋  View Bookings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{tab === "jobs" ? "Find Shifts" : "Explore"}</Text>
          <Text style={styles.headerSubtitle}>
            {tab === "jobs" 
              ? `${groupedJobs.length} job${groupedJobs.length !== 1 ? 's' : ''} available`
              : "Birmingham"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs: Jobs + Venues */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === "jobs" && styles.tabActiveJobs]}
            onPress={() => { setTab("jobs"); safeHaptic("selection"); }}
          >
            <View style={styles.jobsTabContent}>
              <Text style={[styles.tabText, tab === "jobs" && styles.tabTextActiveJobs]}>
                🔍 Available Jobs
              </Text>
              {groupedJobs.length > 0 && (
                <View style={styles.jobsBadge}>
                  <Text style={styles.jobsBadgeText}>{groupedJobs.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "venues" && styles.tabActive]}
            onPress={() => setTab("venues")}
          >
            <Text style={[styles.tabText, tab === "venues" && styles.tabTextActive]}>
              📍 Venues
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            tab === "venues"
              ? "Search venues, address, type or request…"
              : "Search jobs by event, venue, role…"
          }
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {/* Venues Tab */}
      {tab === "venues" && (
        <View style={styles.venuesContainer}>
          <View style={styles.mapSection}>
            <Text style={styles.mapTitle}>Birmingham venues that are hiring</Text>
            <Text style={styles.mapSubtitle}>Tap a marker for details</Text>
            <View style={styles.mapWrapper}>
              <VenuesMap venues={filteredVenues} center={BIRMINGHAM_CENTER} />
            </View>
          </View>
          <ScrollView
            style={styles.venuesList}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
          >
            <Text style={styles.sectionTitle}>LIST BY NAME</Text>
            {filteredVenues.length === 0 ? (
              <Text style={styles.noResults}>No venues match your search.</Text>
            ) : (
              filteredVenues.map((v) => {
                const totalGuards = v.openRequests.reduce((s, r) => s + r.guardsCount, 0);
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.card}
                    onPress={() => router.push(`/(tabs)/explore/venue/${v.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardTitle}>{v.name}</Text>
                    <Text style={styles.cardMeta}>{v.address}</Text>
                    <Text style={styles.highlight}>
                      {v.openRequests.length} open request{v.openRequests.length !== 1 ? "s" : ""} · {totalGuards} guards needed
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Jobs Tab */}
      {tab === "jobs" && (
        <ScrollView
          style={styles.jobsScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
          }
        >
          {/* Live banner */}
          {availableShifts.length > 0 && (
            <View style={styles.liveBanner}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {availableShifts.length} shift{availableShifts.length !== 1 ? "s" : ""} available - claim now!
              </Text>
            </View>
          )}

          {loadingJobs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Finding available shifts...</Text>
            </View>
          ) : filteredJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No shifts available</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim() ? "Try a different search" : "Check back soon for new opportunities"}
              </Text>
            </View>
          ) : (
            filteredJobs.map((job) => {
              const hours = getHours(job.scheduled_start, job.scheduled_end);
              const pay = (job.hourly_rate * parseFloat(hours)).toFixed(0);
              const firstShiftId = job.shift_ids[0];

              return (
                <View key={`${job.booking_id}-${job.role}`} style={styles.shiftCard}>
                  <View style={styles.shiftContent}>
                    <View style={styles.shiftHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shiftTitle}>{job.event_name}</Text>
                        <Text style={styles.shiftVenue}>
                          {job.venue_name}{job.venue_city ? ` · ${job.venue_city}` : ""}
                        </Text>
                      </View>
                      <View style={styles.payContainer}>
                        <Text style={styles.payAmount}>£{pay}</Text>
                        <Text style={styles.payRate}>{hours}h @ £{job.hourly_rate}/hr</Text>
                      </View>
                    </View>

                    <View style={styles.shiftDetails}>
                      <View style={styles.detailChip}>
                        <Text style={styles.detailChipText}>📅 {formatDate(job.scheduled_start)}</Text>
                      </View>
                      <View style={styles.detailChip}>
                        <Text style={styles.detailChipText}>
                          🕐 {formatTime(job.scheduled_start)} - {formatTime(job.scheduled_end)}
                        </Text>
                      </View>
                      <View style={styles.detailChip}>
                        <Text style={styles.detailChipText}>{job.role}</Text>
                      </View>
                      {job.positions_available > 1 && (
                        <View style={[styles.detailChip, styles.positionsChip]}>
                          <Text style={styles.positionsChipText}>
                            👥 {job.positions_available} positions
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.claimButton, claiming === firstShiftId && styles.claimButtonDisabled]}
                    onPress={() => claimShift(job)}
                    disabled={claiming === firstShiftId}
                    activeOpacity={0.8}
                  >
                    {claiming === firstShiftId ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.claimButtonText}>Claim This Shift</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {/* Quick link to full Jobs page */}
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => router.push("/jobs")}
            activeOpacity={0.8}
          >
            <Text style={styles.viewAllText}>View All Jobs & My Shifts →</Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  incidentBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  incidentBtnText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: "600",
  },
  headerTitle: {
    ...typography.display,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  tabsContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.sm - 2,
  },
  tabActive: {
    backgroundColor: colors.accentSoft,
  },
  tabActiveJobs: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.accent, fontWeight: "600" },
  tabTextActiveJobs: { color: "#10B981", fontWeight: "600" },
  jobsTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  jobsBadge: {
    backgroundColor: "#10B981",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  jobsBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#000",
  },
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.bodySmall,
    color: colors.text,
  },
  noResults: { ...typography.label, color: colors.textMuted, paddingVertical: spacing.xl },
  venueMapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  venueTopGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  venueBottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 1,
  },
  venueTopBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  venueGuardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,212,170,0.15)",
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.3)",
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  venueLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  venueGuardBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },
  venueBottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  venueBookBtn: {
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  venueBookGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  venueBookBtnIcon: {
    fontSize: 20,
  },
  venueBookBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  venueBookingsBtn: {
    backgroundColor: "#000",
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  venueBookingsBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  venuesContainer: { flex: 1 },
  mapSection: { paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: spacing.sm },
  mapTitle: { ...typography.bodySmall, fontWeight: "600", color: colors.text },
  mapSubtitle: { ...typography.captionMuted, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  mapWrapper: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  venuesList: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },
  sectionTitle: {
    ...typography.captionMuted,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: "600",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 10,
  },
  cardTitle: { ...typography.body, fontWeight: "600", color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  highlight: { ...typography.caption, color: colors.accent, marginTop: 6, fontWeight: "500" },

  // Jobs styles
  jobsScroll: { flex: 1 },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
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
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
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
    textAlign: "center",
  },
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 14,
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
    fontSize: 11,
  },
  shiftDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  detailChipText: {
    ...typography.body,
    color: colors.text,
    fontSize: 13,
  },
  positionsChip: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  positionsChipText: {
    ...typography.body,
    color: "#10B981",
    fontSize: 13,
    fontWeight: "600",
  },
  claimButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    alignItems: "center",
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#000",
  },
  viewAllBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  viewAllText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
});
