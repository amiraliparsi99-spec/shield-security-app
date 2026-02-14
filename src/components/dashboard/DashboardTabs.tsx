"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AGENCIES,
  AVAILABLE_PERSONNEL,
  BIRMINGHAM_CENTER,
  BIRMINGHAM_VENUES,
} from "@/lib/dashboard-mock";
import type { Agency, VenueWithRequests } from "@/lib/dashboard-mock";
import { formatLocation } from "@/lib/format";
import { AgenciesList } from "./AgenciesList";
import { SecurityList } from "./SecurityList";
import { VenuesList } from "./VenuesList";
import { VenuesWhenList } from "./VenuesWhenList";

const VenuesMap = dynamic(
  () => import("./VenuesMap").then((m) => ({ default: m.VenuesMap })),
  { ssr: false }
);

type Tab = "venues" | "security" | "agencies";

interface DashboardTabsProps {
  role?: "venue" | "personnel" | "agency" | null;
}

function filterVenues(venues: VenueWithRequests[], q: string): VenueWithRequests[] {
  if (!q.trim()) return venues;
  const lower = q.trim().toLowerCase();
  return venues.filter(
    (v) =>
      v.name.toLowerCase().includes(lower) ||
      (v.address && v.address.toLowerCase().includes(lower)) ||
      (v.venueType && v.venueType.toLowerCase().includes(lower)) ||
      v.openRequests.some((r) => r.title.toLowerCase().includes(lower))
  );
}

function filterPersonnel(q: string) {
  if (!q.trim()) return AVAILABLE_PERSONNEL;
  const lower = q.trim().toLowerCase();
  return AVAILABLE_PERSONNEL.filter(
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

type VenueSubView = "browse" | "when";

export function DashboardTabs({ role }: DashboardTabsProps) {
  const isVenue = role === "venue";
  const [tab, setTab] = useState<Tab>(isVenue ? "security" : "venues");
  const [venueSubView, setVenueSubView] = useState<VenueSubView>("browse");
  const [search, setSearch] = useState("");

  const filteredVenues = useMemo(() => filterVenues(BIRMINGHAM_VENUES, search), [search]);
  const filteredPersonnel = useMemo(() => filterPersonnel(search), [search]);
  const filteredAgencies = useMemo(() => filterAgencies(AGENCIES, search), [search]);

  const tabs = isVenue ? (["security", "agencies"] as const) : (["venues", "security", "agencies"] as const);

  return (
    <div className="min-h-0 flex-1 flex flex-col">
      {/* Tab bar */}
      <div className="shrink-0 px-4 pt-4 sm:px-6">
        <div className="flex glass rounded-xl p-1">
          {tabs.map((t) => (
            <motion.button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition ${
                tab === t
                  ? "text-shield-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {tab === t && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg bg-shield-500/20"
                  transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                />
              )}
              <span className="relative z-10">
                {t === "venues" ? "Venues" : t === "security" ? "Personnel" : "Agencies"}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Search bar */}
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
            placeholder={
              tab === "venues"
                ? "Search venues, address, type or request…"
                : tab === "agencies"
                ? "Search agencies, type, or location…"
                : "Search by name, location or certs…"
            }
            className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 transition focus:border-shield-500/40 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-shield-500/30"
            aria-label="Search"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          {tab === "venues" && !isVenue && (
            <motion.div
              key="venues"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full p-4 sm:p-6"
            >
              {/* Venues sub-tabs */}
              <div className="flex gap-1 glass rounded-lg p-1 mb-4 shrink-0">
                <motion.button
                  onClick={() => setVenueSubView("browse")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    venueSubView === "browse" ? "bg-shield-500/20 text-shield-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Map & list
                </motion.button>
                <motion.button
                  onClick={() => setVenueSubView("when")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    venueSubView === "when" ? "bg-shield-500/20 text-shield-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  When
                </motion.button>
              </div>

              {venueSubView === "browse" && (
                <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                  {/* Map on the left */}
                  <div className="flex-1 lg:flex-[0_0_50%] flex flex-col min-h-0">
                    <div className="mb-2 shrink-0">
                      <h2 className="text-base font-semibold text-white">Map: Birmingham venues that are hiring</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        All venues with open security requests. Tap a marker for details.
                      </p>
                    </div>
                    <div className="flex-1 min-h-0 rounded-xl overflow-hidden glass">
                      <VenuesMap venues={filteredVenues} center={BIRMINGHAM_CENTER} />
                    </div>
                  </div>
                  
                  {/* Venues list on the right */}
                  <div className="flex-1 lg:flex-[0_0_50%] flex flex-col min-h-0">
                    <div className="mb-2 shrink-0">
                      <h2 className="text-sm font-medium text-zinc-500">List by name</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {filteredVenues.length === 0 ? (
                        <p className="py-6 text-sm text-zinc-500">No venues match your search.</p>
                      ) : (
                        <VenuesList venues={filteredVenues} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {venueSubView === "when" && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <h2 className="text-base font-semibold text-white">When venues need security</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Shifts sorted by date. Tap <strong>Confirm availability</strong> as personnel or an agency to put yourself forward.
                  </p>
                  <div className="mt-4">
                    <VenuesWhenList venues={filteredVenues} />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 p-4 sm:p-6"
            >
              <div>
                <h2 className="text-sm font-medium text-zinc-500">Available for work</h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Tap a profile to view full details, reviews, and book.
                </p>
              </div>
              {filteredPersonnel.length === 0 ? (
                <p className="py-6 text-sm text-zinc-500">No personnel match your search.</p>
              ) : (
                <SecurityList personnel={filteredPersonnel} />
              )}
            </motion.div>
          )}

          {tab === "agencies" && (
            <motion.div
              key="agencies"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 p-4 sm:p-6"
            >
              <div>
                <h2 className="text-sm font-medium text-zinc-500">Security agencies</h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Browse agencies by type: door supervision, event, corporate, retail, stadium, CCTV, and more. Tap for details.
                </p>
              </div>
              {filteredAgencies.length === 0 ? (
                <p className="py-6 text-sm text-zinc-500">No agencies match your search.</p>
              ) : (
                <AgenciesList agencies={filteredAgencies} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
