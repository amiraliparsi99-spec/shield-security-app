"use client";

import Link from "next/link";
import type { Booking } from "@/types/database";
import { formatRequestDate, formatTimeRange } from "@/lib/format";

export type EnrichedBooking = Booking & {
  provider_name: string;
  provider_profile_href: string;
};

interface VenueBookingsListProps {
  bookings: EnrichedBooking[];
}

export function VenueBookingsList({ bookings }: VenueBookingsListProps) {
  if (bookings.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-zinc-500">
        No bookings yet. When you confirm shifts with personnel or agencies, they’ll appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <Link
          key={b.id}
          href={b.provider_profile_href}
          className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-shield-500/25 hover:bg-white/[0.06]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{b.provider_name}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
              {b.provider_type === "personnel" ? "Personnel" : "Agency"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                b.status === "confirmed"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : b.status === "completed"
                    ? "bg-zinc-500/20 text-zinc-400"
                    : b.status === "cancelled"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {b.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {formatRequestDate(b.start)}
            {b.end ? ` · ${formatTimeRange(b.start, b.end)}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {b.guards_count} guard{b.guards_count !== 1 ? "s" : ""}
            {b.rate != null ? ` · £${(b.rate / 100).toFixed(2)}` : ""}
          </p>
          <p className="mt-2 text-xs text-shield-400">View {b.provider_type} profile →</p>
        </Link>
      ))}
    </div>
  );
}
