"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase } from "@/hooks/useSupabase";
import { useAgencyProfile, useAgencyStaff } from "@/hooks";
import {
  SiteLocationPicker,
  type SiteLocationValue,
} from "@/components/maps/SiteLocationPicker";
import { PersonnelAvatar } from "@/components/ui/PersonnelAvatar";

type SlotStatus = "unassigned" | "awaiting" | "confirmed" | "declined";

type ShiftRow = {
  id: string;
  personnel_id: string | null;
  role: string;
  hourly_rate: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type BookingRow = {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  self_managed: boolean | null;
  status: string;
  shifts: ShiftRow[];
};

type AssignmentRow = {
  shift_id: string;
  personnel_id: string;
  status: string;
  decline_reason: string | null;
};

type RosterGuard = {
  id: string;
  name: string;
  rating: number | null;
  skills: string[];
  hasAppAccount: boolean;
  avatarUrl: string | null;
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function formatTime(value: string) {
  // value can be a HH:mm[:ss] time or an ISO timestamp.
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ShiftScheduler() {
  const supabase = useSupabase();
  const { data: agency } = useAgencyProfile();
  const { data: staff, loading: staffLoading } = useAgencyStaff();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [assignments, setAssignments] = useState<Map<string, AssignmentRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateStr(new Date()));
  const [assignPickerShiftId, setAssignPickerShiftId] = useState<string | null>(null);
  const [busyShiftId, setBusyShiftId] = useState<string | null>(null);
  const [showAddShift, setShowAddShift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roster: RosterGuard[] = useMemo(
    () =>
      (staff ?? []).map((p: any) => ({
        id: p.id,
        name:
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          "Guard",
        rating: p.average_rating ?? p.rating ?? null,
        skills: Array.isArray(p.skills) ? p.skills : [],
        hasAppAccount: Boolean(p.user_id),
        avatarUrl: p.avatar_url ?? null,
      })),
    [staff],
  );

  const rosterById = useMemo(() => {
    const m = new Map<string, RosterGuard>();
    roster.forEach((g) => m.set(g.id, g));
    return m;
  }, [roster]);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const fetchData = useCallback(async () => {
    if (!agency?.id) return;
    const today = new Date();
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - 1);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 30);

    const { data, error: bookingErr } = await supabase
      .from("bookings")
      .select(
        `id, event_name, event_date, start_time, end_time, self_managed, status,
         shifts ( id, personnel_id, role, hourly_rate, scheduled_start, scheduled_end, status )`,
      )
      .eq("agency_id", agency.id)
      .gte("event_date", toDateStr(rangeStart))
      .lte("event_date", toDateStr(rangeEnd))
      .order("event_date", { ascending: true });

    if (bookingErr) {
      setLoading(false);
      return;
    }

    const rows = (data as unknown as BookingRow[]) ?? [];
    setBookings(rows);

    const shiftIds = rows.flatMap((b) => (b.shifts ?? []).map((s) => s.id));
    if (shiftIds.length > 0) {
      const { data: assignmentRows } = await supabase
        .from("shift_assignments")
        .select("shift_id, personnel_id, status, decline_reason")
        .in("shift_id", shiftIds);
      const map = new Map<string, AssignmentRow[]>();
      for (const row of (assignmentRows as AssignmentRow[]) ?? []) {
        const arr = map.get(row.shift_id) ?? [];
        arr.push(row);
        map.set(row.shift_id, arr);
      }
      setAssignments(map);
    } else {
      setAssignments(new Map());
    }
    setLoading(false);
  }, [supabase, agency?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: refresh when shifts under this agency change (e.g. a guard
  // accepts/declines on mobile).
  useEffect(() => {
    if (!agency?.id) return;
    const channel = supabase
      .channel("agency-scheduler")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => fetchData())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments" },
        () => fetchData(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, agency?.id, fetchData]);

  const slotState = (shift: ShiftRow): { status: SlotStatus; guardName: string | null } => {
    if (shift.personnel_id) {
      const guardName = rosterById.get(shift.personnel_id)?.name ?? "Assigned guard";
      return { status: shift.status === "accepted" ? "confirmed" : "awaiting", guardName };
    }
    // Unassigned — surface a declined flag if a guard recently turned it down.
    const declined = (assignments.get(shift.id) ?? []).some((a) => a.status === "declined");
    return { status: declined ? "declined" : "unassigned", guardName: null };
  };

  const allShifts = bookings.flatMap((b) => b.shifts ?? []);
  const counts = {
    total: allShifts.length,
    unassigned: allShifts.filter((s) => !s.personnel_id).length,
    awaiting: allShifts.filter((s) => s.personnel_id && s.status !== "accepted").length,
    confirmed: allShifts.filter((s) => s.personnel_id && s.status === "accepted").length,
  };

  const dates = [...new Set(bookings.map((b) => b.event_date))].sort();
  const bookingsForDate = bookings.filter((b) => b.event_date === selectedDate);

  const handleAssign = async (shiftId: string, personnelId: string) => {
    setBusyShiftId(shiftId);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/agency/assign-shift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ shift_id: shiftId, personnel_id: personnelId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Could not assign this guard.");
      } else {
        setAssignPickerShiftId(null);
        await fetchData();
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusyShiftId(null);
    }
  };

  const handleUnassign = async (shiftId: string) => {
    setBusyShiftId(shiftId);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/agency/unassign-shift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ shift_id: shiftId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Could not remove this guard from the shift.");
      } else {
        await fetchData();
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusyShiftId(null);
    }
  };

  if (loading || staffLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/[0.04] bg-gradient-to-b from-zinc-950/80 via-black/40 to-black/60 p-4 sm:p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Shifts</p>
          <p className="text-2xl font-bold text-white">{counts.total}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Unassigned</p>
          <p className="text-2xl font-bold text-amber-400">{counts.unassigned}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Awaiting</p>
          <p className="text-2xl font-bold text-blue-400">{counts.awaiting}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Confirmed</p>
          <p className="text-2xl font-bold text-emerald-400">{counts.confirmed}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Date strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((date) => {
          const dayBookings = bookings.filter((b) => b.event_date === date);
          const open = dayBookings.flatMap((b) => b.shifts).filter((s) => !s.personnel_id).length;
          const dateObj = new Date(date + "T00:00:00");
          return (
            <motion.button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 rounded-xl px-4 py-3 text-center transition ${
                selectedDate === date ? "bg-shield-500 text-white" : "glass text-zinc-400 hover:text-white"
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <p className="text-xs uppercase">{dateObj.toLocaleDateString("en-GB", { weekday: "short" })}</p>
              <p className="text-lg font-bold">{dateObj.getDate()}</p>
              {open > 0 && (
                <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                  {open} open
                </span>
              )}
            </motion.button>
          );
        })}
        <motion.button
          onClick={() => setShowAddShift(true)}
          className="flex-shrink-0 rounded-xl border-2 border-dashed border-zinc-700 px-4 py-3 text-zinc-500 hover:border-shield-500 hover:text-shield-400 transition"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-xs">New</p>
          <p className="text-lg font-bold">+</p>
        </motion.button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Roster */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Your Roster ({roster.length})</h3>
          {roster.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No staff on your roster yet. Add staff from the Staff section, then schedule them here.
            </p>
          ) : (
            <div className="space-y-2">
              {roster.map((member) => {
                const assignedToday = bookingsForDate
                  .flatMap((b) => b.shifts)
                  .some((s) => s.personnel_id === member.id);
                return (
                  <div
                    key={member.id}
                    className={`rounded-lg p-3 ${assignedToday ? "bg-zinc-800/50 opacity-60" : "bg-white/5"}`}
                  >
                    <div className="flex items-center gap-3">
                      <PersonnelAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{member.name}</p>
                        <div className="flex items-center gap-2">
                          {member.rating != null && (
                            <span className="text-xs text-amber-400">★ {member.rating}</span>
                          )}
                          {member.hasAppAccount ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              App linked
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              No app account
                            </span>
                          )}
                          {member.skills.length > 0 && (
                            <span className="text-xs text-zinc-500 truncate">
                              {member.skills.slice(0, 2).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      {assignedToday && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                          On shift
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Shifts for the selected date */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </h3>

          {bookingsForDate.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-zinc-400">No shifts scheduled for this date</p>
              <button
                onClick={() => setShowAddShift(true)}
                className="mt-4 text-shield-400 hover:text-shield-300 text-sm"
              >
                + Schedule a shift
              </button>
            </div>
          ) : (
            bookingsForDate.map((booking) => (
              <div key={booking.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white">{booking.event_name}</h4>
                    <p className="text-sm text-zinc-400">
                      {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                    </p>
                  </div>
                  {booking.self_managed && (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-zinc-300">
                      Self-managed
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {(booking.shifts ?? []).map((shift) => {
                    const { status, guardName } = slotState(shift);
                    const isPicking = assignPickerShiftId === shift.id;
                    return (
                      <div
                        key={shift.id}
                        className={`rounded-lg p-3 border ${
                          status === "confirmed"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : status === "awaiting"
                            ? "border-blue-500/30 bg-blue-500/5"
                            : status === "declined"
                            ? "border-red-500/30 bg-red-500/5"
                            : "border-dashed border-amber-500/30 bg-amber-500/[0.03]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-zinc-300">
                              {shift.role}
                            </span>
                            <span className="text-xs text-emerald-400">£{shift.hourly_rate}/hr</span>
                          </div>
                          <div className="text-sm">
                            {status === "confirmed" && (
                              <span className="text-emerald-400">✓ {guardName} confirmed</span>
                            )}
                            {status === "awaiting" && (
                              <span className="text-blue-400">⏳ {guardName} — awaiting response</span>
                            )}
                            {status === "declined" && (
                              <span className="text-red-400">Declined — reassign</span>
                            )}
                            {status === "unassigned" && (
                              <span className="text-amber-400">Unassigned</span>
                            )}
                          </div>
                        </div>

                        {!shift.personnel_id && (
                          <div className="mt-3">
                            {isPicking ? (
                              <div className="rounded-lg bg-black/50 border border-white/10 p-2 space-y-1 max-h-48 overflow-y-auto">
                                {roster.length === 0 ? (
                                  <p className="text-xs text-zinc-500 p-2">No roster staff to assign.</p>
                                ) : (
                                  roster.map((g) => (
                                    <button
                                      key={g.id}
                                      disabled={busyShiftId === shift.id || !g.hasAppAccount}
                                      onClick={() => handleAssign(shift.id, g.id)}
                                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/10 disabled:opacity-50 transition"
                                    >
                                      <PersonnelAvatar name={g.name} avatarUrl={g.avatarUrl} size="xs" />
                                      <span className="flex-1 min-w-0">
                                        <span className="block text-sm text-white truncate">{g.name}</span>
                                        {!g.hasAppAccount && (
                                          <span className="block text-[10px] text-amber-400">
                                            Needs app account to receive shifts
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  ))
                                )}
                                <button
                                  onClick={() => setAssignPickerShiftId(null)}
                                  className="w-full text-xs text-zinc-500 hover:text-white py-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssignPickerShiftId(shift.id)}
                                className="text-sm text-shield-400 hover:text-shield-300 transition"
                              >
                                + Assign a guard
                              </button>
                            )}
                          </div>
                        )}

                        {shift.personnel_id && (
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => handleUnassign(shift.id)}
                              disabled={busyShiftId === shift.id}
                              className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition"
                            >
                              {busyShiftId === shift.id ? "Removing…" : "Remove from shift"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddShift && (
          <NewShiftModal
            defaultDate={selectedDate}
            getToken={getToken}
            onClose={() => setShowAddShift(false)}
            onCreated={async (date) => {
              setShowAddShift(false);
              setSelectedDate(date);
              await fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewShiftModal({
  defaultDate,
  getToken,
  onClose,
  onCreated,
}: {
  defaultDate: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onCreated: (date: string) => void;
}) {
  const [eventName, setEventName] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [siteLocation, setSiteLocation] = useState<SiteLocationValue | null>(null);
  const [role, setRole] = useState("Security Officer");
  const [rate, setRate] = useState("18");
  const [count, setCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!eventName.trim() || !date || !startTime || !endTime || !role.trim()) {
      setErr("Please fill in the event name, date, times and role.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/agency/scheduled-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          event_name: eventName.trim(),
          date,
          start_time: startTime,
          end_time: endTime,
          location_text: siteLocation?.addressText || null,
          site_label: siteLocation?.label || null,
          site_latitude: siteLocation?.lat ?? null,
          site_longitude: siteLocation?.lng ?? null,
          role: role.trim(),
          hourly_rate: Number(rate),
          count: Number(count),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || "Could not create the shift.");
      } else {
        onCreated(date);
      }
    } catch {
      setErr("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        className="relative w-full max-w-lg max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950 via-zinc-950 to-black shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-shield-500/10 to-transparent" />
        <div className="relative max-h-[92vh] overflow-y-auto p-6">
        <h3 className="text-xl font-bold text-white mb-1">Schedule a Shift</h3>
        <p className="text-sm text-zinc-400 mb-5">
          Create a booking for your own staff. No payment is taken — you manage pay through your own
          payroll.
        </p>

        {err && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {err}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Event / job name">
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Saturday door cover"
              className="modal-input"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="modal-input" />
            </Field>
            <Field label="Start">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="modal-input" />
            </Field>
            <Field label="End">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="modal-input" />
            </Field>
          </div>

          <Field label="Site location">
            <SiteLocationPicker value={siteLocation} onChange={setSiteLocation} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Role">
              <input value={role} onChange={(e) => setRole(e.target.value)} className="modal-input" />
            </Field>
            <Field label="Rate (£/hr)">
              <input type="number" min="1" value={rate} onChange={(e) => setRate(e.target.value)} className="modal-input" />
            </Field>
            <Field label="Guards">
              <input type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} className="modal-input" />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="modal-input resize-none"
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-xl bg-shield-500 px-4 py-2.5 font-medium text-white shadow-lg shadow-shield-500/20 transition hover:bg-shield-400 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Shift"}
          </button>
        </div>
        </div>

        <style jsx global>{`
          .modal-input,
          .scheduler-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 0.625rem;
            padding: 0.55rem 0.75rem;
            color: white;
            font-size: 0.875rem;
          }
          .modal-input:focus,
          .scheduler-input:focus {
            outline: none;
            border-color: rgb(20 184 166);
            box-shadow: 0 0 0 1px rgba(20, 184, 166, 0.25);
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
