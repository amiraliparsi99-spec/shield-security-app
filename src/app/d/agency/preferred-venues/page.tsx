"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { motion } from "framer-motion";

interface PreferredVenue {
  id: string;
  name: string;
  address: string;
  type: string;
  total_bookings: number;
  avg_rating: number;
  last_booking: string;
}

export default function PreferredVenuesPage() {
  const supabase = useSupabase();
  const [venues, setVenues] = useState<PreferredVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferredVenues();
  }, []);

  const loadPreferredVenues = async () => {
    setLoading(true);
    try {
      // Get agency ID
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

      // Get venues with most bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select(`
          venue_id,
          end,
          venues (
            id,
            name,
            address,
            type
          )
        `)
        .eq("provider_type", "agency")
        .eq("provider_id", agency.id)
        .eq("status", "completed")
        .order("end", { ascending: false });

      if (!bookings) return;

      // Aggregate by venue
      const venueMap = new Map<string, PreferredVenue>();
      
      for (const booking of bookings) {
        const venue = booking.venues as any;
        if (!venue) continue;

        if (venueMap.has(venue.id)) {
          const existing = venueMap.get(venue.id)!;
          existing.total_bookings++;
          if (new Date(booking.end) > new Date(existing.last_booking)) {
            existing.last_booking = booking.end;
          }
        } else {
          venueMap.set(venue.id, {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            type: venue.type || "venue",
            total_bookings: 1,
            avg_rating: 4.5, // Placeholder
            last_booking: booking.end,
          });
        }
      }

      const sortedVenues = Array.from(venueMap.values())
        .sort((a, b) => b.total_bookings - a.total_bookings)
        .slice(0, 20);

      setVenues(sortedVenues);
    } catch (error) {
      console.error("Error loading preferred venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Preferred Venues</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Venues you work with most frequently
        </p>
      </header>

      {venues.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Preferred Venues Yet</h3>
          <p className="text-sm text-zinc-500">
            Complete bookings with venues to see your most frequent partners here
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue, index) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-xl p-6 hover:shadow-glow-sm transition cursor-pointer"
              onClick={() => window.location.href = `/venue/${venue.id}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{venue.name}</h3>
                  <p className="text-sm text-zinc-400">{venue.address}</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-shield-500/20 text-shield-400 text-xs font-medium">
                  {venue.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Total Bookings</p>
                  <p className="text-lg font-semibold text-white">{venue.total_bookings}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Last Booking</p>
                  <p className="text-sm text-zinc-300">{formatDate(venue.last_booking)}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(venue.avg_rating)
                        ? "text-yellow-400"
                        : "text-zinc-700"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="ml-2 text-xs text-zinc-500">{venue.avg_rating.toFixed(1)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
