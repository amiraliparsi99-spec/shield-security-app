"use client";

import { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSupabase } from "@/hooks/useSupabase";
import { useVenueProfile } from "@/hooks/useVenue";
import { 
  getBookingWithShifts, 
  confirmBooking, 
  cancelBooking, 
  completeBooking 
} from "@/lib/db/bookings";
import { CallButton } from "@/components/calling";
import type { BookingWithShifts, Shift } from "@/lib/database.types";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-amber-400", bg: "bg-amber-500/20", label: "Pending" },
  confirmed: { color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Confirmed" },
  in_progress: { color: "text-blue-400", bg: "bg-blue-500/20", label: "In Progress" },
  completed: { color: "text-zinc-400", bg: "bg-zinc-500/20", label: "Completed" },
  cancelled: { color: "text-red-400", bg: "bg-red-500/20", label: "Cancelled" },
};

const SHIFT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-zinc-400", bg: "bg-zinc-500/20", label: "Pending" },
  offered: { color: "text-amber-400", bg: "bg-amber-500/20", label: "Offered" },
  accepted: { color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Accepted" },
  declined: { color: "text-red-400", bg: "bg-red-500/20", label: "Declined" },
  checked_in: { color: "text-blue-400", bg: "bg-blue-500/20", label: "Checked In" },
  checked_out: { color: "text-purple-400", bg: "bg-purple-500/20", label: "Completed" },
  cancelled: { color: "text-red-400", bg: "bg-red-500/20", label: "Cancelled" },
  no_show: { color: "text-red-400", bg: "bg-red-500/20", label: "No Show" },
};

export default function BookingDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const supabase = useSupabase();
  const { data: venue } = useVenueProfile();
  
  const [booking, setBooking] = useState<BookingWithShifts | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [personnelDetails, setPersonnelDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true);
      const data = await getBookingWithShifts(supabase, resolvedParams.id);
      setBooking(data);
      
      // Fetch personnel details for each shift
      if (data?.shifts) {
        const personnelIds = data.shifts
          .filter(s => s.personnel_id)
          .map(s => s.personnel_id);
        
        if (personnelIds.length > 0) {
          const { data: personnelData } = await supabase
            .from("personnel")
            .select("id, user_id, full_name, phone, shield_score, profile_image_url")
            .in("id", personnelIds);
          
          if (personnelData) {
            const details: Record<string, any> = {};
            personnelData.forEach(p => {
              details[p.id] = p;
            });
            setPersonnelDetails(details);
          }
        }
      }
      
      setLoading(false);
    };

    fetchBooking();
  }, [supabase, resolvedParams.id]);

  const handleConfirm = async () => {
    if (!booking) return;
    setActionLoading("confirm");
    const updated = await confirmBooking(supabase, booking.id);
    if (updated) {
      setBooking(prev => prev ? { ...prev, ...updated } : null);
    }
    setActionLoading(null);
  };

  const handleCancel = async () => {
    if (!booking) return;
    setActionLoading("cancel");
    const updated = await cancelBooking(supabase, booking.id, cancelReason);
    if (updated) {
      setBooking(prev => prev ? { ...prev, ...updated } : null);
    }
    setActionLoading(null);
    setShowCancelModal(false);
    setCancelReason("");
  };

  const handleComplete = async () => {
    if (!booking) return;
    setActionLoading("complete");
    const updated = await completeBooking(supabase, booking.id);
    if (updated) {
      setBooking(prev => prev ? { ...prev, ...updated } : null);
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shield-500"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-white mb-4">Booking Not Found</h2>
        <p className="text-zinc-400 mb-6">This booking does not exist or you don't have access to it.</p>
        <Link href="/d/venue/bookings" className="text-shield-400 hover:text-shield-300">
          Back to Bookings
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const totalStaff = booking.shifts?.length || 0;
  const acceptedStaff = booking.shifts?.filter(s => ["accepted", "checked_in", "checked_out"].includes(s.status)).length || 0;
  const totalCost = booking.shifts?.reduce((acc, s) => {
    if (s.total_pay) return acc + s.total_pay;
    if (s.hourly_rate) {
      const start = new Date(s.scheduled_start);
      const end = new Date(s.scheduled_end);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return acc + (hours * s.hourly_rate);
    }
    return acc;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/d/venue/bookings"
              className="text-zinc-500 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-white">{booking.event_name}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-zinc-400">
            {new Date(booking.event_date).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" • "}
            {booking.start_time} - {booking.end_time}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {booking.status === "pending" && (
            <>
              <motion.button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-4 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {actionLoading === "confirm" ? "Confirming..." : "Confirm Booking"}
              </motion.button>
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading !== null}
                className="border border-red-500/50 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl font-medium transition"
              >
                Cancel
              </button>
            </>
          )}
          {booking.status === "confirmed" && (
            <>
              <motion.button
                onClick={handleComplete}
                disabled={actionLoading !== null}
                className="bg-shield-500 hover:bg-shield-600 disabled:bg-shield-500/50 text-white px-4 py-2 rounded-xl font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {actionLoading === "complete" ? "Completing..." : "Mark Complete"}
              </motion.button>
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading !== null}
                className="border border-red-500/50 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl font-medium transition"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{totalStaff}</div>
          <div className="text-sm text-zinc-400">Total Staff</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{acceptedStaff}</div>
          <div className="text-sm text-zinc-400">Confirmed</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-white">
            {booking.shifts?.reduce((acc, s) => {
              const start = new Date(s.scheduled_start);
              const end = new Date(s.scheduled_end);
              return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }, 0).toFixed(1) || 0}h
          </div>
          <div className="text-sm text-zinc-400">Total Hours</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-2xl font-bold text-shield-400">£{totalCost.toFixed(2)}</div>
          <div className="text-sm text-zinc-400">Estimated Cost</div>
        </div>
      </div>

      {/* Event Details */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Event Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500">Event Type</label>
              <p className="text-white capitalize">{booking.event_type || "General Event"}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Location</label>
              <p className="text-white">{booking.location || venue?.address || "Main Venue"}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Expected Attendance</label>
              <p className="text-white">{booking.expected_attendance || "Not specified"}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500">Special Requirements</label>
              <p className="text-white">{booking.special_requirements || "None specified"}</p>
            </div>
            {booking.notes && (
              <div>
                <label className="text-xs text-zinc-500">Notes</label>
                <p className="text-white">{booking.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff Requirements */}
      {booking.staff_requirements && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Staff Requirements</h2>
          <div className="space-y-3">
            {(booking.staff_requirements as any[]).map((req, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-shield-500/20 flex items-center justify-center">
                    <span className="text-shield-400 font-bold">{req.quantity}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium capitalize">{req.role.replace(/_/g, " ")}</p>
                    <p className="text-sm text-zinc-400">£{req.hourly_rate}/hour</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">
                    {booking.shifts?.filter(s => s.role === req.role && ["accepted", "checked_in", "checked_out"].includes(s.status)).length || 0}
                    /{req.quantity} filled
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Staff */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Assigned Staff</h2>
          {booking.status !== "cancelled" && booking.status !== "completed" && (
            <Link
              href={`/d/venue/bookings/new?edit=${booking.id}`}
              className="text-sm text-shield-400 hover:text-shield-300 transition"
            >
              + Add Staff
            </Link>
          )}
        </div>

        {booking.shifts && booking.shifts.length > 0 ? (
          <div className="space-y-3">
            {booking.shifts.map((shift) => {
              const personnel = shift.personnel_id ? personnelDetails[shift.personnel_id] : null;
              const shiftStatus = SHIFT_STATUS_CONFIG[shift.status] || SHIFT_STATUS_CONFIG.pending;
              const hours = (new Date(shift.scheduled_end).getTime() - new Date(shift.scheduled_start).getTime()) / (1000 * 60 * 60);

              return (
                <motion.div
                  key={shift.id}
                  className="bg-white/5 rounded-xl p-4 border border-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {personnel?.profile_image_url ? (
                        <img
                          src={personnel.profile_image_url}
                          alt={personnel.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-shield-500/20 flex items-center justify-center">
                          <span className="text-shield-400 font-bold text-lg">
                            {personnel?.full_name?.[0] || "?"}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-white font-medium">
                          {personnel?.full_name || "Unassigned"}
                        </p>
                        <p className="text-sm text-zinc-400 capitalize">
                          {shift.role?.replace(/_/g, " ") || "Security"}
                        </p>
                        {personnel?.shield_score && (
                          <p className="text-xs text-shield-400">
                            Shield Score: {personnel.shield_score}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Call button */}
                      {personnel?.user_id && (
                        <CallButton
                          userId={personnel.user_id}
                          name={personnel.full_name || "Security"}
                          role="personnel"
                          variant="icon"
                          bookingId={booking.id}
                          shiftId={shift.id}
                        />
                      )}
                      
                      <div className="text-right space-y-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${shiftStatus.bg} ${shiftStatus.color}`}>
                          {shiftStatus.label}
                        </span>
                        <p className="text-sm text-zinc-400">
                          {new Date(shift.scheduled_start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {" - "}
                          {new Date(shift.scheduled_end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-sm text-white">
                          {hours.toFixed(1)}h @ £{shift.hourly_rate}/h = £{(hours * (shift.hourly_rate || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Check-in/out info */}
                  {(shift.actual_start || shift.actual_end) && (
                    <div className="mt-3 pt-3 border-t border-white/5 text-sm">
                      <div className="flex items-center gap-6 text-zinc-400">
                        {shift.actual_start && (
                          <span>
                            Checked in: {new Date(shift.actual_start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {shift.actual_end && (
                          <span>
                            Checked out: {new Date(shift.actual_end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {shift.hours_worked && (
                          <span className="text-emerald-400">
                            Hours worked: {shift.hours_worked.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-8">No staff assigned yet</p>
        )}
      </div>

      {/* Timeline */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Timeline</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <div className="flex-1">
              <p className="text-white">Booking created</p>
              <p className="text-sm text-zinc-400">
                {new Date(booking.created_at).toLocaleString("en-GB")}
              </p>
            </div>
          </div>
          {booking.confirmed_at && (
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <p className="text-white">Booking confirmed</p>
                <p className="text-sm text-zinc-400">
                  {new Date(booking.confirmed_at).toLocaleString("en-GB")}
                </p>
              </div>
            </div>
          )}
          {booking.completed_at && (
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <div className="flex-1">
                <p className="text-white">Event completed</p>
                <p className="text-sm text-zinc-400">
                  {new Date(booking.completed_at).toLocaleString("en-GB")}
                </p>
              </div>
            </div>
          )}
          {booking.cancelled_at && (
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <div className="flex-1">
                <p className="text-white">Booking cancelled</p>
                <p className="text-sm text-zinc-400">
                  {new Date(booking.cancelled_at).toLocaleString("en-GB")}
                  {booking.cancellation_reason && ` - ${booking.cancellation_reason}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Cancel Booking</h3>
              <p className="text-zinc-400 mb-4">
                Are you sure you want to cancel this booking? This action cannot be undone and will notify all assigned staff.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm text-zinc-500 mb-2">Reason (optional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none transition resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading === "cancel"}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white px-4 py-2 rounded-xl transition"
                >
                  {actionLoading === "cancel" ? "Cancelling..." : "Cancel Booking"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
