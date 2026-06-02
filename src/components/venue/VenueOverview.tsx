"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export interface BookingSummary {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  guards_count: number;
  estimated_total: number | null;
  final_total: number | null;
}

interface VenueOverviewProps {
  venueName: string;
  metrics: {
    activeBookings: number;
    upcomingThisWeek: number;
    monthlySpend: number;
    guardsToday: number;
  };
  weekLabel?: string;
  spendLabel?: string;
  upcomingBookings: BookingSummary[];
  todayBookings: BookingSummary[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

interface MetricCard {
  key: string;
  title: string;
  field: keyof VenueOverviewProps["metrics"];
  subtitle?: string;
  isCurrency?: boolean;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  href: string;
}

function buildMetricsCards(weekLabel: string, spendLabel: string): MetricCard[] {
  return [
    {
      key: "active",
      title: "Active Bookings",
      field: "activeBookings",
      subtitle: "Pending & confirmed",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-emerald-500/20 to-emerald-600/5",
      iconBg: "bg-emerald-500/15 text-emerald-400",
      href: "/d/venue/bookings",
    },
    {
      key: "week",
      title: "This Week",
      field: "upcomingThisWeek",
      subtitle: weekLabel,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      gradient: "from-blue-500/20 to-blue-600/5",
      iconBg: "bg-blue-500/15 text-blue-400",
      href: "/d/venue/bookings",
    },
    {
      key: "spend",
      title: "Security Spend",
      field: "monthlySpend",
      subtitle: spendLabel,
      isCurrency: true,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-purple-500/20 to-purple-600/5",
      iconBg: "bg-purple-500/15 text-purple-400",
      href: "/d/venue/spend",
    },
  ];
}

const quickActions = [
  { href: "/d/venue/bookings/new", emoji: "🛡️", label: "Book Security" },
  { href: "/d/venue/live", emoji: "📍", label: "Live Check-In" },
  { href: "/d/venue/mission-control", emoji: "🎯", label: "Mission Control" },
  { href: "/d/venue/incidents", emoji: "⚠️", label: "Incidents" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDisplayValue(
  card: MetricCard,
  metrics: VenueOverviewProps["metrics"],
): string | number {
  const raw = metrics[card.field];
  if (card.isCurrency) {
    return `£${(raw as number).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return raw;
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

function formatTimeRange(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

function dayOfMonth(dateStr: string): number {
  try {
    return new Date(dateStr + "T00:00:00").getDate();
  } catch {
    return 0;
  }
}

export function VenueOverview({
  venueName,
  metrics,
  weekLabel = "Upcoming this week",
  spendLabel = "This month",
  upcomingBookings,
  todayBookings,
}: VenueOverviewProps) {
  const metricsCards = buildMetricsCards(weekLabel, spendLabel);
  const greeting = getGreeting();
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hasActiveOps = todayBookings.length > 0;
  const nextBooking = upcomingBookings[0] ?? null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-6xl space-y-6">
        {/* ── Header ── */}
        <motion.header variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              {greeting}, {venueName}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">{dateStr}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/d/venue/bookings/new"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow-sm transition hover:bg-purple-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Book Security
            </Link>
          </div>
        </motion.header>

        {/* ── Metrics Grid ── */}
        <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricsCards.map((card) => (
            <Link key={card.key} href={card.href}>
              <motion.div
                variants={fadeUp}
                className="glass group relative overflow-hidden rounded-2xl p-6 transition-all hover:shadow-glow-sm"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                <div className="relative">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                    {card.icon}
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">{card.title}</p>
                  <p className="mt-1 font-display text-3xl font-semibold text-white">
                    {formatDisplayValue(card, metrics)}
                  </p>
                  {card.subtitle && <p className="mt-1 text-sm text-zinc-500">{card.subtitle}</p>}
                </div>
              </motion.div>
            </Link>
          ))}
        </motion.div>

        {/* ── Security Pulse ── */}
        <motion.div variants={fadeUp} className="glass relative overflow-hidden rounded-2xl p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/[0.04] via-transparent to-emerald-500/[0.04]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                  hasActiveOps ? "bg-emerald-500/20" : "bg-zinc-500/10"
                }`}
              >
                {hasActiveOps && (
                  <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/10" />
                )}
                <svg
                  className={`relative h-7 w-7 ${hasActiveOps ? "text-emerald-400" : "text-zinc-500"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-white">Security Pulse</h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      hasActiveOps ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${hasActiveOps ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    {hasActiveOps ? "Active" : "No shifts today"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {hasActiveOps
                    ? `${metrics.guardsToday} guard${metrics.guardsToday !== 1 ? "s" : ""} covering ${todayBookings.length} booking${todayBookings.length !== 1 ? "s" : ""} today`
                    : nextBooking
                      ? `Next event: ${nextBooking.event_name} on ${formatEventDate(nextBooking.event_date)}`
                      : "No upcoming bookings scheduled"}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/d/venue/live"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live Check-In
              </Link>
              <Link
                href="/d/venue/mission-control"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.1]"
              >
                Mission Control
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Two-column body ── */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Upcoming Bookings — 3/5 */}
          <motion.div variants={fadeUp} className="lg:col-span-3">
            <div className="glass rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <h2 className="font-display text-lg font-medium text-white">Your Bookings</h2>
                <Link href="/d/venue/bookings" className="text-sm text-purple-400 transition hover:text-purple-300">
                  View all &rarr;
                </Link>
              </div>

              {upcomingBookings.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
                    <svg className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">No active bookings</p>
                  <Link
                    href="/d/venue/bookings/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-500/30"
                  >
                    Book security
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {upcomingBookings.slice(0, 5).map((b) => (
                    <Link
                      key={b.id}
                      href={`/d/venue/bookings/${b.id}`}
                      className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/[0.02]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 font-display text-sm font-semibold text-purple-400">
                        {dayOfMonth(b.event_date)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{b.event_name}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {formatEventDate(b.event_date)} · {formatTimeRange(b.start_time, b.end_time)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="hidden text-xs text-zinc-500 sm:inline">
                          {b.guards_count} guard{b.guards_count !== 1 ? "s" : ""}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            b.status === "confirmed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : b.status === "in_progress"
                                ? "bg-blue-500/20 text-blue-400"
                                : b.status === "pending"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-zinc-500/20 text-zinc-400"
                          }`}
                        >
                          {b.status === "in_progress" ? "In Progress" : b.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Right column — 2/5 */}
          <motion.div variants={fadeUp} className="space-y-6 lg:col-span-2">
            {/* Quick Actions */}
            <div className="glass rounded-2xl p-6">
              <h2 className="mb-4 font-display text-lg font-medium text-white">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-purple-500/20 hover:bg-white/[0.06]"
                  >
                    <span className="text-2xl">{a.emoji}</span>
                    <span className="text-xs font-medium text-zinc-300">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Today's Schedule */}
            {todayBookings.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-medium text-white">Today&apos;s Schedule</h2>
                  <Link href="/d/venue/live" className="text-xs text-purple-400 transition hover:text-purple-300">
                    Live view &rarr;
                  </Link>
                </div>
                <div className="space-y-3">
                  {todayBookings.map((b) => (
                    <Link
                      key={b.id}
                      href={`/d/venue/bookings/${b.id}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
                    >
                      <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{b.event_name}</p>
                        <p className="text-xs text-zinc-400">
                          {formatTimeRange(b.start_time, b.end_time)}
                          {" · "}
                          {b.guards_count} guard{b.guards_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty today state */}
            {todayBookings.length === 0 && (
              <div className="glass rounded-2xl p-6">
                <h2 className="mb-3 font-display text-lg font-medium text-white">Today&apos;s Schedule</h2>
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                  <p className="text-sm text-zinc-500">No security shifts today</p>
                  <Link
                    href="/d/venue/bookings/new"
                    className="mt-3 inline-flex text-xs font-medium text-purple-400 transition hover:text-purple-300"
                  >
                    Schedule a booking &rarr;
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
