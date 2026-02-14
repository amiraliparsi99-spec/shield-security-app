"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BookingCard, BookingStatusBadge } from "@/components/agency";
import type { Booking, BookingStatus } from "@/types/database";

type FilterStatus = BookingStatus | "all";
type TabType = "upcoming" | "in_progress" | "completed" | "cancelled";

interface BookingWithDetails extends Booking {
  venue?: { name: string; address?: string };
  assignedCount?: number;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("month");

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setIsLoading(true);
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

      // Get bookings with venue details
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(`
          *,
          venue:venues(name, address)
        `)
        .eq("provider_type", "agency")
        .eq("provider_id", agency.id)
        .order("start", { ascending: true });

      if (!bookingsData) {
        setBookings([]);
        return;
      }

      // Get assignment counts for each booking
      const bookingIds = bookingsData.map((b) => b.id);
      
      let assignmentCounts: Record<string, number> = {};
      if (bookingIds.length > 0) {
        const { data: assignments } = await supabase
          .from("booking_assignments")
          .select("booking_id")
          .in("booking_id", bookingIds);

        if (assignments) {
          assignmentCounts = assignments.reduce((acc, a) => {
            acc[a.booking_id] = (acc[a.booking_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      const bookingsWithCounts = bookingsData.map((booking) => ({
        ...booking,
        assignedCount: assignmentCounts[booking.id] || 0,
      }));

      setBookings(bookingsWithCounts);
    } catch (error) {
      console.error("Error loading bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter bookings by tab
  const now = new Date();
  const filteredBookings = bookings.filter((booking) => {
    const startDate = new Date(booking.start);
    const endDate = new Date(booking.end);

    switch (activeTab) {
      case "upcoming":
        return startDate > now && booking.status !== "cancelled";
      case "in_progress":
        return startDate <= now && endDate >= now && booking.status === "confirmed";
      case "completed":
        return booking.status === "completed";
      case "cancelled":
        return booking.status === "cancelled";
      default:
        return true;
    }
  });

  // Further filter by date range
  const dateFilteredBookings = filteredBookings.filter((booking) => {
    if (dateRange === "all") return true;
    
    const startDate = new Date(booking.start);
    const rangeEnd = new Date();
    
    if (dateRange === "week") {
      rangeEnd.setDate(rangeEnd.getDate() + 7);
    } else if (dateRange === "month") {
      rangeEnd.setMonth(rangeEnd.getMonth() + 1);
    }

    return startDate <= rangeEnd;
  });

  const tabCounts = {
    upcoming: bookings.filter((b) => new Date(b.start) > now && b.status !== "cancelled").length,
    in_progress: bookings.filter((b) => {
      const start = new Date(b.start);
      const end = new Date(b.end);
      return start <= now && end >= now && b.status === "confirmed";
    }).length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-white">Bookings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your confirmed bookings and staff assignments
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {([
          { key: "upcoming", label: "Upcoming" },
          { key: "in_progress", label: "In Progress" },
          { key: "completed", label: "Completed" },
          { key: "cancelled", label: "Cancelled" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-shield-500/20 text-shield-300"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab.label}
            <span className="ml-2 text-zinc-500">({tabCounts[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* Date Range Filter (for upcoming) */}
      {activeTab === "upcoming" && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-zinc-400">Show:</span>
          {([
            { key: "week", label: "Next 7 days" },
            { key: "month", label: "Next 30 days" },
            { key: "all", label: "All upcoming" },
          ] as const).map((range) => (
            <button
              key={range.key}
              onClick={() => setDateRange(range.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                dateRange === range.key
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      {/* Bookings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : dateFilteredBookings.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 font-display text-lg font-medium text-white">
            No {activeTab.replace("_", " ")} bookings
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            {activeTab === "upcoming"
              ? "Browse open requests to find new opportunities"
              : "Bookings will appear here once you have them"}
          </p>
          {activeTab === "upcoming" && (
            <a
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400"
            >
              Browse Requests
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {dateFilteredBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}

      {/* Summary */}
      {dateFilteredBookings.length > 0 && (
        <div className="mt-6 text-center text-sm text-zinc-500">
          Showing {dateFilteredBookings.length} booking{dateFilteredBookings.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
