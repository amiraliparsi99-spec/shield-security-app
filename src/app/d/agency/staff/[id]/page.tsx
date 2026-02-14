"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StaffStatusBadge, StaffRoleBadge } from "@/components/agency";
import type { AgencyStaffWithPersonnel, AgencyStaffRole, AgencyStaffStatus, BookingAssignment, Booking } from "@/types/database";

interface StaffDetailData extends AgencyStaffWithPersonnel {
  assignments?: Array<BookingAssignment & { booking: Booking & { venue?: { name: string } } }>;
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "contractor" as AgencyStaffRole,
    status: "active" as AgencyStaffStatus,
    hourlyRate: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadStaffDetail();
  }, [params.id]);

  const loadStaffDetail = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const staffId = params.id as string;

      // Get staff with personnel details
      const { data: staffData } = await supabase
        .from("agency_staff")
        .select(`
          *,
          personnel:personnel(*)
        `)
        .eq("id", staffId)
        .single();

      if (!staffData) {
        router.push("/d/agency/staff");
        return;
      }

      // Get assignment history
      const { data: assignments } = await supabase
        .from("booking_assignments")
        .select(`
          *,
          booking:bookings(
            *,
            venue:venues(name)
          )
        `)
        .eq("agency_staff_id", staffId)
        .order("created_at", { ascending: false })
        .limit(10);

      const fullData: StaffDetailData = {
        ...staffData,
        assignments: assignments || [],
      };

      setStaff(fullData);
      setEditForm({
        role: staffData.role,
        status: staffData.status,
        hourlyRate: staffData.hourly_rate ? (staffData.hourly_rate / 100).toFixed(2) : "",
        notes: staffData.notes || "",
      });
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!staff) return;
    setIsSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("agency_staff")
        .update({
          role: editForm.role,
          status: editForm.status,
          hourly_rate: editForm.hourlyRate ? Math.round(parseFloat(editForm.hourlyRate) * 100) : null,
          notes: editForm.notes || null,
        })
        .eq("id", staff.id);

      if (error) throw error;

      await loadStaffDetail();
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!staff) return;
    if (!confirm("Are you sure you want to remove this staff member from your team?")) return;

    try {
      const supabase = createClient();
      await supabase.from("agency_staff").delete().eq("id", staff.id);
      router.push("/d/agency/staff");
    } catch (error) {
      console.error("Error removing staff:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

  if (!staff) {
    return null;
  }

  const { personnel } = staff;
  const initials = personnel.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/d/agency/staff"
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff
        </Link>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Profile Card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-shield-500 to-shield-600 text-2xl font-bold text-white shadow-glow-sm">
              {initials}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-semibold text-white">
                  {personnel.display_name}
                </h1>
                <StaffStatusBadge status={staff.status} />
              </div>
              <p className="mt-1 text-zinc-400">
                <StaffRoleBadge role={staff.role} />
                {staff.hourly_rate && (
                  <span className="ml-3 text-shield-400">
                    £{(staff.hourly_rate / 100).toFixed(2)}/hr
                  </span>
                )}
              </p>
              {personnel.city || personnel.region ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {[personnel.city, personnel.region].filter(Boolean).join(", ")}
                </p>
              ) : null}

              {/* Certifications */}
              {personnel.certs && personnel.certs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {personnel.certs.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400"
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {cert}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/d/agency/messages?staff=${staff.id}`}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                title="Message"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </Link>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                title="Edit"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-medium text-white">Edit Details</h2>
            
            <div className="space-y-4">
              {/* Role */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as AgencyStaffRole })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-shield-500/50"
                >
                  <option value="contractor">Contractor</option>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AgencyStaffStatus })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-shield-500/50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Hourly Rate</label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.hourlyRate}
                    onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-12 text-white outline-none transition focus:border-shield-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">/hr</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Internal Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-shield-500/50"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-shield-400 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Internal Notes (if any) */}
        {staff.notes && !isEditing && (
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-2 text-sm font-medium text-zinc-400">Internal Notes</h2>
            <p className="text-sm text-white">{staff.notes}</p>
          </div>
        )}

        {/* Assignment History */}
        <div className="glass rounded-2xl p-6">
          <h2 className="mb-4 font-display text-lg font-medium text-white">Shift History</h2>
          
          {staff.assignments && staff.assignments.length > 0 ? (
            <div className="divide-y divide-white/[0.06]">
              {staff.assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-4 py-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    assignment.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                    assignment.status === "confirmed" ? "bg-blue-500/20 text-blue-400" :
                    assignment.status === "no_show" ? "bg-red-500/20 text-red-400" :
                    "bg-zinc-500/20 text-zinc-400"
                  }`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {assignment.booking?.venue?.name || "Unknown Venue"}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(assignment.booking.start).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    assignment.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                    assignment.status === "confirmed" ? "bg-blue-500/20 text-blue-400" :
                    assignment.status === "declined" ? "bg-red-500/20 text-red-400" :
                    assignment.status === "no_show" ? "bg-amber-500/20 text-amber-400" :
                    "bg-zinc-500/20 text-zinc-400"
                  }`}>
                    {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-zinc-500">No shifts yet</p>
          )}
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="font-display text-lg font-medium text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Remove this staff member from your team. This action cannot be undone.
          </p>
          <button
            onClick={handleRemove}
            className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/30"
          >
            Remove from Team
          </button>
        </div>
      </div>
    </div>
  );
}
