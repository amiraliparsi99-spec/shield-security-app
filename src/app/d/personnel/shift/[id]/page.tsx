"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSupabase } from "@/hooks/useSupabase";
import { usePersonnelProfile } from "@/hooks";
import { CallButton } from "@/components/calling";

type ShiftWithDetails = {
  id: string;
  booking_id: string;
  personnel_id: string;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  hours_worked: number | null;
  total_pay: number | null;
  booking: {
    id: string;
    event_name: string;
    event_date: string;
    brief_notes: string | null;
    venue: {
      id: string;
      user_id: string;
      name: string;
      city: string;
      address_line1: string | null;
      postcode: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  };
};

export default function ShiftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useSupabase();
  const { data: personnel } = usePersonnelProfile();
  
  const [shift, setShift] = useState<ShiftWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("0:00:00");

  // Fetch shift details
  useEffect(() => {
    const fetchShift = async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          booking:bookings (
            id,
            event_name,
            event_date,
            brief_notes,
            venue:venues (
              id,
              user_id,
              name,
              city,
              address_line1,
              postcode,
              latitude,
              longitude
            )
          )
        `)
        .eq('id', params.id)
        .single();

      if (!error && data) {
        setShift(data as ShiftWithDetails);
      }
      setLoading(false);
    };

    if (params.id) {
      fetchShift();
    }
  }, [supabase, params.id]);

  // Update elapsed time for checked-in shifts
  useEffect(() => {
    if (shift?.status !== 'checked_in' || !shift.actual_start) return;

    const updateElapsed = () => {
      const start = new Date(shift.actual_start!);
      const now = new Date();
      const diff = now.getTime() - start.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsedTime(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [shift]);

  // Get current location
  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!shift) return;
    
    setActionLoading(true);
    setLocationError(null);

    try {
      const loc = await getCurrentLocation();
      setLocation(loc);

      const { error } = await supabase
        .from('shifts')
        .update({
          status: 'checked_in',
          actual_start: new Date().toISOString(),
          check_in_latitude: loc.lat,
          check_in_longitude: loc.lng,
        })
        .eq('id', shift.id);

      if (error) {
        console.error("Check-in error:", error);
        alert("Failed to check in. Please try again.");
        return;
      }

      // Refresh shift data
      setShift(prev => prev ? {
        ...prev,
        status: 'checked_in',
        actual_start: new Date().toISOString(),
        check_in_latitude: loc.lat,
        check_in_longitude: loc.lng,
      } : null);

    } catch (e: any) {
      console.error("Location error:", e);
      setLocationError("Could not get your location. Please enable location services and try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!shift || !shift.actual_start) return;

    setActionLoading(true);
    setLocationError(null);

    try {
      const loc = await getCurrentLocation();
      
      const actualEnd = new Date();
      const actualStart = new Date(shift.actual_start);
      const hoursWorked = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
      const totalPay = hoursWorked * shift.hourly_rate;

      const { error } = await supabase
        .from('shifts')
        .update({
          status: 'checked_out',
          actual_end: actualEnd.toISOString(),
          check_out_latitude: loc.lat,
          check_out_longitude: loc.lng,
          hours_worked: Math.round(hoursWorked * 100) / 100,
          total_pay: Math.round(totalPay * 100) / 100,
        })
        .eq('id', shift.id);

      if (error) {
        console.error("Check-out error:", error);
        alert("Failed to check out. Please try again.");
        return;
      }

      // Update local state
      setShift(prev => prev ? {
        ...prev,
        status: 'checked_out',
        actual_end: actualEnd.toISOString(),
        hours_worked: Math.round(hoursWorked * 100) / 100,
        total_pay: Math.round(totalPay * 100) / 100,
      } : null);

      // Update personnel stats
      if (personnel) {
        await supabase
          .from('personnel')
          .update({
            total_shifts: (personnel.total_shifts || 0) + 1,
            total_hours: (personnel.total_hours || 0) + hoursWorked,
          })
          .eq('id', personnel.id);
      }

    } catch (e: any) {
      console.error("Location error:", e);
      setLocationError("Could not get your location. Please enable location services and try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500"></div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Shift not found</p>
        <Link href="/d/personnel/jobs" className="text-shield-400 hover:text-shield-300 mt-2 inline-block">
          ← Back to Jobs
        </Link>
      </div>
    );
  }

  const isToday = new Date(shift.scheduled_start).toDateString() === new Date().toDateString();
  const canCheckIn = shift.status === 'accepted' && isToday;
  const canCheckOut = shift.status === 'checked_in';
  const isCompleted = shift.status === 'checked_out';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <Link href="/d/personnel/jobs" className="text-zinc-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </Link>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 mb-6 ${
        isCompleted ? 'bg-emerald-500/20 border border-emerald-500/30' :
        shift.status === 'checked_in' ? 'bg-blue-500/20 border border-blue-500/30' :
        'bg-amber-500/20 border border-amber-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {isCompleted ? '✅' : shift.status === 'checked_in' ? '🔵' : '⏳'}
            </span>
            <div>
              <p className={`font-semibold ${
                isCompleted ? 'text-emerald-400' :
                shift.status === 'checked_in' ? 'text-blue-400' :
                'text-amber-400'
              }`}>
                {isCompleted ? 'Shift Completed' :
                 shift.status === 'checked_in' ? 'Currently Working' :
                 'Shift Confirmed'}
              </p>
              {shift.status === 'checked_in' && (
                <p className="text-2xl font-mono text-white">{elapsedTime}</p>
              )}
            </div>
          </div>
          {isCompleted && shift.total_pay && (
            <div className="text-right">
              <p className="text-sm text-emerald-400">Earned</p>
              <p className="text-2xl font-bold text-white">£{shift.total_pay.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Shift Details */}
      <div className="glass rounded-xl p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{shift.booking?.event_name}</h1>
          <p className="text-zinc-400">{shift.role}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-zinc-400">Venue</p>
                <p className="text-white font-medium">{shift.booking?.venue?.name}</p>
                <p className="text-sm text-zinc-500">
                  {shift.booking?.venue?.address_line1}
                  {shift.booking?.venue?.postcode && `, ${shift.booking.venue.postcode}`}
                </p>
              </div>
              {shift.booking?.venue?.user_id && (
                <CallButton
                  userId={shift.booking.venue.user_id}
                  name={shift.booking.venue.name}
                  role="venue"
                  variant="icon"
                  bookingId={shift.booking.id}
                  shiftId={shift.id}
                />
              )}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-zinc-400">Pay Rate</p>
            <p className="text-2xl font-bold text-emerald-400">£{shift.hourly_rate}/hr</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-zinc-400">Date</p>
            <p className="text-white">{formatDate(shift.scheduled_start)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-zinc-400">Scheduled Time</p>
            <p className="text-white">
              {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
            </p>
          </div>
        </div>

        {shift.booking?.brief_notes && (
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-zinc-400 mb-1">Notes from Venue</p>
            <p className="text-white">{shift.booking.brief_notes}</p>
          </div>
        )}

        {/* Actual Times (if checked in/out) */}
        {shift.actual_start && (
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-zinc-400 mb-2">Actual Times</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Check In</p>
                <p className="text-white">{formatTime(shift.actual_start)}</p>
              </div>
              {shift.actual_end && (
                <div>
                  <p className="text-xs text-zinc-500">Check Out</p>
                  <p className="text-white">{formatTime(shift.actual_end)}</p>
                </div>
              )}
            </div>
            {shift.hours_worked && (
              <p className="text-sm text-zinc-400 mt-2">
                Total: {shift.hours_worked.toFixed(2)} hours worked
              </p>
            )}
          </div>
        )}

        {/* Location Error */}
        {locationError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            {locationError}
          </div>
        )}

        {/* Action Buttons */}
        {canCheckIn && (
          <motion.button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white py-4 rounded-xl font-bold text-lg transition"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {actionLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Getting Location...
              </span>
            ) : (
              "📍 Check In"
            )}
          </motion.button>
        )}

        {canCheckOut && (
          <motion.button
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white py-4 rounded-xl font-bold text-lg transition"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {actionLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </span>
            ) : (
              "🏁 Check Out & End Shift"
            )}
          </motion.button>
        )}

        {!isToday && shift.status === 'accepted' && (
          <div className="bg-zinc-500/10 rounded-lg p-4 text-center">
            <p className="text-zinc-400">
              Check-in available on {formatDate(shift.scheduled_start)}
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="text-center pt-4">
            <p className="text-zinc-400 mb-2">Shift completed successfully!</p>
            <Link 
              href="/d/personnel/earnings"
              className="text-shield-400 hover:text-shield-300 transition"
            >
              View Earnings →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
