"use client";

import { useMemo, useState } from "react";
import type { Personnel } from "@/types/database";
import type { Agency } from "@/lib/dashboard-mock";
import type { EnrichedBooking } from "./VenueBookingsList";
import { formatLocation } from "@/lib/format";
import { AgenciesList } from "./AgenciesList";
import { SecurityList } from "./SecurityList";
import { VenueBookingsList } from "./VenueBookingsList";
import { LiveMap } from "./LiveMap";

type Tab = "live" | "personnel" | "agencies" | "bookings";

interface VenueDashboardTabsProps {
  personnel: Personnel[];
  agencies: Agency[];
  bookings: EnrichedBooking[];
}

function filterPersonnel(personnel: Personnel[], q: string): Personnel[] {
  if (!q.trim()) return personnel;
  const lower = q.trim().toLowerCase();
  return personnel.filter(
    (p) =>
      p.display_name.toLowerCase().includes(lower) ||
      formatLocation(p).toLowerCase().includes(lower) ||
      (p.certs && p.certs.some((c) => c.toLowerCase().includes(lower)))
  );
}

function filterAgencies(agencies: Agency[], q: string): Agency[] {
  if (!q.trim()) return agencies;
  const lower = q.trim().toLowerCase();
  return agencies.filter(
    (a) =>
      a.name.toLowerCase().includes(lower) ||
      (a.location_name && a.location_name.toLowerCase().includes(lower)) ||
      (a.address && a.address.toLowerCase().includes(lower)) ||
      a.types.some((t) => t.toLowerCase().includes(lower)) ||
      (a.description && a.description.toLowerCase().includes(lower))
  );
}

export function VenueDashboardTabs({
  personnel,
  agencies,
  bookings,
}: VenueDashboardTabsProps) {
  const [tab, setTab] = useState<Tab>("live");
  const [search, setSearch] = useState("");

  const filteredPersonnel = useMemo(() => filterPersonnel(personnel, search), [personnel, search]);
  const filteredAgencies = useMemo(() => filterAgencies(agencies, search), [agencies, search]);
  const filteredBookings = useMemo(() => {
    if (!search.trim()) return bookings;
    const lower = search.trim().toLowerCase();
    return bookings.filter(
      (b) =>
        b.provider_name.toLowerCase().includes(lower) ||
        b.provider_type.toLowerCase().includes(lower)
    );
  }, [bookings, search]);

  const searchPlaceholder =
    tab === "personnel"
      ? "Search by name, location or certs…"
      : tab === "agencies"
        ? "Search agencies, type, or location…"
        : tab === "bookings"
          ? "Search by provider name…"
          : "Search available guards..."; // Fallback for 'live'

  return (
    <div className="min-h-0 flex-1 flex flex-col">
      <div className="shrink-0 px-4 pt-4 sm:px-6">
        <div className="flex rounded-xl bg-white/[0.04] p-1">
          {(["live", "personnel", "agencies", "bookings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition ${
                tab === t
                  ? "bg-shield-500/20 text-shield-400 shadow-sm"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              {t === "live" ? "Live View" : t === "personnel" ? "Personnel" : t === "agencies" ? "Agencies" : "Bookings"}
            </button>
          ))}
        </div>
      </div>

      {tab !== "live" && (
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-3 sm:px-6">
          <label className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 transition focus:border-shield-500/40 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-shield-500/30"
              aria-label="Search"
            />
          </label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === "live" && (
          <div className="p-4 sm:p-6 h-full">
             <div className="mb-4">
              <h2 className="text-sm font-medium text-zinc-500">Real-time Availability</h2>
              <p className="mt-1 text-xs text-zinc-600">
                View active personnel nearby and broadcast urgent shift requests.
              </p>
            </div>
            <LiveMap personnel={personnel} />
          </div>
        )}

        {tab === "personnel" && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Available for work</h2>
              <p className="mt-1 text-xs text-zinc-600">
                Tap a profile to view details, reviews, and book.
              </p>
            </div>
            {filteredPersonnel.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">No personnel match your search.</p>
            ) : (
              <SecurityList personnel={filteredPersonnel} />
            )}
          </div>
        )}

        {tab === "agencies" && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Security agencies</h2>
              <p className="mt-1 text-xs text-zinc-600">
                Browse agencies. Tap for details.
              </p>
            </div>
            {filteredAgencies.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">No agencies match your search.</p>
            ) : (
              <AgenciesList agencies={filteredAgencies} />
            )}
          </div>
        )}

        {tab === "bookings" && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Your bookings</h2>
              <p className="mt-1 text-xs text-zinc-600">
                Confirmed shifts with personnel or agencies. Tap a booking to view that provider’s profile.
              </p>
            </div>
            <VenueBookingsList bookings={filteredBookings} />
          </div>
        )}
      </div>
    </div>
  );
}
