"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase } from "@/hooks/useSupabase";
import { useAgencyProfile } from "@/hooks/useAgency";
import { HelpHint } from "@/components/ui/HelpHint";
import {
  SiteLocationPicker,
  type SiteLocationValue,
} from "@/components/maps/SiteLocationPicker";
import { ShiftBriefSection } from "@/components/bookings/ShiftBriefSection";
import type { BookingWithShifts, Shift } from "@/lib/database.types";
import {
  isShiftInProgress,
  remainingMinutes,
  MIN_REMAINING_MINUTES_FOR_COVER,
} from "@/lib/shifts/marketplace";

type AccessLevel = "owner" | "assigned" | null;

function resolveAccess(
  agencyId: string | undefined,
  booking: BookingWithShifts,
): AccessLevel {
  if (!agencyId) return null;
  if (booking.agency_id === agencyId) return "owner";
  const hasAgencyShift = booking.shifts?.some((s) => s.agency_id === agencyId);
  return hasAgencyShift ? "assigned" : null;
}

function formatTimeDisplay(time: string): string {
  const parts = time.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return time;
}

function bookingFormFromRecord(booking: BookingWithShifts): {
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  site: SiteLocationValue | null;
} {
  return {
    event_name: booking.event_name,
    event_date: booking.event_date,
    start_time: formatTimeDisplay(booking.start_time),
    end_time: formatTimeDisplay(booking.end_time),
    site:
      booking.site_latitude && booking.site_longitude
        ? {
            lat: booking.site_latitude,
            lng: booking.site_longitude,
            label: booking.site_label ?? booking.site_address_text ?? "Site",
            addressText: booking.site_address_text ?? "",
            precision: "exact" as const,
          }
        : null,
  };
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-shield-500/50 focus:outline-none focus:ring-1 focus:ring-shield-500/30 transition";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-zinc-300">{children}</label>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">{children}</h4>
  );
}
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

type AgencyBookingManageProps = {
  booking: BookingWithShifts;
  onRefresh: () => void;
};

export function AgencyBookingManage({ booking, onRefresh }: AgencyBookingManageProps) {
  const supabase = useSupabase();
  const { data: agency } = useAgencyProfile();
  const access = resolveAccess(agency?.id, booking);

  const [showEditBooking, setShowEditBooking] = useState(false);
  const [showCancelBooking, setShowCancelBooking] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showPermissions, setShowPermissions] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    event_name: string;
    event_date: string;
    start_time: string;
    end_time: string;
    site: SiteLocationValue | null;
  }>(() => bookingFormFromRecord(booking));

  const openEditModal = () => {
    setForm(bookingFormFromRecord(booking));
    setError(null);
    setShowEditBooking(true);
  };

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const canEditBooking =
    access === "owner" && ["pending", "confirmed"].includes(booking.status);
  const canCancelBooking = canEditBooking;
  const isSelfManaged = Boolean((booking as { self_managed?: boolean }).self_managed);

  const permissions = useMemo(() => {
    if (access === "owner") {
      return {
        title: "Your booking — full control",
        items: [
          { ok: canEditBooking, text: "Edit event name, times, and site location" },
          { ok: canEditBooking, text: "Write and update the shift brief for guards" },
          { ok: canCancelBooking, text: "Cancel the whole booking (not while a guard is checked in)" },
          { ok: true, text: "Edit geofence and patrol checkpoints below" },
          { ok: true, text: "Cancel or edit individual shift slots before they start" },
          { ok: isSelfManaged, text: "Assign roster guards via Shift Scheduler" },
          { ok: !isSelfManaged, text: "Marketplace shifts: guards claim from the job board" },
        ],
      };
    }
    if (access === "assigned") {
      return {
        title: "Venue contract — limited control",
        items: [
          { ok: false, text: "Cannot edit booking details (owned by the venue)" },
          { ok: false, text: "Cannot cancel the whole booking" },
          { ok: true, text: "Remove your assigned guards from their shifts" },
          { ok: true, text: "Call guards and use Mission Control for comms" },
          { ok: false, text: "Cannot change site location or geofence" },
        ],
      };
    }
    return null;
  }, [access, canEditBooking, canCancelBooking, isSelfManaged]);

  const saveBooking = async () => {
    setLoading("save-booking");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const res = await fetch(`/api/agency/bookings/${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_name: form.event_name,
          event_date: form.event_date,
          start_time: form.start_time,
          end_time: form.end_time,
          site_label: form.site?.label ?? null,
          site_address_text: form.site?.addressText ?? null,
          site_latitude: form.site?.lat ?? null,
          site_longitude: form.site?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setShowEditBooking(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save booking");
    } finally {
      setLoading(null);
    }
  };

  const cancelBooking = async () => {
    setLoading("cancel-booking");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const res = await fetch(`/api/agency/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");

      setShowCancelBooking(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel booking");
    } finally {
      setLoading(null);
    }
  };

  const saveBrief = useCallback(
    async (briefNotes: string | null) => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");

        const res = await fetch(`/api/agency/bookings/${booking.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ brief_notes: briefNotes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save brief");

        onRefresh();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save brief");
        return false;
      }
    },
    [booking.id, getToken, onRefresh],
  );

  if (!access || !permissions) return null;

  return (
    <>
      <div className="glass rounded-xl overflow-hidden">
        {/* Action bar */}
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Booking controls</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  access === "owner"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {access === "owner" ? "Your booking" : "Venue contract"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{permissions.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditBooking && (
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-shield-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-shield-600 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            {canCancelBooking && (
              <button
                type="button"
                onClick={() => setShowCancelBooking(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition"
              >
                Cancel booking
              </button>
            )}
            {isSelfManaged && (
              <Link
                href="/d/agency/scheduler"
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.08] transition"
              >
                Scheduler
              </Link>
            )}
            <Link
              href={`/d/agency/mission-control?booking=${booking.id}`}
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.08] transition"
            >
              Mission Control
            </Link>
          </div>
        </div>

        {/* Site location */}
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-1">
            Site location
          </p>
          {booking.site_address_text ? (
            <p className="text-sm text-zinc-200">
              {booking.site_label && (
                <span className="font-medium text-white">{booking.site_label} · </span>
              )}
              {booking.site_address_text}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">No site set.</p>
          )}
        </div>

        {/* Collapsible permissions */}
        <div className="border-t border-white/[0.06] px-4 py-2">
          <div className="flex w-full items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => setShowPermissions((v) => !v)}
              aria-expanded={showPermissions}
              className="flex flex-1 items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 transition text-left"
            >
              <span>What you can and can&apos;t do</span>
              <span className="ml-2 shrink-0">{showPermissions ? "▲" : "▼"}</span>
            </button>
            <HelpHint label="Agency controls">
              Full control on bookings you created. On venue contracts you can manage your
              guards but not change the venue&apos;s booking details.
            </HelpHint>
          </div>
          <AnimatePresence>
            {showPermissions && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden grid gap-2 pb-3 sm:grid-cols-2"
              >
                {permissions.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        item.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-600"
                      }`}
                    >
                      {item.ok ? "✓" : "—"}
                    </span>
                    <span className={item.ok ? "text-zinc-300" : "text-zinc-500"}>{item.text}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {error && !showEditBooking && (
          <p className="mx-4 mb-4 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      <ShiftBriefSection
        bookingId={booking.id}
        briefNotes={booking.brief_notes}
        editable={canEditBooking}
        onSave={saveBrief}
        className="mt-4"
      />

      {/* Edit booking modal */}
      <AnimatePresence>
        {showEditBooking && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEditBooking(false)}
          >
            <motion.div
              className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Edit booking</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Changes apply to all open shifts on this booking.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditBooking(false)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white transition"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <section>
                  <SectionTitle>Event</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Event name</FieldLabel>
                      <input
                        value={form.event_name}
                        onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
                        className={inputClass}
                        placeholder="e.g. Corporate event, NYE party"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <FieldLabel>Date</FieldLabel>
                        <input
                          type="date"
                          value={form.event_date}
                          onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>Start time</FieldLabel>
                        <input
                          type="time"
                          value={form.start_time}
                          onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>End time</FieldLabel>
                        <input
                          type="time"
                          value={form.end_time}
                          onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionTitle>Where guards check in</SectionTitle>
                  <SiteLocationPicker
                    compact
                    value={form.site}
                    onChange={(site) => setForm((f) => ({ ...f, site }))}
                  />
                </section>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>

              {/* Sticky footer */}
              <div className="flex gap-3 border-t border-white/[0.06] px-5 py-4 bg-zinc-900/95 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setShowEditBooking(false)}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.04] transition"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={saveBooking}
                  disabled={loading === "save-booking" || !form.event_name.trim()}
                  className="flex-1 rounded-xl bg-shield-500 py-2.5 text-sm font-medium text-white hover:bg-shield-600 disabled:opacity-50 transition"
                >
                  {loading === "save-booking" ? "Saving…" : "Save changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel booking modal */}
      <AnimatePresence>
        {showCancelBooking && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelBooking(false)}
          >
            <motion.div
              className="glass max-w-md w-full rounded-xl p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-2">Cancel entire booking?</h3>
              <p className="text-sm text-zinc-400 mb-4">
                All open shifts will be cancelled and assigned guards will be notified. This cannot
                be undone.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelBooking(false)}
                  className="flex-1 py-2 text-sm text-zinc-400 hover:text-white"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  onClick={cancelBooking}
                  disabled={loading === "cancel-booking"}
                  className="flex-1 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {loading === "cancel-booking" ? "Cancelling…" : "Cancel booking"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

type AgencyShiftActionsProps = {
  shift: Shift;
  booking: BookingWithShifts;
  onRefresh: () => void;
};

export function AgencyShiftActions({ shift, booking, onRefresh }: AgencyShiftActionsProps) {
  const supabase = useSupabase();
  const { data: agency } = useAgencyProfile();
  const access = resolveAccess(agency?.id, booking);

  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolveReason, setResolveReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minsRemaining = remainingMinutes(shift.scheduled_end);
  const inProgress = isShiftInProgress(shift);
  const canOfferCover = minsRemaining >= MIN_REMAINING_MINUTES_FOR_COVER;

  const [form, setForm] = useState({
    role: shift.role ?? "",
    hourly_rate: shift.hourly_rate ?? 0,
    scheduled_start: toDatetimeLocal(shift.scheduled_start),
    scheduled_end: toDatetimeLocal(shift.scheduled_end),
  });

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const editable =
    access === "owner" && ["pending", "accepted", "offered"].includes(shift.status);
  const canCancelShift =
    access === "owner" &&
    !inProgress &&
    ["pending", "accepted", "offered"].includes(shift.status);
  const canUnassign =
    !inProgress &&
    Boolean(shift.personnel_id) &&
    ["pending", "accepted"].includes(shift.status) &&
    (access === "owner" || (access === "assigned" && shift.agency_id === agency?.id));

  const canManageCoverage =
    access === "owner" &&
    (inProgress ||
      (shift.status === "checked_out" && minsRemaining > 0)) &&
    shift.status !== "cancelled";

  if (!access) return null;

  const resolveShift = async (action: "cancel" | "close_early" | "find_cover", force?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/agency/shifts/${shift.id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          reason: resolveReason.trim() || undefined,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update shift");
      setShowResolve(false);
      setResolveReason("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update shift");
    } finally {
      setLoading(false);
    }
  };

  const unassignGuard = async () => {
    if (!confirm("Remove this guard from the shift? They will be notified.")) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/agency/unassign-shift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shift_id: shift.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unassign");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unassign");
    } finally {
      setLoading(false);
    }
  };

  const saveShift = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/agency/shifts/${shift.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: form.role,
          hourly_rate: Number(form.hourly_rate),
          scheduled_start: fromDatetimeLocal(form.scheduled_start),
          scheduled_end: fromDatetimeLocal(form.scheduled_end),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setShowEdit(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save shift");
    } finally {
      setLoading(false);
    }
  };

  const cancelShift = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/agency/shifts/${shift.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");
      setShowCancel(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel shift");
    } finally {
      setLoading(false);
    }
  };

  if (!editable && !canCancelShift && !canUnassign && !canManageCoverage) return null;

  return (
    <div className="mt-2 pt-2 border-t border-white/10">
      <div className="flex flex-wrap gap-2">
        {editable && (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="text-xs text-shield-400 hover:text-shield-300"
          >
            Edit shift
          </button>
        )}
        {canCancelShift && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Cancel shift
          </button>
        )}
        {canManageCoverage && (
          <button
            type="button"
            onClick={() => setShowResolve(true)}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            Manage coverage
            {inProgress ? ` · ${minsRemaining}m left` : ""}
          </button>
        )}
        {canUnassign && (
          <button
            type="button"
            onClick={unassignGuard}
            disabled={loading}
            className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
          >
            Remove guard
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      <AnimatePresence>
        {showEdit && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEdit(false)}
          >
            <motion.div
              className="glass max-w-md w-full rounded-xl p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Edit shift</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Role</label>
                  <input
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Hourly rate (£)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.hourly_rate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_start}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_start: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_end}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_end: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm text-zinc-400">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveShift}
                  disabled={loading}
                  className="px-4 py-2 text-sm rounded-lg bg-shield-500 text-white disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCancel && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancel(false)}
          >
            <motion.div
              className="glass max-w-md w-full rounded-xl p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-2">Cancel this shift slot?</h3>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 resize-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCancel(false)} className="flex-1 py-2 text-sm text-zinc-400">
                  Keep shift
                </button>
                <button
                  type="button"
                  onClick={cancelShift}
                  disabled={loading}
                  className="flex-1 py-2 text-sm rounded-lg bg-red-500 text-white disabled:opacity-50"
                >
                  {loading ? "Cancelling…" : "Cancel shift"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResolve && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResolve(false)}
          >
            <motion.div
              className="glass max-w-md w-full rounded-xl p-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-1">Manage coverage</h3>
              <p className="text-sm text-zinc-400 mb-4">
                {inProgress
                  ? `This shift is in progress with ${minsRemaining} minutes remaining. Choose what should happen next.`
                  : "Choose how to handle the remaining scheduled time."}
              </p>
              <textarea
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 resize-none"
              />
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => resolveShift("cancel")}
                  className="w-full py-2.5 text-sm rounded-lg bg-red-500/90 text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Cancel shift entirely
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => resolveShift("close_early")}
                  className="w-full py-2.5 text-sm rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
                >
                  Close early — no replacement needed
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (!canOfferCover) {
                      if (
                        confirm(
                          `Only ${minsRemaining} min remain — urgent cover may not fill in time. Post anyway?`,
                        )
                      ) {
                        void resolveShift("find_cover", true);
                      }
                      return;
                    }
                    void resolveShift("find_cover");
                  }}
                  className="w-full py-2.5 text-sm rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50"
                >
                  Find urgent cover
                  {!canOfferCover ? ` (${minsRemaining}m left — override)` : ""}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowResolve(false)}
                className="w-full mt-3 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Keep current plan
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
