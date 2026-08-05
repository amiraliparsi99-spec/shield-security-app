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
import { getProfileIdAndRole, getPersonnelId, isPersonnelVerified, isPersonnelBankConnected } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { getApiBaseUrl } from "../lib/api";
import { getClaimAvailabilityWarning } from "../lib/shiftAvailabilityClaimCheck";
import { claimShiftWithLocation } from "../lib/shiftClaim";
import { isClaimableOnMarketplace } from "../lib/shiftMarketplace";
import { bookingDisplayName } from "../lib/bookingDisplay";
import { locationSummaryOneLine } from "../lib/bookingLocation";
import { ScheduledShifts } from "../components/ScheduledShifts";
import { GuestGate } from "../components/auth/GuestGate";

interface Shift {
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
  attire_requirement?: string | null;
  brief_notes?: string | null;
}

function extractAttireRequirement(briefNotes?: string | null): string | null {
  if (!briefNotes) return null;
  const match = briefNotes.match(/Attire requirement:\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

export default function JobsScreen() {
  return (
    <GuestGate feature="jobs" redirectAfter="/jobs">
      <JobsScreenContent />
    </GuestGate>
  );
}

function JobsScreenContent() {
  const insets = useSafeAreaInsets();
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [personnel, setPersonnel] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [tab, setTab] = useState<"available" | "my-shifts">("available");
  const [scheduledCount, setScheduledCount] = useState(0);

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
        const v = await isPersonnelVerified(supabase, personnelId);
        setIsVerified(v);
        if (v) {
          const b = await isPersonnelBankConnected(supabase, personnelId);
          setHasBankAccount(b);
        }
      }

      // Unassigned pending shifts — filtered to claimable marketplace slots only.
      const { data: available, error: availableError } = await supabase
        .from("shifts")
        .select(
          "id, booking_id, role, hourly_rate, scheduled_start, scheduled_end, created_at, status, personnel_id, is_urgent, dispatcher_status, cover_search_wave",
        )
        .is("personnel_id", null)
        .eq("status", "pending")
        .gte("scheduled_end", new Date().toISOString());
      
      console.log("📦 Jobs: Available shifts:", available?.length, "Error:", availableError?.message);

      // Fetch my CONFIRMED shifts (open-board claims). Agency-rostered shifts
      // are surfaced separately by the ScheduledShifts section above, so we
      // exclude any shift that has an active assignment to avoid showing it twice.
      const { data: assignedRows } = await supabase
        .from("shift_assignments")
        .select("shift_id")
        .eq("personnel_id", personnelId)
        .in("status", ["pending", "accepted"]);
      const assignedShiftIds = new Set(
        (assignedRows || []).map((r: any) => r.shift_id).filter(Boolean),
      );

      const { data: mineRaw, error: mineError } = await supabase
        .from("shifts")
        .select("id, booking_id, role, hourly_rate, scheduled_start, scheduled_end, created_at")
        .eq("personnel_id", personnelId)
        .gte("scheduled_end", new Date().toISOString())
        .in("status", ["accepted", "checked_in"]);

      const mine = (mineRaw || []).filter((s: any) => !assignedShiftIds.has(s.id));

      console.log("📦 Jobs: My shifts:", mine?.length, "Error:", mineError?.message);

      // Get booking details
      const allShifts = [...(available || []), ...(mine || [])];
      const bookingIds = [...new Set(allShifts.map((s) => s.booking_id).filter(Boolean))];

      let bookingsMap: Record<string, any> = {};
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, event_name, venue_id, site_label, site_address_text, site_latitude, site_longitude, brief_notes, status")
          .in("id", bookingIds);

        if (bookings && bookings.length > 0) {
          const venueIds = [...new Set(bookings.map((b) => b.venue_id).filter(Boolean))];
          
          let venuesMap: Record<string, any> = {};
          if (venueIds.length > 0) {
            const { data: venues } = await supabase
              .from("venues")
              .select("id, name, city, address_line1, postcode")
              .in("id", venueIds);

            if (venues) {
              venues.forEach((v) => {
                venuesMap[v.id] = v;
              });
            }
          }

          bookings.forEach((b) => {
            const venue = venuesMap[b.venue_id] || {
              name: "Venue",
              city: "",
              address_line1: null,
              postcode: null,
            };
            const bookingSource = {
              event_name: b.event_name,
              site_label: (b as { site_label?: string }).site_label,
              site_address_text: (b as { site_address_text?: string }).site_address_text,
              site_latitude: (b as { site_latitude?: number }).site_latitude,
              site_longitude: (b as { site_longitude?: number }).site_longitude,
              venue,
            };
            bookingsMap[b.id] = {
              ...bookingSource,
              venue_name: bookingDisplayName(bookingSource),
              address_line: locationSummaryOneLine(bookingSource),
              attire_requirement: extractAttireRequirement(b.brief_notes),
              brief_notes: b.brief_notes || null,
              status: b.status ?? null,
            };
          });
        }

        // Fallback: fetch metadata via API for bookings RLS blocked
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
                    venue_name: bookingDisplayName(bookingSource),
                    address_line: locationSummaryOneLine(bookingSource),
                    attire_requirement: extractAttireRequirement(meta.brief_notes),
                    brief_notes: meta.brief_notes || null,
                  };
                }
              }
            }
          } catch {
            // API unreachable — names will fall back to defaults
          }
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
          created_at: s.created_at,
          venue_name: booking.venue_name || bookingDisplayName(booking) || "Venue",
          venue_city: booking.venue?.city || "",
          event_name: booking.event_name || "Event",
          address_line: booking.address_line ?? locationSummaryOneLine(booking),
          attire_requirement: booking.attire_requirement || null,
          brief_notes: booking.brief_notes || null,
        };
      };

      // Hide agency self-managed roster shifts from the open board — they're
      // assigned directly by the agency. Tolerant of the 0068 column absence.
      let selfManagedBookings = new Set<string>();
      if (bookingIds.length > 0) {
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
      }

      const nowMs = Date.now();
      const sortedAvailable = (available || [])
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
        .map(formatShift)
        .sort((a, b) => {
          if (b.hourly_rate !== a.hourly_rate) return b.hourly_rate - a.hourly_rate;
          const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
          const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
          if (bCreated !== aCreated) return bCreated - aCreated;
          return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
        });
      setAvailableShifts(sortedAvailable);
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

    const verified = await isPersonnelVerified(supabase, personnel.id);
    if (!verified) {
      Alert.alert(
        "Verification Required",
        "You need to complete your ID and SIA licence verification before you can accept jobs.",
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

    const hours = getHours(shift.scheduled_start, shift.scheduled_end);
    const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);

    const showClaimConfirmation = () => {
      Alert.alert(
        "Claim This Shift?",
        `📍 ${shift.venue_name}\n📅 ${formatDate(shift.scheduled_start)}\n🕐 ${formatTime(shift.scheduled_start)} - ${formatTime(shift.scheduled_end)}\n💰 £${pay}${shift.attire_requirement ? `\n👔 Attire: ${shift.attire_requirement}` : ""}\n\nYou're committing to this shift.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Claim It!",
            style: "default",
            onPress: async () => {
              safeHaptic("medium");
              setClaiming(shift.id);

              if (!supabase) return;
              try {
                await claimShiftWithLocation(shift.id, personnel.id);

                safeHaptic("success");

                if (!supabase) return;
                const { data: booking } = await supabase
                  .from("bookings")
                  .select("venue_id, agency_id")
                  .eq("id", shift.booking_id)
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
                    body: `${personnel.display_name} accepted the ${shift.role} shift for ${shift.event_name}`,
                    data: { booking_id: shift.booking_id },
                  });
                }

                if (!supabase) return;
                try {
                  await supabase.rpc("create_mission_control_chat", { p_booking_id: shift.booking_id });
                  console.log("Mission Control chat created for booking:", shift.booking_id);
                } catch (chatErr) {
                  console.log("Mission Control chat (non-critical):", chatErr);
                }

                setAvailableShifts((prev) => prev.filter((s) => s.id !== shift.id));
                setMyShifts((prev) => [...prev, shift]);

                Alert.alert("✅ Shift Claimed!", "You're confirmed for this job. Mission Control is now active!");
                setTab("my-shifts");
              } catch (e: any) {
                safeHaptic("error");
                const msg = String(e?.message || "");
                if (msg.toLowerCase().includes("already been claimed")) {
                  safeHaptic("error");
                  Alert.alert("Too Slow!", "This shift was just claimed by another guard.");
                  setAvailableShifts((prev) => prev.filter((s) => s.id !== shift.id));
                  setClaiming(null);
                  return;
                }
                console.error("Claim error:", e);
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
        shift.scheduled_start,
        shift.scheduled_end
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

      {/* Verification Banner */}
      {personnel && !isVerified && (
        <TouchableOpacity
          style={styles.verificationBanner}
          onPress={() => router.push("/verification")}
          activeOpacity={0.8}
        >
          <Text style={styles.verificationIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.verificationTitle}>Verification Required</Text>
            <Text style={styles.verificationText}>
              Complete your verification to start accepting jobs. Tap here to verify.
            </Text>
          </View>
          <Text style={{ color: "#F59E0B", fontSize: 16 }}>→</Text>
        </TouchableOpacity>
      )}

      {/* Bank Account Banner */}
      {personnel && isVerified && !hasBankAccount && (
        <TouchableOpacity
          style={[styles.verificationBanner, { borderColor: colors.accent }]}
          onPress={() => router.push("/(tabs)/payments")}
          activeOpacity={0.8}
        >
          <Text style={styles.verificationIcon}>🏦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.verificationTitle}>Connect Bank Account</Text>
            <Text style={styles.verificationText}>
              You're verified! Connect your bank account to start getting paid for shifts.
            </Text>
          </View>
          <Text style={{ color: colors.accent, fontSize: 16 }}>→</Text>
        </TouchableOpacity>
      )}

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
            My Shifts ({myShifts.length + scheduledCount})
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
                    <TouchableOpacity
                      style={styles.shiftContent}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/job/${shift.id}`)}
                    >
                      <View style={styles.shiftHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shiftTitle}>{shift.event_name}</Text>
                          <Text style={styles.shiftVenue}>
                            {shift.venue_name} • {shift.venue_city}
                          </Text>
                          {shift.address_line ? (
                            <Text style={styles.shiftAddress} numberOfLines={2}>
                              📍 {shift.address_line}
                            </Text>
                          ) : null}
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
                        {shift.attire_requirement ? (
                          <View style={styles.attireChip}>
                            <Text style={styles.attireChipText}>👔 {shift.attire_requirement}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>

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
            {/* Agency-scheduled shifts awaiting accept/decline */}
            <ScheduledShifts hideWhenEmpty onCountChange={setScheduledCount} />

            {myShifts.length === 0 ? (
              scheduledCount === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🗓️</Text>
                  <Text style={styles.emptyTitle}>No upcoming shifts</Text>
                  <Text style={styles.emptySubtitle}>Claim a shift from the Available tab</Text>
                </View>
              ) : null
            ) : (
              myShifts.map((shift) => {
                const hours = getHours(shift.scheduled_start, shift.scheduled_end);
                const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);

                return (
                  <TouchableOpacity
                    key={shift.id}
                    style={styles.myShiftCard}
                    activeOpacity={0.9}
                    onPress={() => router.push(`/job/${shift.id}`)}
                  >
                    <View style={styles.confirmedBadge}>
                      <Text style={styles.confirmedBadgeText}>CONFIRMED</Text>
                    </View>

                    <View style={styles.shiftHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shiftTitle}>{shift.event_name}</Text>
                        <Text style={styles.shiftVenue}>
                          {shift.venue_name} • {shift.venue_city}
                        </Text>
                        {shift.address_line ? (
                          <Text style={styles.shiftAddress} numberOfLines={2}>
                            📍 {shift.address_line}
                          </Text>
                        ) : null}
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
                      {shift.attire_requirement ? (
                        <View style={styles.myShiftChip}>
                          <Text style={styles.myShiftChipText}>👔 {shift.attire_requirement}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
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
  verificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  verificationIcon: {
    fontSize: 24,
  },
  verificationTitle: {
    ...typography.body,
    color: "#F59E0B",
    fontWeight: "700",
    fontSize: 14,
  },
  verificationText: {
    ...typography.caption,
    color: "rgba(245, 158, 11, 0.8)",
    marginTop: 2,
    fontSize: 12,
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
  shiftAddress: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 16,
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
  attireChip: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.35)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  attireChipText: {
    ...typography.body,
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "600",
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
