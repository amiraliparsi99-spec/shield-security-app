"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPersonnelGpsHistory,
  getAgencyIdForUser,
  type GpsLogRow,
} from "@/lib/agency/gpsTrackingQueries";
import { GpsTimeline } from "@/components/agency/GpsTimeline";

const StaffTrackingMap = dynamic(
  () => import("@/components/maps/StaffTrackingMap").then((mod) => mod.StaffTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-zinc-900/50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    ),
  },
);

type DateFilter = "today" | "week" | "month";

function sinceIsoForFilter(filter: DateFilter): string {
  const d = new Date();
  if (filter === "today") d.setHours(0, 0, 0, 0);
  else if (filter === "week") d.setDate(d.getDate() - 7);
  else d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export default function PersonnelGpsHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const personnelId = params.id as string;
  const focusShiftId = searchParams.get("shift");

  const [guardName, setGuardName] = useState("Guard");
  const [logs, setLogs] = useState<GpsLogRow[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string | "all">(
    focusShiftId ?? "all",
  );

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
        router.push("/d/agency/tracking");
        return;
      }

      const { data: personnel } = await supabase
        .from("personnel")
        .select("display_name")
        .eq("id", personnelId)
        .maybeSingle();

      if (personnel?.display_name) setGuardName(personnel.display_name);

      const { logs: historyLogs } = await fetchPersonnelGpsHistory(
        supabase,
        agencyId,
        personnelId,
        sinceIsoForFilter(dateFilter),
      );
      setLogs(historyLogs);
    } catch (e) {
      console.error("Personnel GPS history failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [personnelId, dateFilter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusShiftId) setSelectedShiftFilter(focusShiftId);
  }, [focusShiftId]);

  const shiftIds = useMemo(
    () => Array.from(new Set(logs.map((l) => l.shift_id))),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    if (selectedShiftFilter === "all") return logs;
    return logs.filter((l) => l.shift_id === selectedShiftFilter);
  }, [logs, selectedShiftFilter]);

  const trailPaths = useMemo(() => {
    const byShift = new Map<string, [number, number][]>();
    for (const row of [...filteredLogs].reverse()) {
      if (!byShift.has(row.shift_id)) byShift.set(row.shift_id, []);
      byShift.get(row.shift_id)!.push([row.lng, row.lat]);
    }
    return Array.from(byShift.entries()).map(([id, coordinates]) => ({
      id,
      coordinates,
    }));
  }, [filteredLogs]);

  const latestPin = filteredLogs[0];

  const mapStaff = latestPin
    ? [
        {
          id: latestPin.shift_id,
          name: guardName,
          lat: latestPin.lat,
          lng: latestPin.lng,
          isOnShift: false,
          lastUpdated: latestPin.recorded_at,
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <Link
        href="/d/agency/tracking"
        className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        ← Back to GPS History
      </Link>

      <div className="mx-auto max-w-4xl">
        <div className="glass mb-6 rounded-2xl p-6">
          <h1 className="font-display text-2xl font-semibold text-white">{guardName}</h1>
          <p className="text-zinc-400">Location trail · {filteredLogs.length} points</p>
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

        {shiftIds.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedShiftFilter("all")}
              className={`rounded-full px-3 py-1 text-xs ${
                selectedShiftFilter === "all"
                  ? "bg-shield-500/25 text-shield-300"
                  : "bg-white/5 text-zinc-400"
              }`}
            >
              All shifts
            </button>
            {shiftIds.map((sid) => (
              <button
                key={sid}
                type="button"
                onClick={() => setSelectedShiftFilter(sid)}
                className={`rounded-full px-3 py-1 text-xs font-mono ${
                  selectedShiftFilter === sid
                    ? "bg-shield-500/25 text-shield-300"
                    : "bg-white/5 text-zinc-400"
                }`}
              >
                {sid.slice(0, 8)}…
              </button>
            ))}
          </div>
        )}

        <div className="glass mb-6 overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="font-medium text-white">Route map</h2>
          </div>
          {filteredLogs.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-zinc-500">No GPS data for this period</p>
              <p className="mt-2 text-xs text-zinc-600 max-w-sm">
                Points are recorded when the guard has location enabled during an active shift
                window. Check Live Tracking while they are on shift.
              </p>
              <Link
                href="/d/agency/live"
                className="mt-4 text-sm text-shield-400 hover:text-shield-300"
              >
                Open live map →
              </Link>
            </div>
          ) : (
            <StaffTrackingMap
              staffLocations={mapStaff}
              trailPaths={trailPaths}
              className="aspect-[16/9]"
            />
          )}
        </div>

        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="font-medium text-white">Timeline</h2>
          </div>
          <GpsTimeline
            logs={filteredLogs}
            guardName={guardName}
            dateFilter={dateFilter}
          />
        </div>
      </div>
    </div>
  );
}
