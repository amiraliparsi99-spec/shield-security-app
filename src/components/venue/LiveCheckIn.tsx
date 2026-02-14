"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase } from "@/hooks/useSupabase";
import { useVenueProfile } from "@/hooks";
import Link from "next/link";

type ShiftStatus = "pending" | "accepted" | "declined" | "checked_in" | "checked_out" | "no_show" | "cancelled";

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
  personnel?: {
    id: string;
    user_id: string;
    users: {
      full_name: string;
      avatar_url: string | null;
    };
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

export function LiveCheckIn() {
  const supabase = useSupabase();
  const { data: venue } = useVenueProfile();
  
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<LiveBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's and active bookings
  const fetchBookings = useCallback(async () => {
    if (!venue?.id) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Get bookings for today and tomorrow (to catch overnight events)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

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
          personnel:personnel_id (
            id,
            user_id,
            users (
              full_name,
              avatar_url
            )
          )
        )
      `)
      .eq('venue_id', venue.id)
      .in('event_date', [todayStr, tomorrowStr])
      .in('status', ['confirmed', 'in_progress'])
      .order('event_date', { ascending: true });

    if (!error && data) {
      const typedBookings = data as unknown as LiveBooking[];
      setBookings(typedBookings);
      
      // Auto-select the first active booking
      if (typedBookings.length > 0 && !selectedBooking) {
        setSelectedBooking(typedBookings[0]);
      } else if (selectedBooking) {
        // Update selected booking with fresh data
        const updated = typedBookings.find(b => b.id === selectedBooking.id);
        if (updated) setSelectedBooking(updated);
      }
    }
    setLoading(false);
  }, [supabase, venue?.id, selectedBooking]);

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
    
    const { error } = await supabase
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
    if (!confirm('Are you sure you want to mark this staff as a no-show? This will affect their Shield Score.')) {
      return;
    }
    
    setActionLoading(shiftId);
    
    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'no_show',
        no_show_at: new Date().toISOString(),
      })
      .eq('id', shiftId);

    if (error) {
      console.error('No-show error:', error);
      alert('Failed to mark no-show. Please try again.');
    }
    
    setActionLoading(null);
  };

  // Contact staff (open messages)
  const handleContactStaff = (personnelUserId: string) => {
    // Navigate to messages with this user
    window.location.href = `/d/venue/messages?user=${personnelUserId}`;
  };

  // Find replacement
  const handleFindReplacement = (bookingId: string) => {
    // Navigate to find replacement flow
    window.location.href = `/d/venue/bookings/${bookingId}?action=find-replacement`;
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
            <h2 className="text-xl font-bold text-white">Live Check-In</h2>
            <p className="text-sm text-zinc-400">Real-time attendance tracking</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-sm text-zinc-400">
              {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
        </div>

        <div className="glass rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-lg font-semibold text-white mb-2">No Active Events</h3>
          <p className="text-zinc-400 mb-4">You don't have any confirmed bookings for today.</p>
          <Link
            href="/d/venue/bookings/new"
            className="inline-flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Book Security
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Live Check-In</h2>
          <p className="text-sm text-zinc-400">Real-time attendance tracking</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-sm text-zinc-400">
            {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          </p>
        </div>
      </div>

      {/* Event Selector (if multiple bookings) */}
      {bookings.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {bookings.map((booking) => (
            <button
              key={booking.id}
              onClick={() => setSelectedBooking(booking)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedBooking?.id === booking.id
                  ? "bg-purple-500 text-white"
                  : "glass text-zinc-400 hover:text-white"
              }`}
            >
              {booking.event_name}
            </button>
          ))}
        </div>
      )}

      {/* Selected Event Info */}
      {selectedBooking && (
        <>
          <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedBooking.event_name}</h3>
                <p className="text-sm text-zinc-400">{selectedBooking.start_time} - {selectedBooking.end_time}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-sm text-emerald-400 font-medium">Live</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-zinc-400">On Site</p>
              <p className="text-3xl font-bold text-emerald-400">{stats.checkedIn}</p>
              <p className="text-xs text-zinc-500">of {stats.total} assigned</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-zinc-400">Late</p>
              <p className="text-3xl font-bold text-amber-400">{stats.late}</p>
              {stats.late > 0 && <p className="text-xs text-amber-500">Needs attention</p>}
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-zinc-400">No Show</p>
              <p className="text-3xl font-bold text-red-400">{stats.noShow}</p>
              {stats.noShow > 0 && <p className="text-xs text-red-500">⚠️ Coverage gap</p>}
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-zinc-400">Pending</p>
              <p className="text-3xl font-bold text-zinc-400">{stats.pending}</p>
              <p className="text-xs text-zinc-500">Not yet due</p>
            </div>
          </div>

          {/* Alerts */}
          <AnimatePresence>
            {(stats.late > 0 || stats.noShow > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/5"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <p className="font-medium text-white">Attendance Alert</p>
                      <p className="text-sm text-zinc-400">
                        {stats.late > 0 && `${stats.late} staff late. `}
                        {stats.noShow > 0 && `${stats.noShow} no-shows.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => handleFindReplacement(selectedBooking.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Find Replacement
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Staff Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedBooking.shifts
              .filter(s => s.personnel_id && s.status !== 'declined' && s.status !== 'cancelled')
              .map(shift => {
                const displayStatus = getShiftDisplayStatus(shift);
                const staffName = shift.personnel?.users?.full_name || 'Unassigned';
                const staffInitial = staffName.charAt(0).toUpperCase();
                
                return (
                  <motion.div
                    key={shift.id}
                    layout
                    className={`glass rounded-xl p-4 transition ${
                      displayStatus === "no_show" || displayStatus === "late"
                        ? "border border-red-500/30"
                        : displayStatus === "checked_in"
                        ? "border border-emerald-500/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                        displayStatus === "checked_in"
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                          : displayStatus === "late" || displayStatus === "no_show"
                          ? "bg-gradient-to-br from-red-500 to-red-600 text-white"
                          : "bg-white/10 text-zinc-400"
                      }`}>
                        {staffInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getStatusIcon(displayStatus)}</span>
                          <h3 className="font-medium text-white truncate">{staffName}</h3>
                        </div>
                        <p className="text-sm text-zinc-400">{shift.role}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(displayStatus)}
                        </div>
                      </div>
                    </div>

                    {/* Time Info */}
                    <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-zinc-500">Scheduled</p>
                        <p className="text-white">{formatTime(shift.scheduled_start)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Checked In</p>
                        <p className={shift.actual_start ? "text-emerald-400" : "text-zinc-600"}>
                          {shift.actual_start ? formatTime(shift.actual_start) : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Location indicator */}
                    {shift.check_in_latitude && shift.check_in_longitude && (
                      <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        GPS verified
                      </div>
                    )}

                    {/* Actions */}
                    {(displayStatus === "late" || displayStatus === "pending") && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleManualCheckIn(shift.id)}
                          disabled={actionLoading === shift.id}
                          className="flex-1 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 px-3 py-2 rounded-lg transition"
                        >
                          {actionLoading === shift.id ? "..." : "Manual Check-In"}
                        </button>
                        {shift.personnel?.user_id && (
                          <button 
                            onClick={() => handleContactStaff(shift.personnel!.user_id)}
                            className="text-xs bg-white/10 text-zinc-400 hover:text-white px-3 py-2 rounded-lg transition"
                          >
                            📞
                          </button>
                        )}
                      </div>
                    )}

                    {displayStatus === "late" && (
                      <button
                        onClick={() => handleMarkNoShow(shift.id)}
                        disabled={actionLoading === shift.id}
                        className="mt-2 w-full text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 px-3 py-2 rounded-lg transition"
                      >
                        Mark as No-Show
                      </button>
                    )}
                  </motion.div>
                );
              })}
          </div>

          {/* Coverage Summary */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">Coverage Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                // Group shifts by role
                const roleGroups = selectedBooking.shifts
                  .filter(s => s.personnel_id && s.status !== 'declined' && s.status !== 'cancelled')
                  .reduce((acc, shift) => {
                    if (!acc[shift.role]) acc[shift.role] = [];
                    acc[shift.role].push(shift);
                    return acc;
                  }, {} as Record<string, LiveShift[]>);

                return Object.entries(roleGroups).map(([role, shifts]) => {
                  const onSite = shifts.filter(s => s.status === 'checked_in').length;
                  return (
                    <div key={role} className="bg-white/5 rounded-lg p-3">
                      <p className="text-sm text-zinc-400">{role}</p>
                      <p className="text-xl font-bold text-white">
                        {onSite}/{shifts.length}
                      </p>
                      <div className="h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            onSite === shifts.length
                              ? "bg-emerald-500"
                              : onSite > 0
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${shifts.length > 0 ? (onSite / shifts.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <motion.button
              onClick={() => fetchBookings()}
              className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </motion.button>
            <Link
              href={`/d/venue/mission-control?booking=${selectedBooking.id}`}
              className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Mission Control
            </Link>
            <Link
              href={`/d/venue/bookings/${selectedBooking.id}`}
              className="glass rounded-lg px-4 py-2 text-sm text-white hover:bg-white/10 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Booking Details
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
