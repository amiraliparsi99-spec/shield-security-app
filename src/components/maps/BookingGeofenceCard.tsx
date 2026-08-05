"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GeoJsonPolygon } from "@/lib/geo/polygon";

const GeofenceEditor = dynamic(
  () => import("@/components/maps/GeofenceEditor").then((m) => m.GeofenceEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-lg bg-white/5" />
    ),
  },
);

export interface BookingGeofenceCardProps {
  bookingId: string;
  siteLat: number | null;
  siteLng: number | null;
  initialPolygon?: GeoJsonPolygon | null;
  /** When false, renders a read-only note instead of the editor. */
  editable?: boolean;
  className?: string;
}

/**
 * Card for viewing/editing the on-site boundary of a single booking. Saves via
 * the authorize-by-relationship PATCH route so both venues and the assigned
 * agency can use it without broad table RLS.
 */
export function BookingGeofenceCard({
  bookingId,
  siteLat,
  siteLng,
  initialPolygon = null,
  editable = true,
  className = "",
}: BookingGeofenceCardProps) {
  const [polygon, setPolygon] = useState<GeoJsonPolygon | null>(initialPolygon);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const hasCoords =
    typeof siteLat === "number" &&
    typeof siteLng === "number" &&
    Number.isFinite(siteLat) &&
    Number.isFinite(siteLng);

  const save = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/geofence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ polygon }),
      });
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`glass rounded-2xl p-6 ${className}`}>
      <h3 className="font-display text-lg font-medium text-white">
        On-site boundary
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        Draw the area guards work in. Anyone inside it counts as on-site at
        check-in — useful when the entrance pin is far from where guards are
        posted.
      </p>

      {!hasCoords ? (
        <p className="mt-4 text-sm text-amber-400">
          This booking has no check-in pin yet, so a boundary can&apos;t be
          drawn.
        </p>
      ) : !editable ? (
        <p className="mt-4 text-sm text-zinc-400">
          {polygon
            ? "A custom on-site boundary is set for this booking."
            : "No custom boundary — radius check-in is used."}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <GeofenceEditor
            siteLat={siteLat as number}
            siteLng={siteLng as number}
            value={polygon}
            onChange={setPolygon}
            className="h-[320px] w-full"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-shield-400 disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : status === "saved"
                  ? "Saved!"
                  : "Save boundary"}
            </button>
            {status === "error" && (
              <span className="text-xs text-red-400">
                Couldn&apos;t save — try again.
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {polygon ? "Boundary set." : "No boundary — radius used."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
