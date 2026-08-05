"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAgencyShiftGpsSummaries,
  getAgencyIdForUser,
  type ShiftGpsSummary,
} from "@/lib/agency/gpsTrackingQueries";

const StaffTrackingMap = dynamic(
  () => import("@/components/maps/StaffTrackingMap").then((mod) => mod.StaffTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-zinc-900/50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    ),
  },
);

type DateFilter = "today" | "week" | "month";

function sinceIsoForFilter(filter: DateFilter): string {
  const d = new Date();
  if (filter === "today") {
    d.setHours(0, 0, 0, 0);
  } else if (filter === "week") {
    d.setDate(d.getDate() - 7);
  } else {
    d.setDate(d.getDate() - 30);
  }
  return d.toISOString();
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function GpsHistoryPage() {
  const [summaries, setSummaries] = useState<ShiftGpsSummary[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const agencyId = await getAgencyIdForUser(supabase, user.id);
      if (!agencyId) {
        setSummaries([]);
        return;
      }

      const rows = await fetchAgencyShiftGpsSummaries(
        supabase,
        agencyId,
        sinceIsoForFilter(dateFilter),
      );
      setSummaries(rows);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("GPS history load failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const withGps = summaries.filter((s) => s.pointCount > 0);
  const onShiftNow = summaries.filter(
    (s) => s.shiftStatus === "checked_in" || s.shiftStatus === "accepted",
  );

  const mapStaff = useMemo(
    () =>
      withGps
        .filter((s) => s.latestLat != null && s.latestLng != null)
        .map((s) => ({
          id: s.shiftId,
          name: s.guardName,
          lat: s.latestLat!,
          lng: s.latestLng!,
          isOnShift: s.shiftStatus === "checked_in" || s.shiftStatus === "accepted",
          venueName: s.siteLabel ?? s.eventName,
          lastUpdated: s.lastRecordedAt ?? s.scheduledStart,
        })),
    [withGps],
  );

  const totalPoints = withGps.reduce((n, s) => n + s.pointCount, 0);

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">GPS History</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review location trails from completed and active shifts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/d/agency/live"
            className="inline-flex items-center gap-2 rounded-lg bg-shield-500/20 px-3 py-2 text-sm font-medium text-shield-300 transition hover:bg-shield-500/30"
          >
            Live map →
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-shield-500/25 bg-shield-500/5 p-4">
        <p className="text-sm text-zinc-300">
          <span className="font-medium text-white">Live tracking</span> is on{" "}
          <Link href="/d/agency/live" className="text-shield-400 hover:text-shield-300">
            Operations → Live Tracking
          </Link>
          . Guards appear on the map once they are within 1 hour of shift start and location
          is enabled on their phone.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["today", "Today"],
            ["week", "Last 7 days"],
            ["month", "Last 30 days"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDateFilter(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              dateFilter === key
                ? "bg-shield-500/20 text-shield-300"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-semibold text-white">{withGps.length}</p>
          <p className="text-sm text-zinc-400">Shifts with GPS</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-semibold text-white">{totalPoints}</p>
          <p className="text-sm text-zinc-400">Location points</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-semibold text-blue-400">{onShiftNow.length}</p>
          <p className="text-sm text-zinc-400">Assigned shifts</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm font-medium text-white">
            {lastUpdated ? formatWhen(lastUpdated.toISOString()) : "—"}
          </p>
          <p className="text-sm text-zinc-400">Last refreshed</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="border-b border-white/[0.06] p-4">
              <h2 className="font-medium text-white">Latest positions</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Most recent GPS fix per shift in this period</p>
            </div>
            <StaffTrackingMap
              staffLocations={mapStaff}
              selectedStaffId={selectedShiftId}
              onStaffSelect={setSelectedShiftId}
              className="aspect-[16/10]"
            />
          </div>
        </div>

        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="font-medium text-white">Shift log</h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
              </div>
            ) : summaries.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                No shifts in this period. Assign guards and ensure they grant location on mobile.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {summaries.map((s) => (
                  <Link
                    key={s.shiftId}
                    href={`/d/agency/tracking/${s.personnelId}?shift=${s.shiftId}`}
                    className={`block p-4 transition hover:bg-white/[0.03] ${
                      selectedShiftId === s.shiftId ? "bg-shield-500/10" : ""
                    }`}
                    onMouseEnter={() => setSelectedShiftId(s.shiftId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{s.guardName}</p>
                        <p className="truncate text-xs text-zinc-400">
                          {s.eventName}
                          {s.siteLabel ? ` · ${s.siteLabel}` : ""}
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">
                          {new Date(s.scheduledStart).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {s.shiftStatus.replace("_", " ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {s.pointCount > 0 ? (
                          <>
                            <p className="text-sm font-medium text-emerald-400">{s.pointCount} pts</p>
                            <p className="text-[11px] text-zinc-500">
                              {s.lastRecordedAt ? formatWhen(s.lastRecordedAt) : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-zinc-600">No GPS</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
