"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSupabase } from "@/hooks/useSupabase";
import { 
  getBookingWithShifts, 
  confirmBooking, 
  cancelBooking, 
  completeBooking,
  updateBooking,
} from "@/lib/db/bookings";
import { CallButton } from "@/components/calling";
import { BookingGeofenceCard } from "@/components/maps/BookingGeofenceCard";
import { CheckpointManager } from "@/components/maps/CheckpointManager";
import { AgencyBookingManage, AgencyShiftActions } from "@/components/agency/AgencyBookingManage";
import { ShiftBriefSection } from "@/components/bookings/ShiftBriefSection";
import { useAgencyProfile } from "@/hooks/useAgency";
import {
  computeShiftPay,
  getShiftCompletionDisplay,
  shiftHasRecordedWork,
  workPayStatusText,
} from "@/lib/shifts/shiftPay";
import type { BookingWithShifts, Shift, GeoJsonPolygon } from "@/lib/database.types";

interface ShiftWithReportStatus extends Shift {
  incident_report_requested?: boolean;
  incident_report_submitted?: boolean;
}

interface BookingDetailProps {
  /** Booking row id (RLS scopes access to the viewer's own bookings). */
  bookingId: string;
  /** Dashboard root the page lives under, e.g. "/d/venue" or "/d/agency". */
  basePath: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-amber-400", bg: "bg-amber-500/20", label: "Pending" },
  confirmed: { color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Confirmed" },
  in_progress: { color: "text-blue-400", bg: "bg-blue-500/20", label: "In Progress" },
  completed: { color: "text-zinc-400", bg: "bg-zinc-500/20", label: "Completed" },
  cancelled: { color: "text-red-400", bg: "bg-red-500/20", label: "Cancelled" },
};

function formatTimeDisplay(time: string): string {
  const parts = time.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return time;
}

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

export function BookingDetail({ bookingId, basePath }: BookingDetailProps) {
  const supabase = useSupabase();
  const isAgency = basePath === "/d/agency";
  const { data: agency } = useAgencyProfile();
  
  const [booking, setBooking] = useState<BookingWithShifts | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [personnelDetails, setPersonnelDetails] = useState<Record<string, any>>({});
  const [requestingReport, setRequestingReport] = useState<string | null>(null);

  const fetchBooking = async () => {
    setLoading(true);
    const data = await getBookingWithShifts(supabase, bookingId);
    setBooking(data);
    
    if (data?.shifts) {
      const personnelIds = data.shifts
        .filter(s => s.personnel_id)
        .map(s => s.personnel_id);
      
      if (personnelIds.length > 0) {
        const { data: personnelData } = await supabase
          .from("personnel")
          .select("id, user_id, display_name, phone, shield_score")
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

  useEffect(() => {
    fetchBooking();
  }, [supabase, bookingId]);

  const router = useRouter();

  const handleRepeatBooking = () => {
    if (!booking) return;
    const b = booking as {
      event_name?: string;
      start_time?: string;
      end_time?: string;
      staff_requirements?: unknown;
      brief_notes?: string | null;
    };
    try {
      sessionStorage.setItem(
        "shield:rebook",
        JSON.stringify({
          eventName: b.event_name ?? "",
          startTime: b.start_time ?? "",
          endTime: b.end_time ?? "",
          staffRequirements: b.staff_requirements ?? [],
          briefNotes: b.brief_notes ?? "",
        }),
      );
    } catch {
      // sessionStorage unavailable — proceed without prefill
    }
    router.push(`${basePath}/bookings/new`);
  };

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

  const handleRequestIncidentReport = async (shiftId: string, personnelUserId: string) => {
    setRequestingReport(shiftId);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Update the shift to request incident report
      const { error } = await supabase
        .from("shifts")
        .update({
          incident_report_requested: true,
          incident_report_requested_at: new Date().toISOString(),
          incident_report_requested_by: currentUser?.id,
        })
        .eq("id", shiftId);

      if (error) throw error;

      // Find the Mission Control chat for this booking
      const { data: missionControlChat } = await supabase
        .from("group_chats")
        .select("id")
        .eq("booking_id", booking?.id)
        .eq("chat_type", "mission_control")
        .single();

      if (missionControlChat) {
        // Send a message in Mission Control requesting the incident report
        await supabase.from("group_chat_messages").insert({
          group_chat_id: missionControlChat.id,
          sender_id: currentUser?.id,
          content: `📋 **Incident Report Requested**\n\nPlease submit a post-shift incident report for this shift. Tap here to fill out the report.`,
          message_type: "system",
          metadata: { 
            type: "incident_report_request",
            shift_id: shiftId,
            venue_id: booking?.venue_id,
            action: "request_incident_report"
          },
        });

        // Update the chat's updated_at
        await supabase
          .from("group_chats")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", missionControlChat.id);
      }

      // Update local state
      setBooking(prev => {
        if (!prev) return null;
        return {
          ...prev,
          shifts: prev.shifts?.map(s => 
            s.id === shiftId ? { ...s, incident_report_requested: true } : s
          ),
        };
      });

      // Show success message
      alert("Incident report request sent to Mission Control! The guard will see it in their messages.");
    } catch (error) {
      console.error("Error requesting incident report:", error);
      alert("Failed to request incident report. Please try again.");
    } finally {
      setRequestingReport(null);
    }
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
        <Link href={`${basePath}/bookings`} className="text-shield-400 hover:text-shield-300">
          Back to Bookings
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const agencyOwnsBooking = Boolean(isAgency && agency?.id && booking.agency_id === agency.id);
  // Agency roster jobs settle through the agency's own payroll, not escrow.
  const selfManaged = Boolean(
    (booking as { self_managed?: boolean | null }).self_managed,
  );
  const canEditGeofence = !isAgency || agencyOwnsBooking;
  const canEditBrief =
    !isAgency && ["pending", "confirmed"].includes(booking.status);
  const totalStaff = booking.shifts?.length || 0;
  const acceptedStaff = booking.shifts?.filter(s => 
    ["accepted", "checked_in", "checked_out"].includes(s.status) ||
    shiftHasRecordedWork(s)
  ).length || 0;
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
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            href={`${basePath}/bookings`}
            className="text-zinc-500 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{booking.event_name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              {new Date(booking.event_date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              {" • "}
              {formatTimeDisplay(booking.start_time)} – {formatTimeDisplay(booking.end_time)}
            </p>
          </div>
        </div>

        {/* Compact Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRepeatBooking}
            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.1]"
            title="Create a new booking pre-filled from this one"
          >
            ↻ Repeat booking
          </button>
          {booking.status === "pending" && !isAgency && (
            <>
              <motion.button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                whileTap={{ scale: 0.98 }}
              >
                {actionLoading === "confirm" ? "..." : "Confirm"}
              </motion.button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isAgency && booking && (
        <AgencyBookingManage booking={booking} onRefresh={fetchBooking} />
      )}

      {!isAgency && (
        <ShiftBriefSection
          bookingId={booking.id}
          briefNotes={booking.brief_notes}
          editable={canEditBrief}
          onSave={async (briefNotes) => {
            const updated = await updateBooking(supabase, booking.id, { brief_notes: briefNotes });
            if (updated) {
              setBooking((prev) => (prev ? { ...prev, brief_notes: briefNotes } : null));
              return true;
            }
            return false;
          }}
        />
      )}

      {/* Compact Stats Row */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Staff:</span>
          <span className="text-white font-medium">{acceptedStaff}/{totalStaff}</span>
        </div>
        <div className="w-px h-4 bg-zinc-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Hours:</span>
          <span className="text-white font-medium">
            {booking.shifts?.reduce((acc, s) => {
              const start = new Date(s.scheduled_start);
              const end = new Date(s.scheduled_end);
              return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }, 0).toFixed(1) || 0}h
          </span>
        </div>
        <div className="w-px h-4 bg-zinc-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Cost:</span>
          <span className="text-shield-400 font-medium">£{totalCost.toFixed(0)}</span>
        </div>
      </div>

      {/* On-site geofence boundary + patrol checkpoints */}
      <div className="mb-4 space-y-4">
        <BookingGeofenceCard
          bookingId={booking.id}
          siteLat={
            (booking as { site_latitude?: number | null }).site_latitude ?? null
          }
          siteLng={
            (booking as { site_longitude?: number | null }).site_longitude ?? null
          }
          initialPolygon={
            (booking as { site_geofence_polygon?: GeoJsonPolygon | null })
              .site_geofence_polygon ?? null
          }
          editable={canEditGeofence}
        />
        <CheckpointManager
          bookingId={booking.id}
          siteLat={
            (booking as { site_latitude?: number | null }).site_latitude ?? null
          }
          siteLng={
            (booking as { site_longitude?: number | null }).site_longitude ?? null
          }
          polygon={
            (booking as { site_geofence_polygon?: GeoJsonPolygon | null })
              .site_geofence_polygon ?? null
          }
        />
      </div>

      {/* Assigned Staff - Main Focus */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-base font-semibold text-white mb-3">Assigned Staff</h2>

        {booking.shifts && booking.shifts.length > 0 ? (
          <div className="space-y-2">
            {booking.shifts.map((shift) => {
              const personnel = shift.personnel_id ? personnelDetails[shift.personnel_id] : null;
              const worked = shiftHasRecordedWork(shift);
              const completion = worked ? getShiftCompletionDisplay(shift) : null;
              const earnings = worked ? computeShiftPay(shift) : null;
              const shiftStatus = worked && completion
                ? {
                    color:
                      completion.tone === "warning"
                        ? "text-amber-400"
                        : completion.tone === "success"
                          ? "text-emerald-400"
                          : "text-purple-400",
                    bg:
                      completion.tone === "warning"
                        ? "bg-amber-500/20"
                        : completion.tone === "success"
                          ? "bg-emerald-500/20"
                          : "bg-purple-500/20",
                    label: completion.label,
                  }
                : SHIFT_STATUS_CONFIG[shift.status] || SHIFT_STATUS_CONFIG.pending;
              const scheduledHours =
                (new Date(shift.scheduled_end).getTime() -
                  new Date(shift.scheduled_start).getTime()) /
                (1000 * 60 * 60);
              const isCompleted = worked;
              
              // Get personnel user_id - either from fetched details or directly from shift if available
              const personnelUserId = personnel?.user_id || (shift as any).personnel_user_id;
              const personnelName = personnel?.display_name || (shift as any).personnel_name || "Unassigned";

              return (
                <motion.div
                  key={shift.id}
                  className={`rounded-lg p-3 border ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-shield-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-shield-400 font-bold">
                          {personnelName[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {personnelName}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {shift.role?.replace(/_/g, " ")}
                          {worked && earnings
                            ? ` • ${earnings.hours.toFixed(1)}h worked · £${earnings.pay.toFixed(2)}`
                            : ` • £${(scheduledHours * (shift.hourly_rate || 0)).toFixed(0)} scheduled`}
                        </p>
                        {worked && shift.actual_start && shift.actual_end ? (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Actual{" "}
                            {new Date(shift.actual_start).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" – "}
                            {new Date(shift.actual_end).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {workPayStatusText({ ...shift, self_managed: selfManaged })
                              ? ` · ${workPayStatusText({ ...shift, self_managed: selfManaged })}`
                              : ""}
                          </p>
                        ) : null}
                        {completion?.detail && completion.tone === "warning" ? (
                          <p className="text-xs text-amber-400/90 mt-0.5">{completion.detail}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {personnelUserId && (
                        <CallButton
                          userId={personnelUserId}
                          name={personnelName}
                          role="personnel"
                          variant="icon"
                          bookingId={booking.id}
                          shiftId={shift.id}
                        />
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${shiftStatus.bg} ${shiftStatus.color}`}>
                        {shiftStatus.label}
                      </span>
                    </div>
                  </div>

                  {/* Agency shift management */}
                  {isAgency && booking && (
                    <AgencyShiftActions
                      shift={shift}
                      booking={booking}
                      onRefresh={fetchBooking}
                    />
                  )}

                  {/* Incident Report Request - Show for completed shifts */}
                  {isCompleted && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      {(shift as ShiftWithReportStatus).incident_report_submitted ? (
                        <div className="flex items-center gap-2 text-emerald-400 text-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Report Submitted</span>
                        </div>
                      ) : (shift as ShiftWithReportStatus).incident_report_requested ? (
                        <div className="flex items-center gap-2 text-amber-400 text-sm">
                          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Awaiting Report</span>
                        </div>
                      ) : personnelUserId ? (
                        <motion.button
                          onClick={() => handleRequestIncidentReport(shift.id, personnelUserId)}
                          disabled={requestingReport === shift.id}
                          className="w-full flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                          whileTap={{ scale: 0.98 }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {requestingReport === shift.id ? "Sending..." : "Request Incident Report"}
                        </motion.button>
                      ) : (
                        <p className="text-xs text-zinc-500 text-center">No personnel assigned to request report from</p>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-4 text-sm">No staff assigned yet</p>
        )}
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
