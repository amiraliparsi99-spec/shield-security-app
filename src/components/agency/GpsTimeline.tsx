"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clusterGpsIntoStops,
  formatDwellDuration,
  formatTimeRange,
  geocodeCacheKey,
  shortPlaceLabel,
  type GpsTimelinePoint,
  type GpsDwellStop,
} from "@/lib/geo/gpsTimeline";

type GpsTimelineProps = {
  logs: GpsTimelinePoint[];
  guardName: string;
  dateFilter: string;
};

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function GpsTimeline({ logs, guardName, dateFilter }: GpsTimelineProps) {
  const stops = useMemo(() => clusterGpsIntoStops(logs), [logs]);
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (stops.length === 0) return;

    const pending = Array.from(
      new Map(
        stops.map((s) => {
          const key = geocodeCacheKey(s.lat, s.lng);
          return [key, { key, lat: s.lat, lng: s.lng }] as const;
        }),
      ).values(),
    ).filter((item) => !fetchedRef.current.has(item.key));

    if (pending.length === 0) return;

    let cancelled = false;
    setLoadingPlaces(true);

    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        pending.map(async ({ key, lat, lng }) => {
          fetchedRef.current.add(key);
          try {
            const res = await fetch(
              `/api/geocode/reverse?lat=${lat}&lng=${lng}`,
            );
            if (!res.ok) return;
            const data = (await res.json()) as { place_name?: string };
            if (data.place_name) {
              updates[key] = shortPlaceLabel(data.place_name);
            }
          } catch {
            /* coordinate fallback shown in UI */
          }
        }),
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setPlaceNames((prev) => ({ ...prev, ...updates }));
      }
      if (!cancelled) setLoadingPlaces(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [stops]);

  const groupedStops = useMemo(() => {
    const groups: Record<string, GpsDwellStop[]> = {};
    for (const stop of stops) {
      const day = dayKey(stop.startAt);
      if (!groups[day]) groups[day] = [];
      groups[day].push(stop);
    }
    return groups;
  }, [stops]);

  const exportCsv = () => {
    const csv = [
      ["Date", "Time range", "Location", "Duration", "GPS points"].join(","),
      ...stops.map((s) => {
        const key = geocodeCacheKey(s.lat, s.lng);
        const place =
          placeNames[key] ?? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`;
        return [
          new Date(s.startAt).toLocaleDateString("en-GB"),
          formatTimeRange(s.startAt, s.endAt),
          `"${place.replace(/"/g, '""')}"`,
          formatDwellDuration(s.durationMs, s.pointCount),
          s.pointCount,
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gps-timeline-${guardName.replace(/\s+/g, "-")}-${dateFilter}.csv`;
    a.click();
  };

  if (logs.length === 0) {
    return <p className="p-8 text-center text-sm text-zinc-500">No points to show</p>;
  }

  return (
    <>
      <div className="border-b border-white/[0.06] px-4 py-2 flex items-center justify-between">
        <p className="text-[11px] text-zinc-500">
          {stops.length} location{stops.length !== 1 ? "s" : ""}
          {loadingPlaces ? " · resolving addresses…" : ""}
        </p>
        <button
          type="button"
          className="text-xs text-shield-400 hover:text-shield-300"
          onClick={exportCsv}
        >
          Export CSV
        </button>
      </div>
      <div className="divide-y divide-white/[0.06] max-h-[480px] overflow-y-auto">
        {Object.entries(groupedStops).map(([day, dayStops]) => (
          <div key={day}>
            <div className="sticky top-0 bg-zinc-900/90 px-4 py-2 backdrop-blur">
              <p className="text-xs font-medium text-zinc-500">{day}</p>
            </div>
            {dayStops.map((stop) => {
              const key = geocodeCacheKey(stop.lat, stop.lng);
              const place = placeNames[key];
              const duration = formatDwellDuration(stop.durationMs, stop.pointCount);

              return (
                <div
                  key={stop.id}
                  className="px-4 py-3 hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-shield-500/15 text-sm">
                      📍
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white leading-snug">
                        {place ?? (
                          <span className="text-zinc-400 font-normal">
                            {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatTimeRange(stop.startAt, stop.endAt)}
                        <span className="mx-1.5 text-zinc-700">·</span>
                        <span className="text-shield-400/90 font-medium">
                          {duration}
                        </span>
                        {stop.pointCount > 1 && (
                          <>
                            <span className="mx-1.5 text-zinc-700">·</span>
                            {stop.pointCount} pings
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
