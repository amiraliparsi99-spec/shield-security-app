"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { StaffLocation, AgencyStaffWithPersonnel, Booking } from "@/types/database";

// Dynamic import for map to avoid SSR issues
const StaffTrackingMap = dynamic(
  () => import("@/components/maps/StaffTrackingMap").then((mod) => mod.StaffTrackingMap),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-zinc-900/50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    ),
  }
);

interface StaffWithLocation extends AgencyStaffWithPersonnel {
  latest_location?: {
    lat: number;
    lng: number;
    recorded_at: string;
    accuracy?: number;
  };
  active_assignment?: {
    id: string;
    booking: Booking & { venue?: { name: string; lat?: number; lng?: number } };
  };
}

export default function LiveTrackingPage() {
  const [staff, setStaff] = useState<StaffWithLocation[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadStaffLocations();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadStaffLocations();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadStaffLocations = async () => {
    try {
      const supabase = createClient();

      // Get current user's agency
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("owner_id", profile.id)
        .single();

      if (!agency) return;

      // Get all active staff
      const { data: staffData } = await supabase
        .from("agency_staff")
        .select(`
          *,
          personnel:personnel(*)
        `)
        .eq("agency_id", agency.id)
        .eq("status", "active");

      if (!staffData) {
        setStaff([]);
        return;
      }

      // For each staff, get their latest location and active assignment
      const staffWithLocations: StaffWithLocation[] = await Promise.all(
        staffData.map(async (s: any) => {
          // Get latest location
          const { data: locationData } = await supabase
            .from("staff_locations")
            .select("lat, lng, recorded_at, accuracy")
            .eq("agency_staff_id", s.id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .single();

          // Get active assignment (confirmed, not completed)
          const now = new Date().toISOString();
          const { data: assignmentData } = await supabase
            .from("booking_assignments")
            .select(`
              id,
              booking:bookings(
                *,
                venue:venues(name, lat, lng)
              )
            `)
            .eq("agency_staff_id", s.id)
            .eq("status", "confirmed")
            .single();

          return {
            ...s,
            latest_location: locationData || undefined,
            active_assignment: assignmentData || undefined,
          };
        })
      );

      setStaff(staffWithLocations);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const activeStaff = staff.filter((s) => s.latest_location);
  const onShiftStaff = staff.filter((s) => s.active_assignment);

  // Transform data for map component
  const mapStaffLocations = useMemo(() => {
    return activeStaff.map((s) => ({
      id: s.id,
      name: s.personnel.display_name,
      lat: s.latest_location!.lat,
      lng: s.latest_location!.lng,
      accuracy: s.latest_location!.accuracy,
      isOnShift: !!s.active_assignment,
      venueName: s.active_assignment?.booking?.venue?.name,
      lastUpdated: s.latest_location!.recorded_at,
    }));
  }, [activeStaff]);

  // Get venue geofences for active shifts
  const venueGeofences = useMemo(() => {
    const seen = new Set<string>();
    return onShiftStaff
      .filter((s) => {
        const venue = s.active_assignment?.booking?.venue;
        if (!venue?.lat || !venue?.lng || seen.has(venue.name)) return false;
        seen.add(venue.name);
        return true;
      })
      .map((s) => ({
        id: s.active_assignment!.booking.venue!.name,
        name: s.active_assignment!.booking.venue!.name,
        lat: s.active_assignment!.booking.venue!.lat!,
        lng: s.active_assignment!.booking.venue!.lng!,
        radius: 100, // Default 100m radius
      }));
  }, [onShiftStaff]);

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Live Tracking</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Monitor your staff locations in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-white/5 text-shield-500 focus:ring-shield-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={loadStaffLocations}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{activeStaff.length}</p>
              <p className="text-sm text-zinc-400">Active Trackers</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{onShiftStaff.length}</p>
              <p className="text-sm text-zinc-400">On Shift</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {lastUpdated ? formatTime(lastUpdated.toISOString()) : "—"}
              </p>
              <p className="text-sm text-zinc-400">Last Updated</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Map */}
        <div className="lg:col-span-2">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="border-b border-white/[0.06] p-4">
              <h2 className="font-medium text-white">Live Map</h2>
            </div>
            <StaffTrackingMap
              staffLocations={mapStaffLocations}
              venueGeofences={venueGeofences}
              selectedStaffId={selectedStaff}
              onStaffSelect={setSelectedStaff}
              className="aspect-[16/10]"
            />
          </div>
        </div>

        {/* Staff List */}
        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="font-medium text-white">Staff Locations</h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
              </div>
            ) : staff.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-500">No active staff</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {staff.map((s) => {
                  const initials = s.personnel.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  const hasLocation = !!s.latest_location;
                  const isOnShift = !!s.active_assignment;

                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 p-4 transition ${
                        selectedStaff === s.id ? "bg-shield-500/10" : "hover:bg-white/[0.02]"
                      }`}
                      onClick={() => setSelectedStaff(s.id === selectedStaff ? null : s.id)}
                    >
                      <div className="relative">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-shield-500 to-shield-600 text-xs font-semibold text-white">
                          {initials}
                        </div>
                        {hasLocation && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {s.personnel.display_name}
                        </p>
                        {isOnShift ? (
                          <p className="truncate text-xs text-shield-400">
                            @ {s.active_assignment?.booking?.venue?.name || "On shift"}
                          </p>
                        ) : hasLocation ? (
                          <p className="text-xs text-zinc-500">
                            Updated {formatTime(s.latest_location!.recorded_at)}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-600">No location data</p>
                        )}
                      </div>
                      {hasLocation && (
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-zinc-400">
                            {s.latest_location!.lat.toFixed(4)}, {s.latest_location!.lng.toFixed(4)}
                          </p>
                          {s.latest_location!.accuracy && (
                            <p className="text-xs text-zinc-600">
                              ±{Math.round(s.latest_location!.accuracy)}m
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Staff Detail */}
      {selectedStaff && (
        <div className="mt-6">
          {(() => {
            const s = staff.find((st) => st.id === selectedStaff);
            if (!s) return null;

            return (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-medium text-white">
                    {s.personnel.display_name}
                  </h3>
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status</p>
                    <p className="mt-1 text-sm text-white">
                      {s.active_assignment ? "On Shift" : "Off Duty"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Last Location</p>
                    <p className="mt-1 text-sm text-white">
                      {s.latest_location
                        ? formatTime(s.latest_location.recorded_at)
                        : "No data"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Accuracy</p>
                    <p className="mt-1 text-sm text-white">
                      {s.latest_location?.accuracy
                        ? `±${Math.round(s.latest_location.accuracy)}m`
                        : "—"}
                    </p>
                  </div>
                </div>

                {s.active_assignment && (
                  <div className="mt-4">
                    <p className="text-sm text-zinc-400">
                      Currently at:{" "}
                      <span className="text-white">
                        {s.active_assignment.booking?.venue?.name}
                      </span>
                    </p>
                    <Link
                      href={`/d/agency/bookings/${s.active_assignment.booking.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-sm text-shield-400 hover:text-shield-300"
                    >
                      View booking
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/d/agency/staff/${s.id}`}
                    className="rounded-lg bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/d/agency/tracking/${s.id}`}
                    className="rounded-lg bg-shield-500/20 px-4 py-2 text-sm text-shield-300 transition hover:bg-shield-500/30"
                  >
                    View History
                  </Link>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-6 glass rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-shield-500/20 text-shield-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">About GPS Tracking</p>
            <p className="mt-1 text-xs text-zinc-400">
              Location tracking is only active during confirmed shifts. Staff must enable location permissions
              on their mobile device. All tracking data is retained for 90 days for audit purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
