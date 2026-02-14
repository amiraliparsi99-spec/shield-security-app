"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSupabase, useUser } from "@/hooks";

type Guard = {
  id: string;
  display_name: string;
  shield_score: number;
  photo_url: string | null;
  city: string | null;
  total_shifts: number;
  role: string;
};

type Booking = {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  estimated_total: number;
  staff_requirements: any[];
  guards: Guard[];
  totalShifts: number;
  claimedShifts: number;
  isPaid: boolean;
  paidAt: string | null;
};

export default function BookingsPage() {
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "paid">("all");

  // Fetch bookings with guard details
  useEffect(() => {
    async function fetchBookings() {
      if (userLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      
      // Get venue - try multiple ways to find it
      let venue = null;
      
      // First try by user_id directly
      const { data: venueByUser } = await supabase
        .from('venues')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (venueByUser) {
        venue = venueByUser;
      } else {
        // Try via profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          const { data: venueByProfile } = await supabase
            .from('venues')
            .select('id')
            .eq('user_id', profile.id)
            .single();
          
          if (venueByProfile) {
            venue = venueByProfile;
          }
        }
      }
      
      if (!venue) {
        setLoading(false);
        return;
      }

      // Get bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('venue_id', venue.id)
        .order('event_date', { ascending: false });

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      // Get shifts for each booking (simplified query)
      const enrichedBookings: Booking[] = [];
      
      for (const booking of bookingsData) {
        // Simple shifts query without join
        const { data: shifts, error: shiftsError } = await supabase
          .from('shifts')
          .select('id, role, personnel_id, status')
          .eq('booking_id', booking.id);

        const guards: Guard[] = [];
        let claimedShifts = 0;

        if (shifts) {
          const personnelIds = shifts
            .filter(s => s.personnel_id)
            .map(s => s.personnel_id);
          
          claimedShifts = personnelIds.length;

          if (personnelIds.length > 0) {
            const uniquePersonnelIds = [...new Set(personnelIds)];
            
            const { data: personnelData } = await supabase
              .from('personnel')
              .select('id, display_name, shield_score, city, total_shifts')
              .in('id', uniquePersonnelIds);

            if (personnelData && personnelData.length > 0) {
              for (const shift of shifts) {
                if (shift.personnel_id) {
                  const person = personnelData.find(p => p.id === shift.personnel_id);
                  if (person) {
                    guards.push({
                      id: person.id,
                      display_name: person.display_name,
                      shield_score: person.shield_score || 0,
                      photo_url: null, // Photo is in profiles table
                      city: person.city,
                      total_shifts: person.total_shifts || 0,
                      role: shift.role,
                    });
                  }
                }
              }
            }
          }
        }

        // Check if booking has payment_status = 'paid' directly (column may not exist)
        const isPaidFromBooking = (booking as any).payment_status === 'paid';
        
        enrichedBookings.push({
          id: booking.id,
          event_name: booking.event_name,
          event_date: booking.event_date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
          estimated_total: booking.estimated_total || 0,
          staff_requirements: booking.staff_requirements || [],
          guards,
          totalShifts: shifts?.length || 0,
          claimedShifts,
          isPaid: isPaidFromBooking,
          paidAt: isPaidFromBooking ? (booking as any).updated_at : null,
        });
      }

      // Also check transactions table for payment status (fallback)
      const bookingIds = enrichedBookings.map(b => b.id);
      
      if (bookingIds.length > 0) {
        const { data: payments } = await supabase
          .from('transactions')
          .select('booking_id, status, created_at')
          .in('booking_id', bookingIds);

        if (payments) {
          const succeededPayments = payments.filter(p => p.status === 'succeeded');
          
          for (const payment of succeededPayments) {
            const booking = enrichedBookings.find(b => b.id === payment.booking_id);
            if (booking && !booking.isPaid) {
              booking.isPaid = true;
              booking.paidAt = payment.created_at;
            }
          }
        }
      }

      setBookings(enrichedBookings);
      setLoading(false);
    }

    fetchBookings();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, [user, userLoading, supabase]);

  const filteredBookings = bookings.filter(b => {
    if (filter === "all") return true;
    if (filter === "confirmed") return b.claimedShifts > 0 && !b.isPaid;
    if (filter === "pending") return b.claimedShifts === 0;
    if (filter === "paid") return b.isPaid;
    return true;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Jobs</h1>
          <p className="text-sm text-zinc-400">Track who's working your events</p>
        </div>
        <Link href="/d/venue/bookings/new">
          <motion.button
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl transition"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            + Post New Job
          </motion.button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`p-4 rounded-xl transition ${filter === "all" ? "bg-white/10 border border-white/20" : "bg-white/5"}`}
        >
          <p className="text-2xl font-bold text-white">{bookings.length}</p>
          <p className="text-sm text-zinc-400">Total Jobs</p>
        </button>
        <button
          onClick={() => setFilter("confirmed")}
          className={`p-4 rounded-xl transition ${filter === "confirmed" ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5"}`}
        >
          <p className="text-2xl font-bold text-emerald-400">
            {bookings.filter(b => b.claimedShifts > 0 && !b.isPaid).length}
          </p>
          <p className="text-sm text-zinc-400">Confirmed</p>
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`p-4 rounded-xl transition ${filter === "pending" ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5"}`}
        >
          <p className="text-2xl font-bold text-amber-400">
            {bookings.filter(b => b.claimedShifts === 0).length}
          </p>
          <p className="text-sm text-zinc-400">Awaiting</p>
        </button>
        <button
          onClick={() => setFilter("paid")}
          className={`p-4 rounded-xl transition ${filter === "paid" ? "bg-blue-500/20 border border-blue-500/30" : "bg-white/5"}`}
        >
          <p className="text-2xl font-bold text-blue-400">
            {bookings.filter(b => b.isPaid).length}
          </p>
          <p className="text-sm text-zinc-400">Paid</p>
        </button>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg font-medium text-white mb-2">No jobs yet</p>
            <p className="text-zinc-400 mb-4">Post your first job to get started</p>
            <Link href="/d/venue/bookings/new">
              <button className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl">
                Post a Job
              </button>
            </Link>
          </div>
        ) : (
          filteredBookings.map(booking => (
            <motion.div
              key={booking.id}
              className="bg-white/5 rounded-2xl overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Booking Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-white">{booking.event_name}</h3>
                      {booking.isPaid ? (
                        <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          PAID
                        </span>
                      ) : booking.claimedShifts > 0 ? (
                        <span className="bg-emerald-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">
                          CONFIRMED
                        </span>
                      ) : (
                        <span className="bg-amber-500/20 text-amber-400 text-xs font-medium px-2.5 py-1 rounded-full">
                          Awaiting Claims
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400">
                      {formatDate(booking.event_date)} • {booking.start_time} - {booking.end_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">£{booking.estimated_total.toFixed(0)}</p>
                    <p className="text-xs text-zinc-500">{booking.totalShifts} shift{booking.totalShifts !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              {/* Guards Section */}
              {booking.guards.length > 0 ? (
                <div className="p-4 bg-emerald-500/5">
                  <p className="text-sm font-medium text-emerald-400 mb-3">
                    Your Security Team ({booking.claimedShifts}/{booking.totalShifts})
                  </p>
                  <div className="space-y-2">
                    {booking.guards.map((guard, index) => (
                      <Link key={`${guard.id}-${index}`} href={`/personnel/${guard.id}`}>
                        <div className="bg-black/30 rounded-xl p-3 flex items-center gap-3 hover:bg-black/50 transition cursor-pointer">
                          {/* Avatar */}
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                            {guard.photo_url ? (
                              <img src={guard.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              guard.display_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-lg truncate">{guard.display_name}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-emerald-400 font-medium">★ {guard.shield_score}</span>
                              <span className="text-zinc-500">•</span>
                              <span className="text-zinc-400">{guard.total_shifts} jobs done</span>
                              {guard.city && (
                                <>
                                  <span className="text-zinc-500">•</span>
                                  <span className="text-zinc-400">{guard.city}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Role Badge */}
                          <span className="bg-white/10 text-white text-xs px-3 py-1.5 rounded-lg flex-shrink-0">
                            {guard.role}
                          </span>
                          
                          {/* Arrow */}
                          <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {booking.claimedShifts < booking.totalShifts && (
                    <p className="text-xs text-zinc-500 mt-3 text-center">
                      {booking.totalShifts - booking.claimedShifts} more shift{booking.totalShifts - booking.claimedShifts !== 1 ? 's' : ''} awaiting claims...
                    </p>
                  )}

                  {/* Pay Now Button or Payment Status */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    {booking.isPaid ? (
                      <div className="bg-blue-500/10 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-blue-400 font-medium">Payment Complete</p>
                            <p className="text-xs text-zinc-500">
                              Paid on {booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-white">£{booking.estimated_total.toFixed(0)}</p>
                      </div>
                    ) : (
                      <Link href={`/d/venue/bookings/${booking.id}/pay`}>
                        <motion.button
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold py-3 rounded-xl text-base transition flex items-center justify-center gap-2"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Pay Now - £{booking.estimated_total.toFixed(0)}
                        </motion.button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <div className="inline-flex items-center gap-2 text-amber-400 mb-2">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                    <span className="font-medium">Live on Job Board</span>
                  </div>
                  <p className="text-sm text-zinc-500">Guards are being notified. First to claim gets the job.</p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
