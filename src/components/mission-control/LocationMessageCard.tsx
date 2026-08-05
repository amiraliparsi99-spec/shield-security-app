"use client";

import { getMessageCoordinates, googleMapsUrl, mapboxStaticImageUrl } from "@/lib/mission-control/locationMessage";

type Props = {
  metadata: Record<string, unknown> | null | undefined;
  fallbackLabel?: string;
  className?: string;
};

export function LocationMessageCard({ metadata, fallbackLabel, className = "" }: Props) {
  const coords = getMessageCoordinates(metadata);
  if (!coords) return null;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapsUrl = googleMapsUrl(coords.lat, coords.lng);
  const label = coords.label || fallbackLabel || "Shared location";

  return (
    <div className={`mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40 ${className}`}>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
        aria-label={`View ${label} on map`}
      >
        {token ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapboxStaticImageUrl(coords.lat, coords.lng, token)}
            alt={`Map showing ${label}`}
            className="h-36 w-full object-cover opacity-90 group-hover:opacity-100 transition"
          />
        ) : (
          <div className="flex h-28 items-center justify-center bg-zinc-900/80 text-4xl">📍</div>
        )}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-white/5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{label}</p>
            <p className="text-[11px] text-zinc-500 font-mono">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-shield-500/20 border border-shield-500/40 px-3 py-1.5 text-xs font-semibold text-shield-200 group-hover:bg-shield-500/30 transition">
            View on map →
          </span>
        </div>
      </a>
    </div>
  );
}
