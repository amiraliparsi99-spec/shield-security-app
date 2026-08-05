import { router, useLocalSearchParams } from "expo-router";
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
import { colors, typography, spacing, radius, gradients, shadows } from "../../../theme";
import { supabase } from "../../../lib/supabase";
import { getProfileIdAndRole, getPersonnelId, getVenueId, isPersonnelVerified, isPersonnelBankConnected } from "../../../lib/auth";
import { safeHaptic } from "../../../lib/haptics";
import { getApiBaseUrl } from "../../../lib/api";
import { getClaimAvailabilityWarning } from "../../../lib/shiftAvailabilityClaimCheck";
import { getLatestShieldBlogPost } from "../../../data/shield-blog";
import { COURSES } from "../../training";
import { claimShiftWithLocation } from "../../../lib/shiftClaim";
import {
  isActiveUrgentCover,
  isClaimableOnMarketplace,
  remainingMinutes,
} from "../../../lib/shiftMarketplace";
import { ShiftsMapView } from "../../../components/shifts/ShiftsMapView";
import { GuestShiftFeed } from "../../../components/guest/GuestShiftFeed";
import { ScheduledShifts } from "../../../components/ScheduledShifts";
import {
  SAMPLE_SHIFTS_CENTER,
  sampleShiftsAroundCenter,
} from "../../../data/sample-shifts";
import { useGuestLocation } from "../../../lib/guestLocation";
import { bookingDisplayName } from "../../../lib/bookingDisplay";
import { locationSummaryOneLine } from "../../../lib/bookingLocation";

interface AvailableShift {
  id: string;
  booking_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  created_at?: string;
  venue_name: string;
  venue_city: string;
  event_name: string;
  address_line?: string | null;
  /** Site (booking) coords first, falling back to venue coords. Either may be null. */
  latitude: number | null;
  longitude: number | null;
  is_urgent_cover?: boolean;
  minutes_remaining?: number;
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
  address_line?: string | null;
  positions_available: number;
  shift_ids: string[];
  latitude: number | null;
  longitude: number | null;
  is_urgent_cover?: boolean;
  minutes_remaining?: number;
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

/** Number of course tiles on Explore (grid of compact cards) */
const EXPLORE_TRAINING_TILE_COUNT = 4;

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
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map" | "scheduled">("list");
  const [scheduledCount, setScheduledCount] = useState(0);
  // null = checking; true = signed in; false = guest (show sample shifts)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Deep link: a tapped "shift scheduled" notification routes here with
  // ?view=scheduled so the guard lands straight on their pending assignments.
  const { view: viewParam } = useLocalSearchParams<{ view?: string }>();
  useEffect(() => {
    if (viewParam === "scheduled") setViewMode("scheduled");
  }, [viewParam]);

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      return;
    }
    const sb = supabase;
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthenticated(!!data.session?.user?.id);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthenticated(!!session?.user?.id);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const goSignup = useCallback(() => {
    safeHaptic("selection");
    router.push("/signup?next=/(tabs)/explore");
  }, []);

  // Pull device location only for guests so we can scatter sample shifts
  // around them. Signed-in users use real data and don't need this prompt.
  const guestLocation = useGuestLocation({ skip: isAuthenticated !== false });

  // Sample jobs to show on the map / feed for signed-out guests. Centred on
  // the device's coords when available, otherwise on Central London.
  const sampleMapJobs = useMemo(() => {
    const center = guestLocation
      ? { lat: guestLocation.lat, lng: guestLocation.lng }
      : SAMPLE_SHIFTS_CENTER;
    return sampleShiftsAroundCenter(center, guestLocation?.label ?? null);
  }, [guestLocation]);

  const guestMapFallbackCenter = guestLocation
    ? { lat: guestLocation.lat, lng: guestLocation.lng }
    : SAMPLE_SHIFTS_CENTER;


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

      // Unassigned pending shifts only — in-progress slots appear when flagged urgent cover.
      const { data: available } = await supabase
        .from("shifts")
        .select(
          "id, booking_id, role, hourly_rate, scheduled_start, scheduled_end, created_at, status, personnel_id, is_urgent, dispatcher_status, cover_search_wave",
        )
        .is("personnel_id", null)
        .eq("status", "pending")
        .gte("scheduled_end", new Date().toISOString());

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
          .select("id, event_name, venue_id, site_label, site_address_text, site_latitude, site_longitude, status")
          .in("id", bookingIds);

        if (bookings && bookings.length > 0) {
          const venueIds = [...new Set(bookings.map((b) => b.venue_id).filter(Boolean))];
          let venuesMap: Record<string, any> = {};

          if (venueIds.length > 0) {
            const { data: venues } = await supabase
              .from("venues")
              .select("id, name, city, latitude, longitude, address_line1, postcode")
              .in("id", venueIds);
            if (venues) {
              venues.forEach((v) => { venuesMap[v.id] = v; });
            }
          }

          bookings.forEach((b: any) => {
            const venue = venuesMap[b.venue_id] || {
              name: b.site_label || "Venue",
              city: "",
              latitude: null,
              longitude: null,
              address_line1: null,
              postcode: null,
            };
            const bookingSource = {
              event_name: b.event_name,
              site_label: b.site_label,
              site_address_text: b.site_address_text,
              site_latitude: b.site_latitude,
              site_longitude: b.site_longitude,
              venue,
            };
            bookingsMap[b.id] = {
              ...bookingSource,
              latitude: b.site_latitude ?? venue.latitude ?? null,
              longitude: b.site_longitude ?? venue.longitude ?? null,
              venue_name: bookingDisplayName(bookingSource),
              address_line: locationSummaryOneLine(bookingSource),
              status: b.status ?? null,
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
                  const bookingSource = {
                    event_name: meta.event_name,
                    site_label: meta.site_label,
                    site_address_text: meta.site_address_text,
                    site_latitude: meta.site_latitude,
                    site_longitude: meta.site_longitude,
                    venue: {
                      name: meta.venue_name,
                      city: meta.venue_city,
                      address_line1: meta.venue_address_line1,
                      postcode: meta.venue_postcode,
                    },
                  };
                  bookingsMap[id] = {
                    ...bookingSource,
                    latitude: meta.site_latitude ?? null,
                    longitude: meta.site_longitude ?? null,
                    venue_name: bookingDisplayName(bookingSource),
                    address_line: locationSummaryOneLine(bookingSource),
                  };
                }
              }
            }
          } catch {
            // API unreachable — names will fall back to defaults
          }
        }
      }

      // Hide agency self-managed roster shifts from the open board — they're
      // assigned directly by the agency, not claimable here. Tolerant of the
      // 0068 column not existing yet.
      let selfManagedBookings = new Set<string>();
      try {
        const sm = await supabase
          .from("bookings")
          .select("id, self_managed")
          .in("id", bookingIds);
        if (sm.data) {
          selfManagedBookings = new Set(
            (sm.data as { id: string; self_managed?: boolean | null }[])
              .filter((r) => r.self_managed)
              .map((r) => r.id),
          );
        }
      } catch {
        // column absent — show everything
      }

      const nowMs = Date.now();
      const shifts: AvailableShift[] = available
        .filter((s) => {
          const booking = bookingsMap[s.booking_id] || {};
          return isClaimableOnMarketplace(
            {
              status: s.status,
              personnel_id: s.personnel_id,
              scheduled_start: s.scheduled_start,
              scheduled_end: s.scheduled_end,
              is_urgent: s.is_urgent,
              dispatcher_status: s.dispatcher_status,
              cover_search_wave: s.cover_search_wave,
            },
            {
              bookingStatus: booking.status,
              selfManaged: selfManagedBookings.has(s.booking_id),
              nowMs,
            },
          );
        })
        .filter((s) => !selfManagedBookings.has(s.booking_id))
        .map((s) => {
          const booking = bookingsMap[s.booking_id] || {};
          const urgent = isActiveUrgentCover(
            {
              status: s.status,
              personnel_id: s.personnel_id,
              scheduled_start: s.scheduled_start,
              scheduled_end: s.scheduled_end,
              is_urgent: s.is_urgent,
              dispatcher_status: s.dispatcher_status,
              cover_search_wave: s.cover_search_wave,
            },
            nowMs,
          );
          return {
            id: s.id,
            booking_id: s.booking_id,
            role: s.role,
            hourly_rate: s.hourly_rate,
            scheduled_start: s.scheduled_start,
            scheduled_end: s.scheduled_end,
            created_at: s.created_at,
            venue_name: booking.venue_name || bookingDisplayName(booking) || "Venue",
            venue_city: booking.venue?.city || "",
            event_name: booking.event_name || "Event",
            address_line: booking.address_line ?? locationSummaryOneLine(booking),
            latitude: booking.latitude ?? null,
            longitude: booking.longitude ?? null,
            is_urgent_cover: urgent,
            minutes_remaining: remainingMinutes(s.scheduled_end, nowMs),
          };
        });

      shifts.sort((a, b) => {
        if (b.hourly_rate !== a.hourly_rate) return b.hourly_rate - a.hourly_rate;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        if (bCreated !== aCreated) return bCreated - aCreated;
        return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
      });

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

    const shiftId = job.shift_ids[0];

    const showClaimConfirmation = () => {
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
                await claimShiftWithLocation(shiftId, personnel.id);

                safeHaptic("success");

                if (!supabase) return;
                try {
                  await supabase.rpc("create_mission_control_chat", { p_booking_id: job.booking_id });
                } catch (chatErr) {
                  console.log("Mission Control chat (non-critical):", chatErr);
                }

                if (!supabase) return;
                const { data: booking } = await supabase
                  .from("bookings")
                  .select("venue_id, agency_id")
                  .eq("id", job.booking_id)
                  .single();

                let ownerUserId: string | null = null;
                if (booking?.venue_id && supabase) {
                  const { data: venue } = await supabase
                    .from("venues")
                    .select("user_id")
                    .eq("id", booking.venue_id)
                    .single();
                  ownerUserId = venue?.user_id ?? null;
                } else if (booking?.agency_id && supabase) {
                  const { data: agency } = await supabase
                    .from("agencies")
                    .select("user_id")
                    .eq("id", booking.agency_id)
                    .single();
                  ownerUserId = agency?.user_id ?? null;
                }

                if (ownerUserId && supabase) {
                  await supabase.from("notifications").insert({
                    user_id: ownerUserId,
                    type: "shift",
                    title: "✅ Shift Confirmed!",
                    body: `${personnel.display_name} accepted the ${job.role} shift for ${job.event_name}`,
                    data: { booking_id: job.booking_id },
                  });
                }

                setAvailableShifts((prev) => prev.filter((s) => s.id !== shiftId));
                Alert.alert("✅ Shift Claimed!", "You're confirmed for this job. Check Mission Control for team updates.");
              } catch (e: any) {
                const msg = String(e?.message || "");
                if (msg.toLowerCase().includes("already been claimed")) {
                  safeHaptic("error");
                  Alert.alert("Too Slow!", "This shift was just claimed by another guard.");
                  setAvailableShifts((prev) => prev.filter((s) => s.id !== shiftId));
                  setClaiming(null);
                  return;
                }
                console.error("Claim error:", e);
                if (e?.debug) {
                  console.log("[claim] debug:", JSON.stringify(e.debug, null, 2));
                }
                Alert.alert("Error", msg || "Something went wrong. Try again.");
              }

              setClaiming(null);
            },
          },
        ]
      );
    };

    try {
      const warning = await getClaimAvailabilityWarning(
        supabase,
        personnel.id,
        job.scheduled_start,
        job.scheduled_end
      );
      if (warning.shouldWarn) {
        Alert.alert(warning.title, warning.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Claim anyway", onPress: showClaimConfirmation },
        ]);
        return;
      }
    } catch (e) {
      console.warn("Availability check (non-blocking):", e);
    }

    showClaimConfirmation();
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
          address_line: shift.address_line,
          positions_available: 1,
          shift_ids: [shift.id],
          latitude: shift.latitude,
          longitude: shift.longitude,
          is_urgent_cover: shift.is_urgent_cover,
          minutes_remaining: shift.minutes_remaining,
        };
      } else {
        groups[key].positions_available += 1;
        groups[key].shift_ids.push(shift.id);
        if (shift.is_urgent_cover) {
          groups[key].is_urgent_cover = true;
          groups[key].minutes_remaining = shift.minutes_remaining;
        }
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
        (s.address_line && s.address_line.toLowerCase().includes(lower)) ||
        s.role.toLowerCase().includes(lower)
    );
  }, [groupedJobs, search]);

  const featuredJobs = useMemo(() => {
    if (filteredJobs.length < 2) return [];
    return [...filteredJobs]
      .sort((a, b) => {
        if (b.hourly_rate !== a.hourly_rate) return b.hourly_rate - a.hourly_rate;
        return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
      })
      .slice(0, 5);
  }, [filteredJobs]);

  const latestBlogPost = useMemo(() => getLatestShieldBlogPost(), []);

  const exploreTrainingCourses = useMemo(
    () => COURSES.slice(0, EXPLORE_TRAINING_TILE_COUNT),
    []
  );

  const topJob = filteredJobs.length > 0 ? filteredJobs[0] : null;
  const remainingJobs = topJob ? filteredJobs.slice(1) : [];

  const renderJobCard = (job: GroupedJob, keyPrefix = "") => {
    const hours = getHours(job.scheduled_start, job.scheduled_end);
    const pay = (job.hourly_rate * parseFloat(hours)).toFixed(0);
    const firstShiftId = job.shift_ids[0];
    return (
      <View key={`${keyPrefix}${job.booking_id}-${job.role}`} style={styles.shiftCardOuter}>
        <LinearGradient
          colors={["rgba(0,212,170,0.14)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shiftCard}
        >
          <TouchableOpacity
            style={styles.shiftContent}
            activeOpacity={0.9}
            onPress={() => router.push(`/job/${firstShiftId}`)}
          >
            <View style={styles.shiftHeader}>
              <View style={{ flex: 1 }}>
                {job.is_urgent_cover ? (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentBadgeText}>
                      URGENT COVER · {job.minutes_remaining ?? "?"} min left
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.shiftTitle}>{job.event_name}</Text>
                <Text style={styles.shiftVenue}>
                  {job.venue_name}
                  {job.venue_city ? ` · ${job.venue_city}` : ""}
                </Text>
                {job.address_line ? (
                  <Text style={styles.shiftAddress} numberOfLines={2}>
                    📍 {job.address_line}
                  </Text>
                ) : null}
              </View>
              <View style={styles.payContainer}>
                <Text style={styles.payAmount}>£{pay}</Text>
                <Text style={styles.payRate}>
                  {hours}h · £{job.hourly_rate}/hr
                </Text>
              </View>
            </View>

            <View style={styles.shiftDetails}>
              <View style={styles.detailChip}>
                <Text style={styles.detailChipText}>{formatDate(job.scheduled_start)}</Text>
              </View>
              <View style={styles.detailChip}>
                <Text style={styles.detailChipText}>
                  {formatTime(job.scheduled_start)} – {formatTime(job.scheduled_end)}
                </Text>
              </View>
              <View style={styles.detailChip}>
                <Text style={styles.detailChipText}>{job.role}</Text>
              </View>
              {job.positions_available > 1 && (
                <View style={[styles.detailChip, styles.positionsChip]}>
                  <Text style={styles.positionsChipText}>
                    {job.positions_available} spots
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.claimButtonWrap, claiming === firstShiftId && styles.claimButtonDisabled]}
            onPress={() => claimShift(job)}
            disabled={claiming === firstShiftId}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.claimButton}
            >
              {claiming === firstShiftId ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#03120f" />
                  <Text style={styles.claimButtonText}>Claiming…</Text>
                </View>
              ) : (
                <Text style={styles.claimButtonText}>
                  {job.is_urgent_cover ? "Accept urgent cover" : "Claim this shift"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  const isVenueRole = role === "venue";
  const roleResolved = role !== null;

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
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a1614", colors.background, colors.background]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={[styles.screenBody, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {viewMode === "scheduled" ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>Your roster</Text>
            <Text style={styles.headerTitle}>Scheduled shifts</Text>
            <Text style={styles.headerSubtitle}>
              {isAuthenticated === false
                ? "Sign in to see shifts your agency assigns you"
                : scheduledCount === 0
                  ? "When your agency schedules you, shifts appear here"
                  : `${scheduledCount} upcoming shift${scheduledCount !== 1 ? "s" : ""} · filter by upcoming or past`}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              isAuthenticated === false ? goSignup() : router.push("/jobs")
            }
          >
            <Text style={styles.headerEyebrow}>Open shifts</Text>
            <Text style={styles.headerTitle}>Find work</Text>
            <Text style={styles.headerSubtitle}>
              {isAuthenticated === false
                ? `${sampleMapJobs.length} roles open near ${
                    guestLocation?.label?.trim() || "you"
                  } · sign up to claim`
                : `${groupedJobs.length} role${groupedJobs.length !== 1 ? "s" : ""} open near you`}
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ width: 40 }} />
      </View>

      {/* Search — open shifts only */}
      {viewMode !== "scheduled" && (
      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <Text style={styles.searchGlyph} accessibilityElementsHidden>
            ⌕
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Event, venue, city, role…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>
      </View>
      )}

      {/* List ↔ Map toggle */}
      <View style={styles.viewToggleWrap}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
            onPress={() => {
              safeHaptic("selection");
              setViewMode("list");
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.viewToggleText, viewMode === "list" && styles.viewToggleTextActive]}>
              ☰  List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "map" && styles.viewToggleBtnActive]}
            onPress={() => {
              safeHaptic("selection");
              setViewMode("map");
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.viewToggleText, viewMode === "map" && styles.viewToggleTextActive]}>
              ◉  Map
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === "scheduled" && styles.viewToggleBtnActive]}
            onPress={() => {
              safeHaptic("selection");
              setViewMode("scheduled");
            }}
            activeOpacity={0.85}
          >
            <View style={styles.viewToggleLabelRow}>
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === "scheduled" && styles.viewToggleTextActive,
                ]}
              >
                Scheduled
              </Text>
              {scheduledCount > 0 ? (
                <View
                  style={[
                    styles.viewToggleBadge,
                    viewMode === "scheduled" && styles.viewToggleBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.viewToggleBadgeEmoji,
                      viewMode === "scheduled" && styles.viewToggleBadgeTextActive,
                    ]}
                  >
                    🗓
                  </Text>
                  <Text
                    style={[
                      styles.viewToggleBadgeCount,
                      viewMode === "scheduled" && styles.viewToggleBadgeTextActive,
                    ]}
                  >
                    {scheduledCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === "scheduled" ? (
        <ScrollView
          style={styles.jobsScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          {isAuthenticated === false ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗓️</Text>
              <Text style={styles.emptyTitle}>Sign in to see scheduled shifts</Text>
              <Text style={styles.emptySubtitle}>
                Agency-scheduled shifts you can accept or decline appear here.
              </Text>
            </View>
          ) : (
            <ScheduledShifts onCountChange={setScheduledCount} />
          )}
        </ScrollView>
      ) : viewMode === "map" ? (
        <View style={styles.mapWrap}>
          {isAuthenticated === false ? (
            <ShiftsMapView
              jobs={sampleMapJobs}
              fallbackCenter={guestMapFallbackCenter}
              bottomInset={insets.bottom + 72}
              onPressClaim={goSignup}
              onPressDetails={goSignup}
            />
          ) : loadingJobs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Finding available shifts…</Text>
            </View>
          ) : (
            <ShiftsMapView
              jobs={filteredJobs}
              fallbackCenter={BIRMINGHAM_CENTER}
              bottomInset={insets.bottom + 72}
              onPressClaim={(job) => claimShift(job as GroupedJob)}
              onPressDetails={(job) => router.push(`/job/${job.shift_ids[0]}`)}
            />
          )}
        </View>
      ) : (
      <ScrollView
        style={styles.jobsScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
          {isAuthenticated === false ? (
            <GuestShiftFeed
              onClaim={goSignup}
              locationLabel={guestLocation?.label}
              userLocation={
                guestLocation
                  ? { lat: guestLocation.lat, lng: guestLocation.lng }
                  : null
              }
            />
          ) : loadingJobs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Finding available shifts...</Text>
            </View>
          ) : topJob ? (
            <>
              {availableShifts.length > 0 && (
                <View style={styles.liveBanner}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    {availableShifts.length} shift{availableShifts.length !== 1 ? "s" : ""} available – claim now!
                  </Text>
                </View>
              )}
              {renderJobCard(topJob, "top-")}
              <TouchableOpacity
                style={styles.exploreMoreBtn}
                onPress={() => router.push("/jobs")}
                activeOpacity={0.85}
              >
                <Text style={styles.exploreMoreBtnText}>Explore more jobs</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No shifts available</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim() ? "Try a different search" : "Check back soon for new opportunities"}
              </Text>
            </View>
          )}

          {featuredJobs.length > 0 && (
            <View style={styles.featuredSection}>
              <View style={styles.inlineSectionHeader}>
                <Text style={styles.inlineSectionTitle}>Featured shifts</Text>
                <Text style={styles.inlineSectionSub}>Top pay first</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
                {featuredJobs.map((job, idx) => {
                  const hours = getHours(job.scheduled_start, job.scheduled_end);
                  const pay = (job.hourly_rate * parseFloat(hours)).toFixed(0);
                  return (
                    <TouchableOpacity
                      key={`${job.booking_id}-${job.role}-featured`}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/job/${job.shift_ids[0]}`)}
                    >
                      <LinearGradient
                        colors={idx % 2 === 0 ? gradients.premium : gradients.success}
                        style={styles.featuredCard}
                      >
                        <Text style={styles.featuredVenue}>{job.venue_name}</Text>
                        {job.address_line ? (
                          <Text style={styles.featuredAddress} numberOfLines={1}>
                            📍 {job.address_line}
                          </Text>
                        ) : null}
                        <Text style={styles.featuredEvent}>{job.event_name}</Text>
                        <Text style={styles.featuredMeta}>
                          {formatDate(job.scheduled_start)} · {formatTime(job.scheduled_start)}
                        </Text>
                        <Text style={styles.featuredPay}>£{pay}</Text>
                        <TouchableOpacity style={styles.featuredClaimBtn} onPress={() => claimShift(job)} activeOpacity={0.85}>
                          <Text style={styles.featuredClaimText}>Claim</Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {latestBlogPost ? (
            <TouchableOpacity
              style={styles.blogCard}
              activeOpacity={0.9}
              onPress={() => router.push(`/blog/${latestBlogPost.slug}`)}
            >
              <View style={styles.inlineSectionHeader}>
                <Text style={styles.inlineSectionTitle}>Shield Weekly</Text>
                <Text style={styles.inlineSectionSub}>Editorial</Text>
              </View>
              <Text style={styles.blogCardTitle}>{latestBlogPost.title}</Text>
              <Text style={styles.blogCardExcerpt} numberOfLines={3}>
                {latestBlogPost.excerpt}
              </Text>
              <Text style={styles.blogCardLink}>Read article →</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.trainingSection}>
            <View style={styles.trainingSectionHeader}>
              <Text style={styles.inlineSectionTitle}>Keep your edge</Text>
              <TouchableOpacity
                onPress={() => {
                  safeHaptic("light");
                  router.push("/training");
                }}
                hitSlop={8}
                activeOpacity={0.75}
              >
                <Text style={styles.viewAllTraining}>View all training</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.trainingGrid}>
              {exploreTrainingCourses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={styles.trainingMiniCard}
                  onPress={() => {
                    safeHaptic("selection");
                    router.push("/training");
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.trainingMiniBadge}>{course.badge}</Text>
                  <Text style={styles.trainingMiniTitle} numberOfLines={2}>
                    {course.title}
                  </Text>
                  <Text style={styles.trainingMiniMeta}>
                    {course.duration} min · {course.points} pts
                  </Text>
                  {course.progress != null ? (
                    <View style={styles.trainingMiniTrack}>
                      <View style={[styles.trainingMiniFill, { width: `${course.progress}%` }]} />
                    </View>
                  ) : (
                    <View style={styles.trainingMiniTrackPlaceholder} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {remainingJobs.map((job) => renderJobCard(job, "rest-"))}

          <TouchableOpacity
            style={styles.viewAllBtnOuter}
            onPress={() => {
              safeHaptic("medium");
              router.push("/jobs");
            }}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["rgba(0,212,170,0.18)", "rgba(13,148,136,0.12)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.viewAllBtn}
            >
              <Text style={styles.viewAllBtnTitle}>All jobs & my shifts</Text>
              <Text style={styles.viewAllBtnSub}>Browse listings, upcoming work, and history</Text>
              <View style={styles.viewAllBtnRow}>
                <Text style={styles.viewAllBtnCta}>Open jobs</Text>
                <Text style={styles.viewAllBtnArrow}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screenBody: { flex: 1, zIndex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  headerEyebrow: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: 4,
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
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 13,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 1,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    ...shadows.subtle,
  },
  searchGlyph: {
    fontSize: 18,
    color: colors.accent,
    marginRight: spacing.sm,
    opacity: 0.85,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingVertical: 14,
    paddingRight: spacing.sm,
    ...typography.bodySmall,
    color: colors.text,
  },
  noResults: { ...typography.label, color: colors.textMuted, paddingVertical: spacing.xl },
  viewToggleWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 1,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.45)",
  },
  viewToggleText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  viewToggleTextActive: {
    color: colors.accentLight,
    fontWeight: "700",
  },
  viewToggleLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  viewToggleBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  viewToggleBadgeActive: {
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  viewToggleBadgeEmoji: {
    fontSize: 10,
    lineHeight: 12,
    marginTop: -1,
  },
  viewToggleBadgeCount: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 12,
    color: colors.textMuted,
    includeFontPadding: false,
  },
  viewToggleBadgeTextActive: {
    color: colors.accentLight,
  },
  mapWrap: { flex: 1, zIndex: 1 },
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
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: 100 },
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
  jobsScroll: { flex: 1, zIndex: 1 },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.35)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    flex: 1,
    ...typography.body,
    color: colors.successLight,
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
    paddingHorizontal: spacing.md,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: spacing.md,
    opacity: 0.85,
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
  shiftCardOuter: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    ...shadows.subtle,
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  shiftCard: {
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
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
  urgentBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    borderColor: "rgba(251, 191, 36, 0.45)",
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  urgentBadgeText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  shiftVenue: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
    fontSize: 14,
  },
  shiftAddress: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  payContainer: {
    alignItems: "flex-end",
  },
  payAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.accentLight,
    letterSpacing: -0.5,
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
    backgroundColor: colors.glassStrong,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  detailChipText: {
    ...typography.body,
    color: colors.text,
    fontSize: 13,
  },
  positionsChip: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.35)",
  },
  positionsChipText: {
    ...typography.body,
    color: colors.accentLight,
    fontSize: 13,
    fontWeight: "600",
  },
  featuredSection: {
    marginBottom: spacing.lg,
  },
  inlineSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  inlineSectionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  inlineSectionSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  inlineSectionLink: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  featuredScroll: {
    paddingRight: spacing.md,
  },
  featuredCard: {
    width: 236,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    ...shadows.subtle,
  },
  featuredVenue: {
    ...typography.caption,
    color: "rgba(255,255,255,0.88)",
  },
  featuredAddress: {
    ...typography.caption,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    fontSize: 11,
  },
  featuredEvent: {
    ...typography.title,
    color: colors.text,
    marginTop: 4,
    fontSize: 18,
  },
  featuredMeta: {
    ...typography.caption,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  featuredPay: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.sm,
    fontWeight: "800",
  },
  featuredClaimBtn: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingVertical: 10,
    alignItems: "center",
  },
  featuredClaimText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  claimButtonWrap: {
    overflow: "hidden",
  },
  claimButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  claimButtonDisabled: {
    opacity: 0.65,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#03120f",
    letterSpacing: 0.2,
  },
  exploreMoreBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    backgroundColor: colors.accentSoft,
    paddingVertical: 14,
    alignItems: "center",
  },
  exploreMoreBtnText: {
    ...typography.body,
    color: colors.accentLight,
    fontWeight: "700",
    fontSize: 15,
  },
  blogCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorderLight,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  blogCardTitle: {
    ...typography.titleCard,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  blogCardExcerpt: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  blogCardLink: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  trainingSection: {
    marginBottom: spacing.md,
  },
  trainingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  viewAllTraining: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
    fontSize: 12,
  },
  trainingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm,
  },
  trainingMiniCard: {
    width: "48%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.22)",
    padding: spacing.sm,
    minHeight: 118,
  },
  trainingMiniBadge: {
    fontSize: 22,
    marginBottom: 4,
  },
  trainingMiniTitle: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
    lineHeight: 18,
    minHeight: 36,
  },
  trainingMiniMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 11,
  },
  trainingMiniTrack: {
    marginTop: spacing.sm,
    height: 4,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  trainingMiniFill: {
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.warning,
  },
  trainingMiniTrackPlaceholder: {
    marginTop: spacing.sm,
    height: 4,
  },
  viewAllBtnOuter: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.45)",
    ...shadows.glowSm,
  },
  viewAllBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  viewAllBtnTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  viewAllBtnSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  viewAllBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: 8,
  },
  viewAllBtnCta: {
    ...typography.body,
    color: colors.accentLight,
    fontWeight: "800",
    fontSize: 16,
  },
  viewAllBtnArrow: {
    fontSize: 18,
    color: colors.accentLight,
    fontWeight: "700",
  },
});
