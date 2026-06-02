"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSupabase, useUser } from "@/hooks";
import Link from "next/link";

type Shift = {
  id: string;
  booking_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  venue_name: string;
  venue_city: string;
  event_name: string;
  attire_requirement?: string | null;
};

function extractAttireRequirement(briefNotes?: string | null): string | null {
  if (!briefNotes) return null;
  const match = briefNotes.match(/Attire requirement:\s*(.+)/i);
  return match?.[1]?.trim() || null;
}

export default function JobsPage() {
  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [personnel, setPersonnel] = useState<any>(null);
  const [tab, setTab] = useState<"available" | "my-shifts">("available");

  // Fetch personnel and shifts
  useEffect(() => {
    async function fetchData() {
      if (userLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }

      // Get personnel profile
      const { data: personnelData } = await supabase
        .from('personnel')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!personnelData) {
        setLoading(false);
        return;
      }
      setPersonnel(personnelData);

      // Fetch available shifts (unclaimed) - simple query
      const { data: available } = await supabase
        .from('shifts')
        .select('id, booking_id, role, hourly_rate, scheduled_start, scheduled_end')
        .is('personnel_id', null)
        .gte('scheduled_start', new Date().toISOString());

      // Fetch my shifts - simple query
      const { data: mine } = await supabase
        .from('shifts')
        .select('id, booking_id, role, hourly_rate, scheduled_start, scheduled_end')
        .eq('personnel_id', personnelData.id)
        .gte('scheduled_start', new Date().toISOString());

      // Get all booking IDs to fetch booking details
      const allShifts = [...(available || []), ...(mine || [])];
      const bookingIds = [...new Set(allShifts.map(s => s.booking_id).filter(Boolean))];
      
      console.log('Available shifts:', available?.length, 'My shifts:', mine?.length);
      console.log('Booking IDs to fetch:', bookingIds);
      
      // Fetch bookings with venue details
      let bookingsMap: Record<string, any> = {};
      if (bookingIds.length > 0) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, event_name, venue_id, brief_notes')
          .in('id', bookingIds);
        
        console.log('Bookings fetched:', bookings, 'Error:', bookingsError);
        
        if (bookings && bookings.length > 0) {
          const venueIds = [...new Set(bookings.map(b => b.venue_id).filter(Boolean))];
          
          let venuesMap: Record<string, any> = {};
          if (venueIds.length > 0) {
            const { data: venues } = await supabase
              .from('venues')
              .select('id, name, city')
              .in('id', venueIds);
            
            if (venues) {
              venues.forEach(v => { venuesMap[v.id] = v; });
            }
          }
          
          bookings.forEach(b => {
            bookingsMap[b.id] = {
              event_name: b.event_name,
              venue: venuesMap[b.venue_id] || { name: 'Venue', city: '' },
              attire_requirement: extractAttireRequirement(b.brief_notes),
            };
          });
          
          console.log('Bookings map:', bookingsMap);
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
          venue_name: booking.venue?.name || 'Venue',
          venue_city: booking.venue?.city || '',
          event_name: booking.event_name || 'Event',
          attire_requirement: booking.attire_requirement || null,
        };
      };

      // Deduplicate shifts by ID to prevent duplicate key errors
      const dedup = (shifts: Shift[]) => {
        const seen = new Set<string>();
        return shifts.filter(s => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      };
      
      setAvailableShifts(dedup((available || []).map(formatShift)));
      setMyShifts(dedup((mine || []).map(formatShift)));
      setLoading(false);
    }

    fetchData();
    
    // Poll for new shifts every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user, userLoading, supabase]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getHours = (start: string, end: string) => {
    return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000).toFixed(1);
  };

  const claimShift = async (shift: Shift) => {
    if (!personnel) return;

    const isVerified =
      personnel.verification_status === "verified" || personnel.sia_verified === true;
    if (!isVerified) {
      alert(
        "Verification Required\n\nYou need to complete your verification before you can accept jobs. Please go to Settings → Documents & Verification to get verified."
      );
      return;
    }
    
    const hours = getHours(shift.scheduled_start, shift.scheduled_end);
    const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);
    
    const ok = confirm(
      `Claim this shift?\n\n` +
      `📍 ${shift.venue_name}\n` +
      `📅 ${formatDate(shift.scheduled_start)}\n` +
      `🕐 ${formatTime(shift.scheduled_start)} - ${formatTime(shift.scheduled_end)}\n` +
      `💰 £${pay}\n\n` +
      `${shift.attire_requirement ? `👔 Attire: ${shift.attire_requirement}\n\n` : ""}` +
      `You're committing to this shift.`
    );
    
    if (!ok) return;
    
    setClaiming(shift.id);
    
    try {
      // Use atomic claim function - prevents double booking!
      const { data: result, error } = await supabase
        .rpc('claim_shift', {
          p_shift_id: shift.id,
          p_personnel_id: personnel.id
        });
      
      console.log('Claim result:', result, error);
      
      // Handle the result
      if (error || !result?.success) {
        // Someone else got it first!
        if (result?.error === 'ALREADY_CLAIMED') {
          alert("⚡ Too slow! This shift was just claimed by another guard.");
        } else {
          alert(result?.message || "Failed to claim. Try again.");
        }
        // Remove from available list since it's gone
        setAvailableShifts(prev => prev.filter(s => s.id !== shift.id));
        setClaiming(null);
        return;
      }

      // Success! Notify venue
      const { data: booking } = await supabase
        .from('bookings')
        .select('venue_id')
        .eq('id', shift.booking_id)
        .single();

      if (booking?.venue_id) {
        const { data: venue } = await supabase
          .from('venues')
          .select('user_id')
          .eq('id', booking.venue_id)
          .single();
        
        if (venue?.user_id) {
          await supabase.from('notifications').insert({
            user_id: venue.user_id,
            type: 'shift',
            title: '✅ Shift Confirmed!',
            body: `${personnel.display_name} accepted the ${shift.role} shift for ${shift.event_name}`,
            data: { booking_id: shift.booking_id },
          });
        }
      }

      // Create Mission Control chat for this booking
      try {
        const { data: chatResult, error: chatError } = await supabase
          .rpc('create_mission_control_chat', { p_booking_id: shift.booking_id });
        console.log('Mission Control chat created:', chatResult, 'Error:', chatError);
      } catch (chatErr) {
        console.error('Mission Control chat error (non-critical):', chatErr);
      }

      // Move to my shifts
      setAvailableShifts(prev => prev.filter(s => s.id !== shift.id));
      setMyShifts(prev => [...prev, shift]);
      
      alert("✅ Shift claimed! You're confirmed for this job. Mission Control is now active!");
      setTab("my-shifts");
    } catch (e) {
      console.error('Claim error:', e);
      alert("Something went wrong. Try again.");
    }
    
    setClaiming(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Verification Banner */}
      {personnel && personnel.verification_status !== "verified" && personnel.sia_verified !== true && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">🔒</span>
          <div>
            <p className="text-amber-300 font-semibold">Verification Required</p>
            <p className="text-amber-200/70 text-sm mt-1">
              Complete your verification to start accepting jobs. Go to{" "}
              <a href="/d/personnel/settings" className="underline text-amber-300">Settings</a>{" "}
              → Documents & Verification.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
        {availableShifts.length > 0 && (
          <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 font-medium">
              {availableShifts.length} shift{availableShifts.length !== 1 ? 's' : ''} available - claim now!
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("available")}
          className={`flex-1 py-3 rounded-xl font-medium transition ${
            tab === "available"
              ? "bg-emerald-500 text-black"
              : "bg-white/5 text-zinc-400"
          }`}
        >
          Available ({availableShifts.length})
        </button>
        <button
          onClick={() => setTab("my-shifts")}
          className={`flex-1 py-3 rounded-xl font-medium transition ${
            tab === "my-shifts"
              ? "bg-emerald-500 text-black"
              : "bg-white/5 text-zinc-400"
          }`}
        >
          My Shifts ({myShifts.length})
        </button>
      </div>

      {/* Available Shifts */}
      {tab === "available" && (
        <div className="space-y-4">
          {availableShifts.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-lg font-medium text-white mb-2">No shifts available</p>
              <p className="text-zinc-400">Check back soon for new opportunities</p>
            </div>
          ) : (
            availableShifts.map(shift => {
              const hours = getHours(shift.scheduled_start, shift.scheduled_end);
              const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);
              
              return (
                <motion.div
                  key={shift.id}
                  className="bg-white/5 rounded-2xl overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link href={`/d/personnel/jobs/${shift.id}`} className="block p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-white text-lg">{shift.event_name}</h3>
                        <p className="text-zinc-400">{shift.venue_name} • {shift.venue_city}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-400">£{pay}</p>
                        <p className="text-xs text-zinc-500">{hours}h @ £{shift.hourly_rate}/hr</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <span className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg">
                        📅 {formatDate(shift.scheduled_start)}
                      </span>
                      <span className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg">
                        🕐 {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
                      </span>
                      <span className="bg-white/10 text-zinc-300 text-sm px-3 py-1.5 rounded-lg">
                        {shift.role}
                      </span>
                      {shift.attire_requirement && (
                        <span className="bg-blue-500/20 border border-blue-400/40 text-blue-300 text-sm px-3 py-1.5 rounded-lg">
                          👔 {shift.attire_requirement}
                        </span>
                      )}
                    </div>
                  </Link>
                  
                  <button
                    onClick={() => claimShift(shift)}
                    disabled={claiming === shift.id}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-bold py-4 text-lg transition"
                  >
                    {claiming === shift.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Claiming...
                      </span>
                    ) : (
                      "Claim This Shift"
                    )}
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* My Shifts */}
      {tab === "my-shifts" && (
        <div className="space-y-4">
          {myShifts.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">🗓️</div>
              <p className="text-lg font-medium text-white mb-2">No upcoming shifts</p>
              <p className="text-zinc-400">Claim a shift from the Available tab</p>
            </div>
          ) : (
            myShifts.map(shift => {
              const hours = getHours(shift.scheduled_start, shift.scheduled_end);
              const pay = (shift.hourly_rate * parseFloat(hours)).toFixed(0);
              
              return (
                <motion.div
                  key={shift.id}
                  className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link href={`/d/personnel/jobs/${shift.id}`} className="block">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-emerald-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">
                      CONFIRMED
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-white text-lg">{shift.event_name}</h3>
                      <p className="text-zinc-400">{shift.venue_name} • {shift.venue_city}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-400">£{pay}</p>
                      <p className="text-xs text-zinc-500">{hours}h</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className="bg-black/30 text-white text-sm px-3 py-1.5 rounded-lg">
                      📅 {formatDate(shift.scheduled_start)}
                    </span>
                    <span className="bg-black/30 text-white text-sm px-3 py-1.5 rounded-lg">
                      🕐 {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
                    </span>
                    <span className="bg-black/30 text-zinc-300 text-sm px-3 py-1.5 rounded-lg">
                      {shift.role}
                    </span>
                    {shift.attire_requirement && (
                      <span className="bg-blue-500/20 border border-blue-400/40 text-blue-300 text-sm px-3 py-1.5 rounded-lg">
                        👔 {shift.attire_requirement}
                      </span>
                    )}
                  </div>
                  </Link>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
