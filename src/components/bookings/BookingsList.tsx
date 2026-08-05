"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSupabase, useUser, useAgencyProfile } from "@/hooks";
import { EmptyState, EmptyStateCTA } from "@/components/ui/LoadingStates";
import { getPricingBreakdown } from "@/lib/pricing";

export type BookingsListOwnerType = "venue" | "agency";

type Guard = {
  id: string;
  display_name: string;
  shield_score: number;
  photo_url: string | null;
  city: string | null;
  total_shifts: number;
  role: string;
};

type Booking = {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  estimated_total: number;
  staff_requirements: any[];
  guards: Guard[];
  totalShifts: number;
  claimedShifts: number;
  isPaid: boolean;
  paidAt: string | null;
  source: "created" | "assigned";
};

type FilterKey = "all" | "pending" | "confirmed" | "completed" | "paid";
type SortKey = "date_desc" | "date_asc" | "value_desc";

function getBookingTotalGBP(booking: Booking): number {
  return getPricingBreakdown(booking).totalGBP;
}

function formatTimeShort(time: string): string {
  const parts = time.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return time;
}

function formatEventDate(date: string): { day: string; month: string; weekday: string } {
  const d = new Date(date);
  return {
    day: d.toLocaleDateString("en-GB", { day: "numeric" }),
    month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
  };
}

function bookingSortDate(b: Booking): number {
  return new Date(`${b.event_date}T${b.start_time || "00:00"}`).getTime();
}

type BookingPhase = "upcoming" | "today" | "past";

function getBookingPhase(b: Booking): BookingPhase {
  const now = new Date();
  const todayKey = now.toDateString();
  const eventKey = new Date(b.event_date).toDateString();
  if (b.status === "completed" || b.status === "cancelled") return "past";
  if (eventKey === todayKey) return "today";
  const eventStart = new Date(`${b.event_date}T${b.start_time || "00:00"}`);
  return eventStart >= now ? "upcoming" : "past";
}

function getStaffingPct(b: Booking): number {
  if (b.totalShifts <= 0) return 0;
  return Math.round((b.claimedShifts / b.totalShifts) * 100);
}

function getStatusMeta(b: Booking): {
  label: string;
  tone: "amber" | "emerald" | "blue" | "zinc" | "sky";
  dot?: boolean;
} {
  if (b.status === "completed") {
    return { label: "Completed", tone: "zinc" };
  }
  if (b.isPaid) {
    return { label: "Paid", tone: "blue" };
  }
  if (b.claimedShifts > 0 && b.claimedShifts >= b.totalShifts) {
    return { label: "Fully staffed", tone: "emerald" };
  }
  if (b.claimedShifts > 0) {
    return { label: "Partially staffed", tone: "emerald" };
  }
  return { label: "Awaiting claims", tone: "amber", dot: true };
}

const TONE_STYLES = {
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  blue: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  zinc: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/25",
  sky: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/25",
};

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Awaiting" },
  { key: "confirmed", label: "Staffed" },
  { key: "completed", label: "Completed" },
  { key: "paid", label: "Paid" },
];

interface BookingsListProps {
  ownerType: BookingsListOwnerType;
}

export function BookingsList({ ownerType }: BookingsListProps) {
  const isAgency = ownerType === "agency";
  const basePath = isAgency ? "/d/agency" : "/d/venue";

  const supabase = useSupabase();
  const { user, loading: userLoading } = useUser();
  const { data: agency, loading: agencyLoading } = useAgencyProfile();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");

  useEffect(() => {
    async function fetchBookings() {
      if (!supabase) return;

      let baseRows: { row: any; source: "created" | "assigned" }[] = [];

      if (isAgency) {
        if (agencyLoading) return;
        if (!agency?.id) {
          setBookings([]);
          setLoading(false);
          return;
        }

        const { data: created } = await supabase
          .from("bookings")
          .select("*")
          .eq("agency_id", agency.id)
          .order("event_date", { ascending: false });

        const createdRows = (created ?? []).map((row: any) => ({
          row,
          source: "created" as const,
        }));

        const { data: agencyShifts } = await supabase
          .from("shifts")
          .select("booking_id")
          .eq("agency_id", agency.id);
        const createdIds = new Set(createdRows.map((b) => b.row.id));
        const assignedIds = [
          ...new Set(
            (agencyShifts ?? [])
              .map((s: any) => s.booking_id)
              .filter((id: string | null): id is string => Boolean(id) && !createdIds.has(id)),
          ),
        ];

        let assignedRows: { row: any; source: "assigned" }[] = [];
        if (assignedIds.length > 0) {
          const { data: assigned } = await supabase
            .from("bookings")
            .select("*")
            .in("id", assignedIds)
            .order("event_date", { ascending: false });
          assignedRows = (assigned ?? []).map((row: any) => ({
            row,
            source: "assigned" as const,
          }));
        }

        baseRows = [...createdRows, ...assignedRows];
      } else {
        if (userLoading) return;
        if (!user) {
          setLoading(false);
          return;
        }

        let venue: { id: string } | null = null;
        const { data: venueByUser } = await supabase
          .from("venues")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (venueByUser) {
          venue = venueByUser;
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .single();
          if (profile) {
            const { data: venueByProfile } = await supabase
              .from("venues")
              .select("id")
              .eq("user_id", profile.id)
              .single();
            if (venueByProfile) venue = venueByProfile;
          }
        }

        if (!venue) {
          setLoading(false);
          return;
        }

        const { data: bookingsData } = await supabase
          .from("bookings")
          .select("*")
          .eq("venue_id", venue.id)
          .order("event_date", { ascending: false });

        baseRows = (bookingsData ?? []).map((row: any) => ({
          row,
          source: "created" as const,
        }));
      }

      if (baseRows.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const enrichedBookings: Booking[] = [];

      for (const { row: booking, source } of baseRows) {
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, role, personnel_id, status")
          .eq("booking_id", booking.id);

        const guards: Guard[] = [];
        let claimedShifts = 0;

        if (shifts) {
          const personnelIds = shifts.filter((s) => s.personnel_id).map((s) => s.personnel_id);
          claimedShifts = personnelIds.length;

          if (personnelIds.length > 0) {
            const uniquePersonnelIds = [...new Set(personnelIds)];
            const { data: personnelData } = await supabase
              .from("personnel")
              .select("id, display_name, shield_score, city, total_shifts")
              .in("id", uniquePersonnelIds);

            if (personnelData && personnelData.length > 0) {
              for (const shift of shifts) {
                if (shift.personnel_id) {
                  const person = personnelData.find((p) => p.id === shift.personnel_id);
                  if (person) {
                    guards.push({
                      id: person.id,
                      display_name: person.display_name,
                      shield_score: person.shield_score || 0,
                      photo_url: null,
                      city: person.city,
                      total_shifts: person.total_shifts || 0,
                      role: shift.role,
                    });
                  }
                }
              }
            }
          }
        }

        const isPaidFromBooking = (booking as any).payment_status === "paid";

        enrichedBookings.push({
          id: booking.id,
          event_name: booking.event_name,
          event_date: booking.event_date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
          estimated_total: booking.estimated_total || 0,
          staff_requirements: booking.staff_requirements || [],
          guards,
          totalShifts: shifts?.length || 0,
          claimedShifts,
          isPaid: isPaidFromBooking,
          paidAt: isPaidFromBooking ? (booking as any).updated_at : null,
          source,
        });
      }

      const bookingIds = enrichedBookings.map((b) => b.id);
      if (bookingIds.length > 0) {
        const { data: payments } = await supabase
          .from("transactions")
          .select("booking_id, status, created_at")
          .in("booking_id", bookingIds);

        if (payments) {
          const succeededPayments = payments.filter((p) => p.status === "succeeded");
          for (const payment of succeededPayments) {
            const booking = enrichedBookings.find((b) => b.id === payment.booking_id);
            if (booking && !booking.isPaid) {
              booking.isPaid = true;
              booking.paidAt = payment.created_at;
            }
          }
        }
      }

      setBookings(enrichedBookings);
      setLoading(false);
    }

    fetchBookings();
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, [isAgency, user, userLoading, agency?.id, agencyLoading, supabase]);

  const filterCounts = useMemo(
    () => ({
      all: bookings.length,
      pending: bookings.filter((b) => b.claimedShifts === 0).length,
      confirmed: bookings.filter(
        (b) => b.claimedShifts > 0 && !b.isPaid && b.status !== "completed",
      ).length,
      completed: bookings.filter((b) => b.status === "completed").length,
      paid: bookings.filter((b) => b.isPaid).length,
    }),
    [bookings],
  );

  const pipelineValue = useMemo(
    () => bookings.reduce((sum, b) => sum + getBookingTotalGBP(b), 0),
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    let rows = bookings.filter((b) => {
      if (filter === "confirmed") {
        return b.claimedShifts > 0 && !b.isPaid && b.status !== "completed";
      }
      if (filter === "pending") return b.claimedShifts === 0;
      if (filter === "completed") return b.status === "completed";
      if (filter === "paid") return b.isPaid;
      return true;
    });

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          b.event_name.toLowerCase().includes(q) ||
          b.guards.some((g) => g.display_name.toLowerCase().includes(q)),
      );
    }

    rows.sort((a, b) => {
      if (sort === "value_desc") {
        return getBookingTotalGBP(b) - getBookingTotalGBP(a);
      }
      const da = bookingSortDate(a);
      const db = bookingSortDate(b);
      return sort === "date_asc" ? da - db : db - da;
    });

    return rows;
  }, [bookings, filter, search, sort]);

  const groupedBookings = useMemo(() => {
    const groups: { phase: BookingPhase; label: string; items: Booking[] }[] = [
      { phase: "today", label: "Today", items: [] },
      { phase: "upcoming", label: "Upcoming", items: [] },
      { phase: "past", label: "Past", items: [] },
    ];
    for (const b of filteredBookings) {
      const phase = getBookingPhase(b);
      groups.find((g) => g.phase === phase)?.items.push(b);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filteredBookings]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-shield-400">
            Operations
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Your Jobs</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            {bookings.length} job{bookings.length !== 1 ? "s" : ""} · £
            {pipelineValue.toLocaleString("en-GB", { maximumFractionDigits: 0 })} total pipeline
          </p>
        </div>
        <Link href={`${basePath}/bookings/new`}>
          <motion.button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-shield-400"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Post new job
          </motion.button>
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FILTER_TABS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`group relative overflow-hidden rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-shield-500/40 bg-shield-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              {active && (
                <span className="absolute inset-y-0 left-0 w-0.5 bg-shield-400" />
              )}
              <p
                className={`text-2xl font-bold tabular-nums ${
                  active ? "text-white" : "text-zinc-200"
                }`}
              >
                {filterCounts[key]}
              </p>
              <p className="mt-0.5 text-xs font-medium text-zinc-500 group-hover:text-zinc-400">
                {label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs or guards…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/40 focus:ring-2 focus:ring-shield-500/20"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-zinc-300 outline-none transition focus:border-shield-500/40"
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="value_desc">Highest value</option>
        </select>
      </div>

      {/* List */}
      {filteredBookings.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10">
          <EmptyState
            icon="📋"
            title={search ? "No matches" : "No jobs yet"}
            description={
              search
                ? "Try a different search term or clear the filter."
                : "Post your first job to find security staff for your events."
            }
            action={
              !search ? (
                <EmptyStateCTA href={`${basePath}/bookings/new`}>Post a job</EmptyStateCTA>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groupedBookings.map(({ phase, label, items }) => (
            <section key={phase}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  {label}
                </h2>
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs tabular-nums text-zinc-600">{items.length}</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <AnimatePresence initial={false}>
                  {items.map((booking, index) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      basePath={basePath}
                      isLast={index === items.length - 1}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  basePath,
  isLast,
}: {
  booking: Booking;
  basePath: string;
  isLast: boolean;
}) {
  const displayTotal = getBookingTotalGBP(booking);
  const canPay = booking.source === "created";
  const dateParts = formatEventDate(booking.event_date);
  const status = getStatusMeta(booking);
  const staffingPct = getStaffingPct(booking);
  const needsPayment = canPay && !booking.isPaid && booking.claimedShifts > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`group ${!isLast ? "border-b border-white/[0.06]" : ""}`}
    >
      <Link
        href={`${basePath}/bookings/${booking.id}`}
        className="flex items-stretch gap-0 transition hover:bg-white/[0.04]"
      >
        {/* Date column */}
        <div className="hidden w-[72px] shrink-0 flex-col items-center justify-center border-r border-white/[0.06] bg-white/[0.02] py-4 sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {dateParts.month}
          </span>
          <span className="text-2xl font-bold tabular-nums leading-none text-white">
            {dateParts.day}
          </span>
          <span className="mt-0.5 text-[10px] text-zinc-500">{dateParts.weekday}</span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-white group-hover:text-shield-300 transition-colors">
                  {booking.event_name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE_STYLES[status.tone]}`}
                >
                  {status.dot && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  )}
                  {status.label}
                </span>
                {booking.source === "assigned" && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_STYLES.sky}`}>
                    Venue contract
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-zinc-400">
                <span className="sm:hidden">{dateParts.weekday} {dateParts.day} {dateParts.month} · </span>
                {formatTimeShort(booking.start_time)} – {formatTimeShort(booking.end_time)}
              </p>

              {/* Staffing bar */}
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      staffingPct >= 100
                        ? "bg-emerald-500"
                        : staffingPct > 0
                          ? "bg-shield-500"
                          : "bg-amber-500/60"
                    }`}
                    style={{ width: `${Math.max(staffingPct, booking.claimedShifts === 0 ? 8 : 0)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500">
                  {booking.claimedShifts}/{booking.totalShifts} staffed
                </span>
              </div>

              {/* Guard avatars */}
              {booking.guards.length > 0 ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {booking.guards.slice(0, 4).map((guard, i) => (
                      <div
                        key={`${guard.id}-${i}`}
                        title={guard.display_name}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0d1117] bg-gradient-to-br from-shield-500/80 to-teal-600/80 text-[10px] font-bold text-white"
                      >
                        {guard.display_name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {booking.guards.length > 4 && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0d1117] bg-white/10 text-[10px] font-medium text-zinc-300">
                        +{booking.guards.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="truncate text-xs text-zinc-500">
                    {booking.guards.map((g) => g.display_name).join(", ")}
                  </span>
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  Live on job board — guards can claim instantly
                </p>
              )}
            </div>

            {/* Value + chevron */}
            <div className="flex shrink-0 items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-white">
                  £{displayTotal.toFixed(0)}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {booking.totalShifts} shift{booking.totalShifts !== 1 ? "s" : ""}
                </p>
              </div>
              <svg
                className="h-5 w-5 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>

      {/* Inline pay action — only when actionable */}
      {needsPayment && (
        <div className="border-t border-white/[0.06] bg-shield-500/[0.04] px-4 py-2.5 sm:pl-[calc(72px+1.25rem)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              Team confirmed — secure payment to lock in coverage
            </p>
            <Link
              href={`${basePath}/bookings/${booking.id}/pay`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-lg bg-shield-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-shield-400"
            >
              Pay £{displayTotal.toFixed(0)}
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
