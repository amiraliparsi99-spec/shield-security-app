"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface ShiftCheckin {
  id: string;
  booking_id: string;
  check_in_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_address: string | null;
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_address: string | null;
  total_hours: number | null;
  status: string;
  booking?: {
    id: string;
    event_name: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    venue?: { name: string; address_line1: string };
    agency?: { name: string };
  };
}

interface Props {
  personnelId: string;
}

export function ShiftTracker({ personnelId }: Props) {
  const [activeShift, setActiveShift] = useState<ShiftCheckin | null>(null);
  const [todaysShifts, setTodaysShifts] = useState<ShiftCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadShifts();
  }, [personnelId]);

  const loadShifts = async () => {
    const today = new Date().toISOString().split("T")[0];

    // Get today's bookings for this personnel
    const { data: bookings } = await supabase
      .from("bookings")
      .select(`
        id, event_name, shift_date, start_time, end_time,
        venue:venues(name, address_line1),
        agency:agencies(name)
      `)
      .eq("shift_date", today)
      .contains("assigned_personnel", [personnelId]);

    // Get checkins for today
    const { data: checkins } = await supabase
      .from("shift_checkins")
      .select("*")
      .eq("personnel_id", personnelId)
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    // Map bookings to checkins
    const shifts: ShiftCheckin[] = (bookings || []).map((booking: any) => {
      const checkin = checkins?.find((c) => c.booking_id === booking.id);
      return {
        id: checkin?.id || "",
        booking_id: booking.id,
        check_in_time: checkin?.check_in_time || null,
        check_in_lat: checkin?.check_in_lat || null,
        check_in_lng: checkin?.check_in_lng || null,
        check_in_address: checkin?.check_in_address || null,
        check_out_time: checkin?.check_out_time || null,
        check_out_lat: checkin?.check_out_lat || null,
        check_out_lng: checkin?.check_out_lng || null,
        check_out_address: checkin?.check_out_address || null,
        total_hours: checkin?.total_hours || null,
        status: checkin?.status || "pending",
        booking,
      };
    });

    setTodaysShifts(shifts);
    setActiveShift(shifts.find((s) => s.status === "checked_in") || null);
    setLoading(false);
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
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
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const getAddressFromCoords = async (
    lat: number,
    lng: number
  ): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const handleCheckIn = async (shift: ShiftCheckin) => {
    setCheckingIn(true);
    setLocationError(null);

    try {
      const location = await getCurrentLocation();
      const address = await getAddressFromCoords(location.lat, location.lng);

      const { data, error } = await supabase
        .from("shift_checkins")
        .insert({
          booking_id: shift.booking_id,
          personnel_id: personnelId,
          check_in_time: new Date().toISOString(),
          check_in_lat: location.lat,
          check_in_lng: location.lng,
          check_in_address: address,
          status: "checked_in",
        })
        .select()
        .single();

      if (error) throw error;

      await loadShifts();
    } catch (error: any) {
      setLocationError(error.message || "Failed to get location");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeShift) return;

    setCheckingIn(true);
    setLocationError(null);

    try {
      const location = await getCurrentLocation();
      const address = await getAddressFromCoords(location.lat, location.lng);

      const { error } = await supabase
        .from("shift_checkins")
        .update({
          check_out_time: new Date().toISOString(),
          check_out_lat: location.lat,
          check_out_lng: location.lng,
          check_out_address: address,
          status: "checked_out",
        })
        .eq("id", activeShift.id);

      if (error) throw error;

      await loadShifts();
    } catch (error: any) {
      setLocationError(error.message || "Failed to get location");
    } finally {
      setCheckingIn(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-dark-600 rounded w-1/3"></div>
          <div className="h-20 bg-dark-600 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Shift Banner */}
      {activeShift && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-400 font-medium">
                  Currently On Shift
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                {activeShift.booking?.event_name}
              </h3>
              <p className="text-dark-300 mt-1">
                {activeShift.booking?.venue?.name ||
                  activeShift.booking?.agency?.name}
              </p>
              <p className="text-sm text-dark-400 mt-2">
                Checked in at {formatDateTime(activeShift.check_in_time!)}
              </p>
            </div>
            <button
              onClick={handleCheckOut}
              disabled={checkingIn}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white rounded-lg font-medium transition-colors"
            >
              {checkingIn ? "Processing..." : "Check Out"}
            </button>
          </div>
        </div>
      )}

      {/* Today's Shifts */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Today's Shifts
        </h3>

        {locationError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {locationError}
          </div>
        )}

        {todaysShifts.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-3 block">📅</span>
            <p className="text-dark-300">No shifts scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todaysShifts.map((shift) => (
              <div
                key={shift.booking_id}
                className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">
                      {shift.booking?.event_name}
                    </h4>
                    <p className="text-sm text-dark-400">
                      {shift.booking?.venue?.name ||
                        shift.booking?.agency?.name}
                    </p>
                    <p className="text-sm text-dark-300 mt-1">
                      {formatTime(shift.booking?.start_time || "")} -{" "}
                      {formatTime(shift.booking?.end_time || "")}
                    </p>
                  </div>

                  <div className="text-right">
                    {shift.status === "pending" && (
                      <button
                        onClick={() => handleCheckIn(shift)}
                        disabled={checkingIn || !!activeShift}
                        className="px-4 py-2 bg-accent hover:bg-accent-dark disabled:bg-accent/50 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {checkingIn ? "..." : "Check In"}
                      </button>
                    )}
                    {shift.status === "checked_in" && (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                        Active
                      </span>
                    )}
                    {shift.status === "checked_out" && (
                      <div>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                          Completed
                        </span>
                        {shift.total_hours && (
                          <p className="text-sm text-dark-400 mt-1">
                            {shift.total_hours.toFixed(1)} hours
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Check-in/out details */}
                {(shift.check_in_time || shift.check_out_time) && (
                  <div className="mt-3 pt-3 border-t border-dark-600 grid grid-cols-2 gap-4 text-sm">
                    {shift.check_in_time && (
                      <div>
                        <span className="text-dark-400">Check In:</span>
                        <p className="text-white">
                          {formatDateTime(shift.check_in_time)}
                        </p>
                        <p className="text-xs text-dark-500 truncate">
                          {shift.check_in_address}
                        </p>
                      </div>
                    )}
                    {shift.check_out_time && (
                      <div>
                        <span className="text-dark-400">Check Out:</span>
                        <p className="text-white">
                          {formatDateTime(shift.check_out_time)}
                        </p>
                        <p className="text-xs text-dark-500 truncate">
                          {shift.check_out_address}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
