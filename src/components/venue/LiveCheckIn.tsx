"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useSupabase } from "@/hooks/useSupabase";
import { useVenueProfile } from "@/hooks";
import Link from "next/link";
import { distanceMeters } from "@/lib/geo/distance";
import { CoverActivityTimeline } from "@/components/venue/CoverActivityTimeline";

const StaffTrackingMap = dynamic(
  () => import("@/components/maps/StaffTrackingMap").then((m) => m.StaffTrackingMap),
  { ssr: false },
);

type ShiftStatus = "pending" | "accepted" | "declined" | "checked_in" | "checked_out" | "no_show" | "cancelled";

type TravelRing = "none" | "R3" | "R4" | "R5" | "R6";

type TravelRiskRow = {
  shift_id: string;
  travel_risk: TravelRing | null;
  attendance_confirmed_at: string | null;
  travel_risk_evaluated_at: string | null;
  cover_search_wave: number | null;
  cover_search_started_at: string | null;
  cover_search_last_wave_at: string | null;
  cover_unfilled_at: string | null;
};

type GpsPoint = {
  shift_id: string;
  personnel_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
};

type LiveShift = {
  id: string;
  personnel_id: string | null;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: ShiftStatus;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  booking_id: string;
  venue_confirmed?: boolean;
  venue_confirmed_at?: string | null;
  dispute_status?: string | null;
  hours_worked?: number | null;
  total_pay?: number | null;
  personnel?: {
    id: string;
    user_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profiles: {
      avatar_url: string | null;
    } | null;
  } | null;
};

type LiveBooking = {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  shifts: LiveShift[];
};

/**
 * Per-ring banner copy for the venue. Wording mirrors
 * docs/PRE_SHIFT_ABSENCE_ESCALATION.md §6 — venue-facing language is the
 * product here, deliberately no "source cover" CTA on R5/R6.
 */
/** Wave radius lookup so the banner copy is consistent with the cron. */
const COVER_WAVE_RADIUS_MILES: Record<number, number> = { 1: 5, 2: 15, 3: 25 };

function coverSearchBannerCopy(row: {
  cover_search_wave: number | null;
  cover_search_started_at: string | null;
  cover_search_last_wave_at: string | null;
  cover_unfilled_at: string | null;
}): { icon: string; title: string; body: string; className: string } | null {
  if (row.cover_unfilled_at) {
    return {
      icon: "⚠️",
      title: "Cover not yet found",
      body:
        "All search waves have completed without a confirmed replacement. We're escalating to agency partners — you may also want to call us directly.",
      className: "border-red-700/50 bg-red-800/15 text-red-100",
    };
  }
  const wave = row.cover_search_wave ?? 0;
  if (wave <= 0) return null;
  const radius = COVER_WAVE_RADIUS_MILES[wave] ?? 5;
  const started = row.cover_search_started_at
    ? new Date(row.cover_search_started_at)
    : null;
  const minutesAgo = started
    ? Math.max(0, Math.floor((Date.now() - started.getTime()) / 60_000))
    : 0;
  const elapsedText = minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`;
  return {
    icon: wave === 1 ? "🟡" : wave === 2 ? "🟠" : "🔴",
    title: `Sourcing cover — Wave ${wave} of 3 (${radius} mi)`,
    body:
      wave === 3
        ? `Final search wave broadcasting to all guards within ${radius} miles. Started ${elapsedText}. We'll alert you the moment cover is confirmed.`
        : `Notifying guards within ${radius} miles. Started ${elapsedText}. If no taker, we auto-broaden to the next wave.`,
    className:
      wave === 1
        ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
        : wave === 2
          ? "border-orange-400/50 bg-orange-400/15 text-orange-100"
          : "border-red-500/50 bg-red-500/15 text-red-100",
  };
}

function travelRiskBannerCopy(
  ring: TravelRing,
  guardName: string,
): { icon: string; title: string; body: string; className: string } | null {
  switch (ring) {
    case "R3":
      return {
        icon: "🟡",
        title: "En-route status unclear",
        body: `${guardName}'s location hasn't updated recently. We've nudged them — you'll see another update if anything changes.`,
        className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      };
    case "R4":
      return {
        icon: "🟠",
        title: "Late-risk flagged",
        body: "We're watching this closely. Standby cover is ready to deploy if needed.",
        className: "border-orange-400/40 bg-orange-400/10 text-orange-200",
      };
    case "R5":
      return {
        icon: "🔴",
        title: "Sourcing cover now",
        body: `${guardName} hasn't arrived. We're contacting standby guards. You'll be notified when cover is confirmed.`,
        className: "border-red-500/40 bg-red-500/10 text-red-200",
      };
    case "R6":
      return {
        icon: "❌",
        title: "Marked no-show",
        body: `${guardName} didn't check in. Cover is being sourced on priority.`,
        className: "border-red-600/50 bg-red-600/15 text-red-200",
      };
    default:
      return null;
  }
}

export function LiveCheckIn() {
  const supabase = useSupabase();
  const { data: venue } = useVenueProfile();
  
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedMapStaff, setSelectedMapStaff] = useState<string | null>(null);
  const [gpsPoints, setGpsPoints] = useState<Map<string, GpsPoint>>(new Map());
  const [gpsTrails, setGpsTrails] = useState<Map<string, GpsPoint[]>>(new Map());
  /**
   * Pre-shift travel risk per shift, populated by a tolerant query so a
   * missing migration during rollout doesn't break the rest of the page.
   * See docs/PRE_SHIFT_ABSENCE_ESCALATION.md.
   */
  const [travelRisk, setTravelRisk] = useState<Map<string, TravelRiskRow>>(new Map());
  const [venueCoords, setVenueCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedEvidenceShiftId, setSelectedEvidenceShiftId] = useState<string | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayDateRef = useRef<HTMLButtonElement | null>(null);

  const selectedBooking = bookings.find(b => b.id === selectedBookingId) || bookings[0] || null;

  useEffect(() => {
    todayDateRef.current?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, []);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fetchBookings = useCallback(async () => {
    if (!venue?.id) return;

    const today = new Date();
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        event_name,
        event_date,
        start_time,
        end_time,
        status,
        shifts (
          id,
          personnel_id,
          role,
          hourly_rate,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          status,
          check_in_latitude,
          check_in_longitude,
          booking_id,
          venue_confirmed,
          venue_confirmed_at,
          dispute_status,
          hours_worked,
          total_pay,
          personnel:personnel_id (
            id,
            user_id,
            display_name,
            first_name,
            last_name,
            profiles:user_id (
              avatar_url
            )
          )
        )
      `)
      .eq('venue_id', venue.id)
      .gte('event_date', toDateStr(rangeStart))
      .lte('event_date', toDateStr(rangeEnd))
      .in('status', ['confirmed', 'in_progress', 'pending'])
      .order('event_date', { ascending: true });

    if (!error && data) {
      setBookings(data as unknown as LiveBooking[]);
    }
    setLoading(false);
  }, [supabase, venue?.id]);

  // Initial fetch
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Real-time subscription for shift updates
  useEffect(() => {
    if (!venue?.id) return;

    const channel = supabase
      .channel('live-checkin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
        },
        (payload) => {
          console.log('Shift update received:', payload);
          // Refetch to get updated data with joins
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, venue?.id, fetchBookings]);

  // Resolve venue coordinates from the selected booking's venue
  useEffect(() => {
    if (!selectedBooking || !venue?.id) return;
    (async () => {
      const { data } = await supabase
        .from("venues")
        .select("latitude, longitude")
        .eq("id", venue.id)
        .single() as { data: { latitude: number | null; longitude: number | null } | null };
      if (data?.latitude && data?.longitude) {
        setVenueCoords({ lat: data.latitude, lng: data.longitude });
      }
    })();
  }, [supabase, venue?.id, selectedBooking?.id]);

  // Fetch latest GPS point per active shift
  const fetchGpsPoints = useCallback(async () => {
    if (!selectedBooking) return;
    const activeShiftIds = selectedBooking.shifts
      .filter((s) => s.personnel_id && (s.status === "checked_in" || s.status === "accepted"))
      .map((s) => s.id);
    if (activeShiftIds.length === 0) {
      setGpsPoints(new Map());
      return;
    }
    const { data, error } = await supabase
      .from("shift_gps_log" as any)
      .select("shift_id, personnel_id, lat, lng, accuracy, speed, heading, recorded_at")
      .in("shift_id", activeShiftIds)
      .order("recorded_at", { ascending: false })
      .limit(activeShiftIds.length * 3) as { data: GpsPoint[] | null; error: any };
    if (error) {
      console.log("[LiveCheckIn] GPS log query error (table may not exist yet):", error.message);
      return;
    }
    const latest = new Map<string, GpsPoint>();
    for (const row of data ?? []) {
      if (!latest.has(row.shift_id)) {
        latest.set(row.shift_id, row);
      }
    }
    setGpsPoints(latest);
  }, [supabase, selectedBooking]);

  // Poll GPS every 10 seconds
  useEffect(() => {
    fetchGpsPoints();
    gpsIntervalRef.current = setInterval(fetchGpsPoints, 10_000);
    return () => {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, [fetchGpsPoints]);

  // Realtime subscription for new GPS points
  useEffect(() => {
    if (!selectedBooking) return;
    const channel = supabase
      .channel("live-gps")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shift_gps_log" },
        () => fetchGpsPoints(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selectedBooking, fetchGpsPoints]);

  const fetchGpsTrails = useCallback(async () => {
    if (!selectedBooking) {
      setGpsTrails(new Map());
      return;
    }
    const shiftIds = selectedBooking.shifts.map((s) => s.id).filter(Boolean);
    if (shiftIds.length === 0) {
      setGpsTrails(new Map());
      return;
    }
    const { data, error } = await supabase
      .from("shift_gps_log" as any)
      .select("shift_id, personnel_id, lat, lng, accuracy, speed, heading, recorded_at")
      .in("shift_id", shiftIds)
      .order("recorded_at", { ascending: true })
      .limit(3000) as { data: GpsPoint[] | null; error: any };
    if (error || !data) return;

    const grouped = new Map<string, GpsPoint[]>();
    for (const row of data) {
      const arr = grouped.get(row.shift_id) ?? [];
      arr.push(row);
      grouped.set(row.shift_id, arr);
    }
    setGpsTrails(grouped);
  }, [selectedBooking, supabase]);

  useEffect(() => {
    fetchGpsTrails();
  }, [fetchGpsTrails]);

  /**
   * Pull the latest travel_risk values for the booking's shifts. Tolerant of
   * the column not existing yet (during migration 0054 rollout) — failure
   * just leaves the map empty and the banner hidden.
   */
  const fetchTravelRisk = useCallback(async () => {
    if (!selectedBooking) {
      setTravelRisk(new Map());
      return;
    }
    const shiftIds = selectedBooking.shifts.map((s) => s.id);
    if (shiftIds.length === 0) {
      setTravelRisk(new Map());
      return;
    }
    // Try to read both travel_risk + cover_search_* columns; fall back gracefully
    // if either set isn't yet present on the running schema.
    const richSelect =
      "id, travel_risk, attendance_confirmed_at, travel_risk_evaluated_at, cover_search_wave, cover_search_started_at, cover_search_last_wave_at, cover_unfilled_at";
    const fallbackSelect =
      "id, travel_risk, attendance_confirmed_at, travel_risk_evaluated_at";

    let rows: Array<{
      id: string;
      travel_risk: TravelRing | null;
      attendance_confirmed_at: string | null;
      travel_risk_evaluated_at: string | null;
      cover_search_wave?: number | null;
      cover_search_started_at?: string | null;
      cover_search_last_wave_at?: string | null;
      cover_unfilled_at?: string | null;
    }> = [];

    const rich = await supabase.from("shifts").select(richSelect).in("id", shiftIds);
    if (rich.error) {
      const fb = await supabase.from("shifts").select(fallbackSelect).in("id", shiftIds);
      if (fb.error) return;
      rows = (fb.data as typeof rows) ?? [];
    } else {
      rows = (rich.data as typeof rows) ?? [];
    }

    const next = new Map<string, TravelRiskRow>();
    for (const row of rows) {
      next.set(row.id, {
        shift_id: row.id,
        travel_risk: row.travel_risk,
        attendance_confirmed_at: row.attendance_confirmed_at,
        travel_risk_evaluated_at: row.travel_risk_evaluated_at,
        cover_search_wave: row.cover_search_wave ?? null,
        cover_search_started_at: row.cover_search_started_at ?? null,
        cover_search_last_wave_at: row.cover_search_last_wave_at ?? null,
        cover_unfilled_at: row.cover_unfilled_at ?? null,
      });
    }
    setTravelRisk(next);
  }, [supabase, selectedBooking]);

  useEffect(() => {
    fetchTravelRisk();
    const t = setInterval(fetchTravelRisk, 30_000);
    return () => clearInterval(t);
  }, [fetchTravelRisk]);

  const getDistanceFromVenue = (shiftId: string): string | null => {
    if (!venueCoords) return null;
    const gps = gpsPoints.get(shiftId);
    if (!gps) return null;
    const d = distanceMeters(gps.lat, gps.lng, venueCoords.lat, venueCoords.lng);
    if (d < 1000) return `${Math.round(d)}m from venue`;
    return `${(d / 1000).toFixed(1)}km from venue`;
  };

  const getLastSeenAgo = (shiftId: string): string | null => {
    const gps = gpsPoints.get(shiftId);
    if (!gps) return null;
    const diff = Date.now() - new Date(gps.recorded_at).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  // Build StaffTrackingMap props
  const staffMapLocations = selectedBooking
    ? selectedBooking.shifts
        .filter((s) => s.personnel_id && s.status !== "declined" && s.status !== "cancelled")
        .map((s) => {
          const gps = gpsPoints.get(s.id);
          const staffName =
            s.personnel?.display_name ||
            (s.personnel?.first_name
              ? `${s.personnel.first_name} ${s.personnel.last_name || ""}`.trim()
              : "Unknown");
          const lat = gps?.lat ?? s.check_in_latitude ?? null;
          const lng = gps?.lng ?? s.check_in_longitude ?? null;
          if (!lat || !lng) return null;
          const isOnShift = s.status === "checked_in";
          const isEnRoute = s.status === "accepted" && !!gps;
          return {
            id: s.id,
            name: staffName,
            lat,
            lng,
            accuracy: gps?.accuracy ?? undefined,
            isOnShift,
            isEnRoute,
            distanceFromVenue: getDistanceFromVenue(s.id),
            venueName: venue?.name ?? undefined,
            lastUpdated: gps?.recorded_at ?? s.actual_start ?? s.scheduled_start,
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        lat: number;
        lng: number;
        accuracy?: number;
        isOnShift: boolean;
        isEnRoute?: boolean;
        distanceFromVenue?: string | null;
        venueName?: string;
        lastUpdated: string;
      }>
    : [];

  const venueGeofences =
    venueCoords && venue
      ? [{ id: venue.id, name: venue.name ?? "Venue", lat: venueCoords.lat, lng: venueCoords.lng, radius: 200 }]
      : [];

  const getShiftEvidence = (shift: LiveShift) => {
    const trail = gpsTrails.get(shift.id) ?? [];
    const totalPoints = trail.length;
    if (!shift.actual_start || !shift.actual_end || !venueCoords) {
      return {
        totalPoints,
        onSitePoints: 0,
        coveragePct: 0,
        onSiteMinutes: 0,
        durationMinutes: 0,
        trail,
      };
    }
    const startMs = new Date(shift.actual_start).getTime();
    const endMs = new Date(shift.actual_end).getTime();
    const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
    const onSitePoints = trail.filter((p) => {
      const d = distanceMeters(p.lat, p.lng, venueCoords.lat, venueCoords.lng);
      return d <= 200;
    }).length;
    const coveragePct = totalPoints > 0 ? Math.round((onSitePoints / totalPoints) * 100) : 0;
    const onSiteMinutes = durationMinutes > 0 ? Math.round((coveragePct / 100) * durationMinutes) : 0;

    return {
      totalPoints,
      onSitePoints,
      coveragePct,
      onSiteMinutes,
      durationMinutes,
      trail,
    };
  };

  // Calculate stats for selected booking
  const getStats = (booking: LiveBooking | null) => {
    if (!booking) return { checkedIn: 0, late: 0, noShow: 0, pending: 0, total: 0 };
    
    const shifts = booking.shifts || [];
    const now = new Date();
    
    return {
      checkedIn: shifts.filter(s => s.status === 'checked_in').length,
      late: shifts.filter(s => {
        if (s.status !== 'accepted') return false;
        const scheduledStart = new Date(s.scheduled_start);
        return now > scheduledStart && (now.getTime() - scheduledStart.getTime()) > 15 * 60 * 1000; // 15 min grace
      }).length,
      noShow: shifts.filter(s => s.status === 'no_show').length,
      pending: shifts.filter(s => s.status === 'accepted' && new Date(s.scheduled_start) > now).length,
      total: shifts.filter(s => s.personnel_id && s.status !== 'declined' && s.status !== 'cancelled').length,
    };
  };

  const stats = getStats(selectedBooking);

  useEffect(() => {
    if (!selectedBooking) {
      setSelectedEvidenceShiftId(null);
      return;
    }
    setSelectedEvidenceShiftId((prev) =>
      prev && selectedBooking.shifts.some((s) => s.id === prev) ? prev : null,
    );
  }, [selectedBooking]);

  // Get display status for a shift
  const getShiftDisplayStatus = (shift: LiveShift): "checked_in" | "checked_out" | "late" | "no_show" | "pending" => {
    if (shift.status === 'checked_in') return 'checked_in';
    if (shift.status === 'checked_out') return 'checked_out';
    if (shift.status === 'no_show') return 'no_show';
    
    if (shift.status === 'accepted') {
      const now = new Date();
      const scheduledStart = new Date(shift.scheduled_start);
      // If more than 15 minutes past scheduled start, mark as late
      if (now > scheduledStart && (now.getTime() - scheduledStart.getTime()) > 15 * 60 * 1000) {
        return 'late';
      }
      return 'pending';
    }
    
    return 'pending';
  };

  const getStatusBadge = (status: ReturnType<typeof getShiftDisplayStatus>) => {
    switch (status) {
      case "checked_in":
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">✓ On Site</span>;
      case "checked_out":
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Checked Out</span>;
      case "late":
        return <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">⏰ Late</span>;
      case "no_show":
        return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">❌ No Show</span>;
      case "pending":
        return <span className="text-xs bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded-full">Pending</span>;
    }
  };

  const getStatusIcon = (status: ReturnType<typeof getShiftDisplayStatus>) => {
    switch (status) {
      case "checked_in": return "🟢";
      case "checked_out": return "🔵";
      case "late": return "🟡";
      case "no_show": return "🔴";
      case "pending": return "⚪";
    }
  };

  // Manual check-in by venue
  const handleManualCheckIn = async (shiftId: string) => {
    setActionLoading(shiftId);
    
    const { error } = await (supabase as any)
      .from('shifts')
      .update({
        status: 'checked_in',
        actual_start: new Date().toISOString(),
      })
      .eq('id', shiftId);

    if (error) {
      console.error('Manual check-in error:', error);
      alert('Failed to check in. Please try again.');
    }
    
    setActionLoading(null);
  };

  // Mark as no-show
  const handleMarkNoShow = async (shiftId: string) => {
    if (!confirm('Are you sure you want to mark this staff as a no-show? This will affect their Shield HQ Score.')) {
      return;
    }
    
    setActionLoading(shiftId);

    try {
      const res = await fetch("/api/shifts/no-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: shiftId,
          notes: "Marked as no-show by venue via Live Check-In",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to mark no-show. Please try again.");
      } else {
        fetchBookings();
      }
    } catch (err) {
      console.error("No-show error:", err);
      alert("Failed to mark no-show. Please try again.");
    }

    setActionLoading(null);
  };

  // Contact staff (open messages)
  const handleContactStaff = (personnelUserId: string) => {
    window.location.href = `/d/venue/mission-control`;
  };

  // Find replacement
  const handleFindReplacement = (bookingId: string) => {
    // Navigate to find replacement flow
    window.location.href = `/d/venue/bookings/${bookingId}?action=find-replacement`;
  };

  // Cancel shift by venue
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelShift, setCancelShift] = useState<LiveShift | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const handleOpenCancel = (shift: LiveShift) => {
    setCancelShift(shift);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleSubmitCancel = async () => {
    if (!cancelShift || cancelReason.trim().length < 5) {
      alert('Please provide a reason (at least 5 characters)');
      return;
    }
    
    setActionLoading(cancelShift.id);
    
    try {
      const res = await fetch('/api/shifts/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shift_id: cancelShift.id,
          reason: cancelReason.trim(),
          cancelled_by: 'venue',
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Failed to cancel shift');
      } else {
        const message = data.cancellation_note 
          ? `Shift cancelled. ${data.cancellation_note}`
          : 'Shift cancelled successfully.';
        alert(message);
        setShowCancelModal(false);
        setCancelShift(null);
        fetchBookings();
      }
    } catch (err) {
      console.error('Cancel shift error:', err);
      alert('Failed to cancel shift. Please try again.');
    }
    
    setActionLoading(null);
  };

  // Confirm shift and release payment
  const handleConfirmShift = async (shift: LiveShift) => {
    const staffName = shift.personnel?.display_name || (shift.personnel?.first_name ? `${shift.personnel.first_name} ${shift.personnel.last_name || ''}`.trim() : null) || "this guard";
    const hours = shift.actual_start && shift.actual_end
      ? Math.round((new Date(shift.actual_end).getTime() - new Date(shift.actual_start).getTime()) / 3600000 * 10) / 10
      : null;
    const pay = hours && shift.hourly_rate ? (hours * shift.hourly_rate).toFixed(2) : null;
    
    const confirmMsg = pay 
      ? `Confirm ${staffName}'s shift?\n\nHours worked: ${hours}h\nPayment: £${pay}\n\nThis will release the payment from escrow.`
      : `Confirm ${staffName}'s shift?\n\nThis will release the payment from escrow.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }
    
    setActionLoading(shift.id);
    
    try {
      const res = await fetch('/api/shifts/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shift.id }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Failed to confirm shift');
      } else {
        alert('✅ Shift confirmed! Payment has been released.');
        fetchBookings(); // Refresh data
      }
    } catch (err) {
      console.error('Confirm shift error:', err);
      alert('Failed to confirm shift. Please try again.');
    }
    
    setActionLoading(null);
  };

  // Dispute shift
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeShift, setDisputeShift] = useState<LiveShift | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const handleOpenDispute = (shift: LiveShift) => {
    setDisputeShift(shift);
    setDisputeReason('');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!disputeShift || disputeReason.trim().length < 10) {
      alert('Please provide a detailed reason (at least 10 characters)');
      return;
    }
    
    setActionLoading(disputeShift.id);
    
    try {
      const res = await fetch('/api/shifts/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shift_id: disputeShift.id,
          reason: disputeReason.trim(),
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Failed to raise dispute');
      } else {
        alert('⚠️ Dispute raised. Our team will review within 24-48 hours.');
        setShowDisputeModal(false);
        setDisputeShift(null);
        fetchBookings();
      }
    } catch (err) {
      console.error('Dispute error:', err);
      alert('Failed to raise dispute. Please try again.');
    }
    
    setActionLoading(null);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Live Check-In</h2>
            <p className="text-sm text-zinc-500 mt-1">Real-time attendance tracking</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white tabular-nums">
              {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Active Events</h3>
          <p className="text-zinc-500 mb-6 text-sm max-w-sm mx-auto">You don&apos;t have any confirmed bookings for today. Book security to get started.</p>
          <Link
            href="/d/venue/bookings/new"
            className="inline-flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Book Security
          </Link>
        </div>
      </div>
    );
  }

  const activeShifts = selectedBooking?.shifts.filter(s => s.personnel_id && s.status !== 'declined' && s.status !== 'cancelled') ?? [];
  const unconfirmedCompleted = selectedBooking?.shifts.filter(
    (s) => s.status === "checked_out" && !s.venue_confirmed && (!s.dispute_status || s.dispute_status === "none"),
  ) ?? [];

  // Calendar: build 15-day window centred on today
  const calendarDays = (() => {
    const days: { dateStr: string; dayNum: number; dayName: string; monthShort: string; isToday: boolean; eventCount: number }[] = [];
    const now = new Date();
    const todayStr = toDateStr(now);
    for (let offset = -7; offset <= 7; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      const ds = toDateStr(d);
      const count = bookings.filter((b) => b.event_date === ds).length;
      days.push({
        dateStr: ds,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString("en-GB", { weekday: "short" }),
        monthShort: d.toLocaleDateString("en-GB", { month: "short" }),
        isToday: ds === todayStr,
        eventCount: count,
      });
    }
    return days;
  })();

  const bookingsForSelectedDate = bookings.filter((b) => b.event_date === selectedDate);

  return (
    <div className="space-y-5">
      {/* ── Header Row ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Live Check-In</h2>
          <p className="text-sm text-zinc-500 mt-1">Real-time attendance tracking</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-white tabular-nums leading-none">
            {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-zinc-500 mt-1.5">
            {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          </p>
        </div>
      </div>

      {/* ── Calendar Date Strip ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
          <h3 className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Schedule</h3>
          <button
            onClick={() => {
              const t = new Date();
              setSelectedDate(toDateStr(t));
              todayDateRef.current?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
            }}
            className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition"
          >
            Today
          </button>
        </div>
        <div className="flex overflow-x-auto gap-1 px-3 py-3 scrollbar-none">
          {calendarDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            return (
              <button
                key={day.dateStr}
                ref={day.isToday ? todayDateRef : undefined}
                onClick={() => {
                  setSelectedDate(day.dateStr);
                  setSelectedBookingId(null);
                }}
                className={`flex flex-col items-center shrink-0 w-14 py-2.5 rounded-xl transition-all ${
                  isSelected
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                    : day.isToday
                    ? "bg-white/[0.06] text-white"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                <span className={`text-[10px] font-medium uppercase ${isSelected ? "text-purple-200" : ""}`}>{day.dayName}</span>
                <span className={`text-lg font-bold tabular-nums mt-0.5 ${isSelected ? "text-white" : day.isToday ? "text-white" : ""}`}>{day.dayNum}</span>
                {day.eventCount > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: Math.min(day.eventCount, 3) }).map((_, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : "bg-purple-400"}`} />
                    ))}
                    {day.eventCount > 3 && <span className={`text-[8px] font-bold ${isSelected ? "text-white/70" : "text-purple-400"}`}>+</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Events for the selected date */}
        {bookingsForSelectedDate.length > 0 ? (
          <div className="px-3 pb-3 space-y-1.5">
            {bookingsForSelectedDate.map((b) => {
              const isActive = selectedBooking?.id === b.id;
              const staffCount = b.shifts.filter((s) => s.personnel_id && s.status !== "declined" && s.status !== "cancelled").length;
              const checkedIn = b.shifts.filter((s) => s.status === "checked_in").length;
              const now = new Date();
              const eventStart = new Date(b.event_date + "T" + b.start_time);
              const eventEnd = new Date(b.event_date + "T" + b.end_time);
              if (eventEnd <= eventStart) eventEnd.setDate(eventEnd.getDate() + 1);
              const isLive = now >= eventStart && now <= eventEnd;

              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBookingId(b.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-purple-500/15 border border-purple-500/30"
                      : "bg-white/[0.02] border border-transparent hover:bg-white/[0.05] hover:border-white/[0.06]"
                  }`}
                >
                  <div className={`w-1 h-10 rounded-full shrink-0 ${isLive ? "bg-emerald-500" : isActive ? "bg-purple-500" : "bg-white/10"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{b.event_name}</span>
                      {isLive && (
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                          <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{b.start_time} – {b.end_time}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 tabular-nums">{checkedIn}/{staffCount}</p>
                    <p className="text-[10px] text-zinc-600">on site</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-5 pb-4 pt-1">
            <p className="text-sm text-zinc-600 text-center py-4">No events on this date</p>
          </div>
        )}
      </div>

      {selectedBooking && (
        <>
          {/* ── Event Overview ── */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{selectedBooking.event_name}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {selectedBooking.start_time} – {selectedBooking.end_time} · {activeShifts.length} staff assigned
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => fetchBookings()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 transition"
                >
                  Refresh
                </button>
                <Link
                  href={`/d/venue/mission-control?booking=${selectedBooking.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 transition"
                >
                  Mission Control
                </Link>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wide">On Site</p>
                <p className="text-lg font-semibold text-emerald-400 tabular-nums">{stats.checkedIn}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Late</p>
                <p className="text-lg font-semibold text-amber-400 tabular-nums">{stats.late}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wide">No Show</p>
                <p className="text-lg font-semibold text-red-400 tabular-nums">{stats.noShow}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Upcoming</p>
                <p className="text-lg font-semibold text-zinc-200 tabular-nums">{stats.pending}</p>
              </div>
            </div>

            {(stats.late > 0 || stats.noShow > 0) && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3 py-2.5 flex items-center justify-between gap-3">
                <p className="text-xs text-red-300">
                  {stats.late > 0 && `${stats.late} late. `}
                  {stats.noShow > 0 && `${stats.noShow} no-show${stats.noShow > 1 ? "s" : ""}.`}
                </p>
                <button
                  onClick={() => handleFindReplacement(selectedBooking.id)}
                  className="text-xs font-medium bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition"
                >
                  Find replacement
                </button>
              </div>
            )}
          </div>

          {unconfirmedCompleted.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-zinc-200">
                  {unconfirmedCompleted.length} completed shift{unconfirmedCompleted.length > 1 ? "s" : ""} waiting for confirmation.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {unconfirmedCompleted.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedEvidenceShiftId(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        selectedEvidenceShiftId === s.id
                          ? "bg-amber-500 text-black"
                          : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]"
                      }`}
                    >
                      Review {s.personnel?.display_name?.split(" ")[0] || s.role}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Shift Evidence Panel ── */}
          {selectedEvidenceShiftId && (() => {
            const shift = selectedBooking.shifts.find((s) => s.id === selectedEvidenceShiftId);
            if (!shift) return null;
            const evidence = getShiftEvidence(shift);
            const staffName = shift.personnel?.display_name || (shift.personnel?.first_name ? `${shift.personnel.first_name} ${shift.personnel.last_name || ""}`.trim() : "Guard");
            const trailCoords = evidence.trail.map((p) => [p.lng, p.lat] as [number, number]);
            const latest = evidence.trail[evidence.trail.length - 1];
            return (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Shift Evidence — {staffName}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{shift.role} · {shift.actual_start ? formatTime(shift.actual_start) : "--"} – {shift.actual_end ? formatTime(shift.actual_end) : "--"}</p>
                  </div>
                  <button onClick={() => setSelectedEvidenceShiftId(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
                  <div className="px-4 py-3 text-center"><p className="text-xs text-zinc-500">GPS Points</p><p className="text-lg font-bold text-white mt-0.5">{evidence.totalPoints}</p></div>
                  <div className="px-4 py-3 text-center"><p className="text-xs text-zinc-500">On-site</p><p className="text-lg font-bold text-emerald-400 mt-0.5">{evidence.onSitePoints}</p></div>
                  <div className="px-4 py-3 text-center"><p className="text-xs text-zinc-500">Coverage</p><p className="text-lg font-bold text-amber-400 mt-0.5">{evidence.coveragePct}%</p></div>
                  <div className="px-4 py-3 text-center"><p className="text-xs text-zinc-500">On-site Time</p><p className="text-lg font-bold text-white mt-0.5">{evidence.onSiteMinutes}m</p></div>
                </div>
                {latest ? (
                  <StaffTrackingMap className="h-[200px]" staffLocations={[{ id: shift.id, name: staffName, lat: latest.lat, lng: latest.lng, isOnShift: shift.status === "checked_in", isEnRoute: shift.status === "accepted", lastUpdated: latest.recorded_at }]} venueGeofences={venueGeofences} trailPaths={trailCoords.length >= 2 ? [{ id: shift.id, coordinates: trailCoords }] : []} />
                ) : (
                  <div className="h-[100px] flex items-center justify-center text-sm text-zinc-600">No GPS trail for this shift.</div>
                )}
                <div className="px-5 py-3 border-t border-white/[0.06] flex gap-2">
                  <button onClick={() => handleConfirmShift(shift)} disabled={actionLoading === shift.id} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition">
                    {actionLoading === shift.id ? "..." : "Confirm & Release Payment"}
                  </button>
                  <button onClick={() => handleOpenDispute(shift)} disabled={actionLoading === shift.id} className="bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-red-400 text-xs font-medium px-4 py-2.5 rounded-xl transition">Dispute</button>
                </div>
              </div>
            );
          })()}

          {/* ── Main Content: Map + Staff ── */}
          <div className="grid lg:grid-cols-5 gap-5">
            {/* Map Column */}
            <div className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  <h3 className="font-semibold text-white text-sm">Live Map</h3>
                  {staffMapLocations.length > 0 && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-medium">{staffMapLocations.length} tracked</span>
                  )}
                </div>
                <button onClick={() => setShowMap(!showMap)} className="text-[11px] text-zinc-500 hover:text-white transition px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08]">
                  {showMap ? "Hide" : "Show"}
                </button>
              </div>
              <AnimatePresence>
                {showMap && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 320, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    {staffMapLocations.length > 0 ? (
                      <StaffTrackingMap staffLocations={staffMapLocations} venueGeofences={venueGeofences} selectedStaffId={selectedMapStaff} onStaffSelect={setSelectedMapStaff} className="h-[320px]" />
                    ) : (
                      <div className="h-[320px] flex items-center justify-center bg-zinc-900/30">
                        <div className="text-center px-6">
                          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                          <p className="text-zinc-400 font-medium text-sm">No live GPS data yet</p>
                          <p className="text-xs text-zinc-600 mt-1.5 max-w-[260px] mx-auto leading-relaxed">Guard positions appear up to 2 hours before their shift. You&apos;ll see them en route and on site in real time.</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Staff List Column */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Staff ({activeShifts.length})</h3>
                <span className="text-[11px] text-zinc-500">
                  {stats.checkedIn}/{stats.total} on site
                </span>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                {activeShifts.map((shift) => {
                  const displayStatus = getShiftDisplayStatus(shift);
                  const staffName = shift.personnel?.display_name || (shift.personnel?.first_name ? `${shift.personnel.first_name} ${shift.personnel.last_name || ''}`.trim() : null) || 'Unassigned';
                  const staffInitial = staffName.charAt(0).toUpperCase();
                  const dist = getDistanceFromVenue(shift.id);
                  const lastSeen = getLastSeenAgo(shift.id);
                  const hasLiveGps = !!gpsPoints.get(shift.id);
                  const isEnRoute = hasLiveGps && displayStatus === "pending";

                  const borderColor = displayStatus === "checked_in" ? "border-emerald-500/25" : displayStatus === "late" || displayStatus === "no_show" ? "border-red-500/25" : "border-white/[0.06]";

                  return (
                    <motion.div key={shift.id} layout className={`rounded-xl border ${borderColor} bg-white/[0.02] p-4 transition-colors`}>
                      {/* Top row: avatar, name, badge */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                          displayStatus === "checked_in" ? "bg-emerald-500/20 text-emerald-400" : displayStatus === "late" || displayStatus === "no_show" ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-zinc-500"
                        }`}>
                          {staffInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white text-sm truncate">{staffName}</h4>
                            {getStatusBadge(displayStatus)}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-zinc-500">{shift.role}</span>
                            <span className="text-zinc-700">·</span>
                            <span className="text-xs text-zinc-500 tabular-nums">{formatTime(shift.scheduled_start)}</span>
                          </div>
                        </div>
                      </div>

                      {/* GPS row */}
                      {(hasLiveGps || (displayStatus === "checked_in" && shift.check_in_latitude)) && (
                        <div className={`mt-3 flex items-center gap-2 text-xs ${
                          displayStatus === "checked_in" && hasLiveGps ? "text-emerald-400" : isEnRoute ? "text-amber-400" : hasLiveGps ? "text-emerald-400" : "text-zinc-500"
                        }`}>
                          {hasLiveGps && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEnRoute ? "bg-amber-400" : "bg-emerald-400"}`} />
                              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isEnRoute ? "bg-amber-500" : "bg-emerald-500"}`} />
                            </span>
                          )}
                          <span className="font-medium">
                            {isEnRoute ? "En Route" : hasLiveGps && displayStatus === "checked_in" ? "On Site" : hasLiveGps ? "GPS Active" : "GPS at check-in"}
                          </span>
                          {dist && <span className="text-zinc-600 ml-auto">{dist}</span>}
                          {lastSeen && !dist && <span className="text-zinc-600 ml-auto">{lastSeen}</span>}
                        </div>
                      )}

                      {/* Pre-shift travel risk banner — driven by check-pre-shift-eta cron. */}
                      {(() => {
                        const tr = travelRisk.get(shift.id);
                        if (
                          !tr ||
                          shift.status === "checked_in" ||
                          shift.status === "checked_out"
                        ) {
                          return null;
                        }

                        // Cover-search banner takes priority once we're
                        // actively sourcing a replacement.
                        const cover = coverSearchBannerCopy(tr);
                        const banner =
                          cover ??
                          (tr.travel_risk && tr.travel_risk !== "none"
                            ? travelRiskBannerCopy(tr.travel_risk, staffName)
                            : null);
                        if (!banner) return null;
                        return (
                          <div
                            className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${banner.className}`}
                          >
                            <span className="text-base leading-none">{banner.icon}</span>
                            <div className="flex-1">
                              <div className="font-semibold">{banner.title}</div>
                              <div className="opacity-90">{banner.body}</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Cover Activity timeline — only renders when there's
                       * actual ring/wave history for this shift. */}
                      {(() => {
                        const tr = travelRisk.get(shift.id);
                        const hasCoverHistory =
                          (tr?.cover_search_wave ?? 0) > 0 ||
                          (tr?.travel_risk && tr.travel_risk !== "none");
                        if (!hasCoverHistory) return null;
                        return <CoverActivityTimeline shiftId={shift.id} />;
                      })()}

                      {/* Check-in time */}
                      {shift.actual_start && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>
                          Checked in at {formatTime(shift.actual_start)}
                          {shift.actual_end && <> · Out at {formatTime(shift.actual_end)}</>}
                        </div>
                      )}

                      {/* Actions */}
                      {(displayStatus === "late" || displayStatus === "pending") && (
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => handleManualCheckIn(shift.id)} disabled={actionLoading === shift.id} className="flex-1 text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 px-3 py-2 rounded-lg transition font-medium">
                            {actionLoading === shift.id ? "..." : "Manual Check-In"}
                          </button>
                          {shift.personnel?.user_id && (
                            <button onClick={() => handleContactStaff(shift.personnel!.user_id)} className="text-xs bg-white/[0.05] text-zinc-400 hover:text-white px-3 py-2 rounded-lg transition" title="Contact">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </button>
                          )}
                        </div>
                      )}

                      {(shift.status === "pending" || shift.status === "accepted") && !shift.actual_start && (
                        <button onClick={() => handleOpenCancel(shift)} disabled={actionLoading === shift.id} className="mt-2 w-full text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 px-3 py-1.5 rounded-lg transition">Cancel Shift</button>
                      )}

                      {displayStatus === "late" && (
                        <button onClick={() => handleMarkNoShow(shift.id)} disabled={actionLoading === shift.id} className="mt-2 w-full text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 px-3 py-2 rounded-lg transition font-medium">Mark as No-Show</button>
                      )}

                      {shift.status === "checked_out" && !shift.venue_confirmed && !shift.dispute_status && (
                        <div className="mt-3 pt-3 border-t border-white/[0.05]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-amber-400 font-medium">Payment Pending</span>
                            <span className="text-[10px] text-zinc-600">Auto-confirms 48h</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleConfirmShift(shift)} disabled={actionLoading === shift.id} className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 px-3 py-2 rounded-lg transition font-medium">
                              {actionLoading === shift.id ? "..." : "Confirm & Pay"}
                            </button>
                            <button onClick={() => handleOpenDispute(shift)} disabled={actionLoading === shift.id} className="text-xs bg-white/[0.05] text-red-400 hover:bg-red-500/10 disabled:opacity-50 px-3 py-2 rounded-lg transition">Dispute</button>
                          </div>
                        </div>
                      )}

                      {shift.venue_confirmed && (
                        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          <span className="text-xs text-emerald-400 font-medium">Confirmed</span>
                          {shift.venue_confirmed_at && <span className="text-[10px] text-zinc-600 ml-auto">{new Date(shift.venue_confirmed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                        </div>
                      )}

                      {shift.dispute_status && shift.dispute_status !== "none" && (
                        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                          <span className="text-xs text-amber-400 font-medium">Under Review</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {activeShifts.length === 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                    <p className="text-sm text-zinc-500">No assigned staff for this event.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dispute Modal */}
      <AnimatePresence>
        {showDisputeModal && disputeShift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDisputeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Dispute Shift</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Raise a concern about {disputeShift.personnel?.display_name || "this guard"}'s shift.
                Funds will be held until our team reviews.
              </p>
              
              <div className="mb-4 p-3 bg-white/5 rounded-lg">
                <p className="text-sm text-zinc-300">
                  <strong>Role:</strong> {disputeShift.role}
                </p>
                <p className="text-sm text-zinc-300">
                  <strong>Scheduled:</strong> {formatTime(disputeShift.scheduled_start)} - {formatTime(disputeShift.scheduled_end)}
                </p>
                {disputeShift.actual_start && (
                  <p className="text-sm text-zinc-300">
                    <strong>Worked:</strong> {formatTime(disputeShift.actual_start)} - {disputeShift.actual_end ? formatTime(disputeShift.actual_end) : "N/A"}
                  </p>
                )}
              </div>

              <label className="block text-sm text-zinc-400 mb-2">
                Reason for dispute *
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please describe the issue in detail (e.g., guard left early, unprofessional behavior, did not perform duties)..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-zinc-500 text-sm resize-none focus:outline-none focus:border-purple-500"
                rows={4}
              />
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                Minimum 10 characters required
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitDispute}
                  disabled={actionLoading === disputeShift.id || disputeReason.trim().length < 10}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition font-medium"
                >
                  {actionLoading === disputeShift.id ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Shift Modal */}
      <AnimatePresence>
        {showCancelModal && cancelShift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Cancel Shift</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Cancel {cancelShift.personnel?.display_name || "this guard"}'s shift assignment.
                They will be notified of the cancellation.
              </p>
              
              <div className="mb-4 p-3 bg-white/5 rounded-lg">
                <p className="text-sm text-zinc-300">
                  <strong>Role:</strong> {cancelShift.role}
                </p>
                <p className="text-sm text-zinc-300">
                  <strong>Scheduled:</strong> {formatTime(cancelShift.scheduled_start)} - {formatTime(cancelShift.scheduled_end)}
                </p>
                <p className="text-sm text-zinc-300">
                  <strong>Rate:</strong> £{cancelShift.hourly_rate}/hr
                </p>
              </div>

              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400">
                  ⚠️ Cancelling less than 24 hours before the shift may require partial compensation to the guard.
                </p>
              </div>

              <label className="block text-sm text-zinc-400 mb-2">
                Reason for cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancelling this shift..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-zinc-500 text-sm resize-none focus:outline-none focus:border-purple-500"
                rows={3}
              />
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                Minimum 5 characters required
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
                >
                  Keep Shift
                </button>
                <button
                  onClick={handleSubmitCancel}
                  disabled={actionLoading === cancelShift.id || cancelReason.trim().length < 5}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition font-medium"
                >
                  {actionLoading === cancelShift.id ? "Cancelling..." : "Cancel Shift"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
