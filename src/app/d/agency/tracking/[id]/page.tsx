"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { StaffLocation, AgencyStaffWithPersonnel } from "@/types/database";

interface LocationHistoryItem extends StaffLocation {
  booking_assignment?: {
    id: string;
    booking: {
      venue: { name: string };
      start: string;
      end: string;
    };
  };
}

export default function StaffLocationHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const [staff, setStaff] = useState<AgencyStaffWithPersonnel | null>(null);
  const [locations, setLocations] = useState<LocationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month">("today");

  useEffect(() => {
    if (params.id) {
      loadData();
    }
  }, [params.id, dateFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const staffId = params.id as string;

      // Get staff details
      const { data: staffData } = await supabase
        .from("agency_staff")
        .select(`
          *,
          personnel:personnel(*)
        `)
        .eq("id", staffId)
        .single();

      if (!staffData) {
        router.push("/d/agency/tracking");
        return;
      }

      setStaff(staffData);

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (dateFilter) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      // Get location history
      const { data: locationData } = await supabase
        .from("staff_locations")
        .select(`
          *,
          booking_assignment:booking_assignments(
            id,
            booking:bookings(
              venue:venues(name),
              start,
              end
            )
          )
        `)
        .eq("agency_staff_id", staffId)
        .gte("recorded_at", startDate.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(500);

      setLocations(locationData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      time: date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  // Group locations by date
  const groupedLocations = locations.reduce((groups, loc) => {
    const date = new Date(loc.recorded_at).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(loc);
    return groups;
  }, {} as Record<string, LocationHistoryItem[]>);

  // Calculate statistics
  const stats = {
    totalPoints: locations.length,
    uniqueDays: Object.keys(groupedLocations).length,
    shiftsTracked: new Set(locations.filter(l => l.booking_assignment_id).map(l => l.booking_assignment_id)).size,
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

  if (!staff) {
    return null;
  }

  const initials = staff.personnel.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/d/agency/tracking"
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Live Tracking
        </Link>
      </div>

      <div className="mx-auto max-w-4xl">
        {/* Staff Header */}
        <div className="glass mb-6 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-lg font-bold text-white">
              {initials}
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-white">
                {staff.personnel.display_name}
              </h1>
              <p className="text-zinc-400">Location History</p>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <div className="mb-6 flex gap-2">
          {([
            { key: "today", label: "Today" },
            { key: "week", label: "Last 7 Days" },
            { key: "month", label: "Last 30 Days" },
          ] as const).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setDateFilter(filter.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                dateFilter === filter.key
                  ? "bg-shield-500/20 text-shield-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="glass rounded-xl p-4">
            <p className="text-2xl font-semibold text-white">{stats.totalPoints}</p>
            <p className="text-sm text-zinc-400">Location Points</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-2xl font-semibold text-white">{stats.uniqueDays}</p>
            <p className="text-sm text-zinc-400">Days Tracked</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-2xl font-semibold text-white">{stats.shiftsTracked}</p>
            <p className="text-sm text-zinc-400">Shifts Tracked</p>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="glass mb-6 overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="font-medium text-white">Route Map</h2>
          </div>
          <div className="relative aspect-[16/9] bg-zinc-900/50">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <svg className="h-12 w-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="mt-4 text-sm text-zinc-500">
                Route visualization coming soon
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {locations.length} location points to display
              </p>
            </div>
          </div>
        </div>

        {/* Location Timeline */}
        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="font-medium text-white">Location Timeline</h2>
          </div>
          
          {locations.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <p className="mt-4 text-sm text-zinc-500">
                No location data for this period
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {Object.entries(groupedLocations).map(([date, dayLocations]) => (
                <div key={date}>
                  <div className="sticky top-0 z-10 bg-zinc-900/80 px-4 py-2 backdrop-blur">
                    <p className="text-sm font-medium text-zinc-400">{date}</p>
                  </div>
                  <div className="space-y-1 px-4 py-2">
                    {dayLocations.slice(0, 20).map((loc, idx) => {
                      const { time } = formatDateTime(loc.recorded_at);
                      return (
                        <div
                          key={loc.id}
                          className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.02]"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-shield-500/20 text-xs text-shield-400">
                            {time}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white">
                              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                            </p>
                            {loc.booking_assignment?.booking && (
                              <p className="text-xs text-shield-400">
                                @ {loc.booking_assignment.booking.venue?.name}
                              </p>
                            )}
                          </div>
                          {loc.accuracy && (
                            <span className="shrink-0 text-xs text-zinc-500">
                              ±{Math.round(loc.accuracy)}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {dayLocations.length > 20 && (
                      <p className="py-2 text-center text-xs text-zinc-500">
                        +{dayLocations.length - 20} more points
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export Options */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            onClick={() => {
              // Export as CSV
              const csv = [
                ["Timestamp", "Latitude", "Longitude", "Accuracy", "Shift"].join(","),
                ...locations.map((l) =>
                  [
                    l.recorded_at,
                    l.lat,
                    l.lng,
                    l.accuracy || "",
                    l.booking_assignment?.booking?.venue?.name || "",
                  ].join(",")
                ),
              ].join("\n");
              
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `location-history-${staff.personnel.display_name.replace(/\s+/g, "-")}-${dateFilter}.csv`;
              a.click();
            }}
          >
            <svg className="mr-2 inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
