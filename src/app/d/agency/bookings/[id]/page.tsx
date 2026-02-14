"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AssignmentPanel, BookingStatusBadge } from "@/components/agency";
import type { Booking, AgencyStaffWithPersonnel, BookingAssignmentStatus } from "@/types/database";

interface BookingDetail extends Booking {
  venue?: {
    name: string;
    address?: string;
    city?: string;
  };
  request?: {
    certs_required: string[];
    description?: string;
  };
}

interface AssignmentWithStaff {
  id: string;
  status: BookingAssignmentStatus;
  staff: AgencyStaffWithPersonnel;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [assignedStaff, setAssignedStaff] = useState<AssignmentWithStaff[]>([]);
  const [availableStaff, setAvailableStaff] = useState<AgencyStaffWithPersonnel[]>([]);
  const [suggestedStaff, setSuggestedStaff] = useState<AgencyStaffWithPersonnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    loadBookingDetail();
  }, [params.id]);

  const loadBookingDetail = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const bookingId = params.id as string;

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

      if (!agency) {
        router.push("/d/agency/bookings");
        return;
      }

      setAgencyId(agency.id);

      // Get booking with venue and request details
      const { data: bookingData } = await supabase
        .from("bookings")
        .select(`
          *,
          venue:venues(name, address, city),
          request:requests(certs_required, description)
        `)
        .eq("id", bookingId)
        .eq("provider_type", "agency")
        .eq("provider_id", agency.id)
        .single();

      if (!bookingData) {
        router.push("/d/agency/bookings");
        return;
      }

      setBooking(bookingData);

      // Get assigned staff
      const { data: assignments } = await supabase
        .from("booking_assignments")
        .select(`
          id,
          status,
          agency_staff:agency_staff(
            *,
            personnel:personnel(*)
          )
        `)
        .eq("booking_id", bookingId);

      const formattedAssignments: AssignmentWithStaff[] = (assignments || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        staff: a.agency_staff,
      }));

      setAssignedStaff(formattedAssignments);

      // Get available staff (not already assigned)
      const assignedIds = formattedAssignments.map((a) => a.staff.id);
      
      const { data: allStaff } = await supabase
        .from("agency_staff")
        .select(`
          *,
          personnel:personnel(*)
        `)
        .eq("agency_id", agency.id)
        .eq("status", "active");

      const available = (allStaff || []).filter(
        (s: any) => !assignedIds.includes(s.id)
      );

      setAvailableStaff(available);

      // Generate suggestions (simple algorithm for now)
      // TODO: Use proper smart assignment algorithm
      const certsRequired = bookingData.request?.certs_required || [];
      const suggestions = available
        .filter((s: any) => {
          // Prefer staff with required certifications
          if (certsRequired.length === 0) return true;
          return certsRequired.some((cert: string) => 
            s.personnel.certs?.includes(cert)
          );
        })
        .slice(0, 5);

      setSuggestedStaff(suggestions);
    } catch (error) {
      console.error("Error loading booking:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = useCallback(async (staffIds: string[]) => {
    if (!booking || !agencyId) return;

    try {
      const supabase = createClient();

      const assignments = staffIds.map((agencyStaffId) => ({
        booking_id: booking.id,
        agency_staff_id: agencyStaffId,
        status: "assigned" as const,
      }));

      const { error } = await supabase
        .from("booking_assignments")
        .insert(assignments);

      if (error) throw error;

      await loadBookingDetail();
    } catch (error) {
      console.error("Error assigning staff:", error);
    }
  }, [booking, agencyId]);

  const handleUnassign = useCallback(async (assignmentId: string) => {
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("booking_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      await loadBookingDetail();
    } catch (error) {
      console.error("Error unassigning staff:", error);
    }
  }, []);

  const handleUpdateStatus = useCallback(async (assignmentId: string, status: BookingAssignmentStatus) => {
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("booking_assignments")
        .update({ status })
        .eq("id", assignmentId);

      if (error) throw error;

      await loadBookingDetail();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const startDate = new Date(booking.start);
  const endDate = new Date(booking.end);
  const durationHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/d/agency/bookings"
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bookings
        </Link>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Booking Details Card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-semibold text-white">
                  {booking.venue?.name || "Unknown Venue"}
                </h1>
                <BookingStatusBadge status={booking.status} />
              </div>
              {booking.venue?.address && (
                <p className="mt-1 text-zinc-400">
                  {booking.venue.address}
                  {booking.venue.city && `, ${booking.venue.city}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold text-shield-400">
                £{(booking.rate / 100).toFixed(2)}
              </p>
              <p className="text-sm text-zinc-500">per hour</p>
            </div>
          </div>

          {/* Date & Time */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Date</p>
              <p className="mt-1 font-medium text-white">
                {startDate.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Time</p>
              <p className="mt-1 font-medium text-white">
                {startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                {" - "}
                {endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-zinc-400">{durationHours} hours</p>
            </div>
            <div className="rounded-xl bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Guards Needed</p>
              <p className="mt-1 font-medium text-white">{booking.guards_count} personnel</p>
              <p className="text-sm text-zinc-400">
                {assignedStaff.length}/{booking.guards_count} assigned
              </p>
            </div>
          </div>

          {/* Requirements */}
          {booking.request?.certs_required && booking.request.certs_required.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-zinc-400">Required Certifications</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {booking.request.certs_required.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 rounded-lg bg-shield-500/20 px-3 py-1 text-sm text-shield-300"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {booking.request?.description && (
            <div className="mt-6">
              <p className="text-sm font-medium text-zinc-400">Description</p>
              <p className="mt-2 text-sm text-zinc-300">{booking.request.description}</p>
            </div>
          )}
        </div>

        {/* Assignment Panel */}
        <div className="glass rounded-2xl p-6">
          <AssignmentPanel
            bookingId={booking.id}
            guardsNeeded={booking.guards_count}
            assignedStaff={assignedStaff}
            availableStaff={availableStaff}
            suggestedStaff={suggestedStaff}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>

        {/* Revenue Estimate */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-medium text-white">Revenue Estimate</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-zinc-400">Rate × Hours × Guards</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">
                £{(booking.rate / 100).toFixed(2)} × {durationHours} × {booking.guards_count}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Revenue</p>
              <p className="mt-1 font-display text-2xl font-semibold text-emerald-400">
                £{((booking.rate / 100) * durationHours * booking.guards_count).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
