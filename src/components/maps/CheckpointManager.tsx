"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl";
import type { MapLayerMouseEvent } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumnError } from "@/lib/postgresErrors";
import { outerRing, polygonCentroid, type GeoJsonPolygon } from "@/lib/geo/polygon";

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

interface Checkpoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius_m: number;
  sort_order: number;
}

export interface CheckpointManagerProps {
  bookingId: string;
  siteLat: number | null;
  siteLng: number | null;
  polygon?: GeoJsonPolygon | null;
  className?: string;
}

/**
 * Lets a venue/agency place patrol checkpoints inside the on-site zone. A guard
 * "visits" a checkpoint when their GPS comes within its radius during the shift,
 * giving proof they walked specific posts — not just that they were on site.
 */
export function CheckpointManager({
  bookingId,
  siteLat,
  siteLng,
  polygon = null,
  className = "",
}: CheckpointManagerProps) {
  const supabase = createClient();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasCoords =
    typeof siteLat === "number" &&
    typeof siteLng === "number" &&
    Number.isFinite(siteLat) &&
    Number.isFinite(siteLng);

  const center = useMemo(() => {
    const c = polygon ? polygonCentroid(polygon) : null;
    return {
      longitude: c?.lng ?? siteLng ?? -0.1276,
      latitude: c?.lat ?? siteLat ?? 51.5074,
      zoom: 16,
    };
  }, [polygon, siteLat, siteLng]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("booking_checkpoints")
      .select("id, label, lat, lng, radius_m, sort_order")
      .eq("booking_id", bookingId)
      .order("sort_order", { ascending: true });
    if (error) {
      if (
        isMissingColumnError(error) ||
        /relation .* does not exist|could not find the table/i.test(error.message)
      ) {
        setUnsupported(true);
      }
    } else {
      setCheckpoints((data as Checkpoint[]) ?? []);
    }
    setLoading(false);
  }, [supabase, bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const zoneData = useMemo(() => {
    const ring = polygon ? outerRing(polygon) : null;
    if (!ring) return null;
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Polygon" as const, coordinates: [ring] },
        },
      ],
    };
  }, [polygon]);

  const addCheckpoint = useCallback(
    async (lat: number, lng: number) => {
      if (busy) return;
      setBusy(true);
      try {
        const sort_order = checkpoints.length;
        const { data, error } = await supabase
          .from("booking_checkpoints")
          .insert({
            booking_id: bookingId,
            label: `Checkpoint ${sort_order + 1}`,
            lat,
            lng,
            radius_m: 30,
            sort_order,
          })
          .select("id, label, lat, lng, radius_m, sort_order")
          .single();
        if (!error && data) {
          setCheckpoints((prev) => [...prev, data as Checkpoint]);
        }
      } finally {
        setBusy(false);
      }
    },
    [supabase, bookingId, checkpoints.length, busy],
  );

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      void addCheckpoint(e.lngLat.lat, e.lngLat.lng);
    },
    [addCheckpoint],
  );

  const updateCheckpoint = useCallback(
    async (id: string, fields: Partial<Pick<Checkpoint, "label" | "radius_m">>) => {
      setCheckpoints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...fields } : c)),
      );
      await supabase.from("booking_checkpoints").update(fields).eq("id", id);
    },
    [supabase],
  );

  const deleteCheckpoint = useCallback(
    async (id: string) => {
      setCheckpoints((prev) => prev.filter((c) => c.id !== id));
      await supabase.from("booking_checkpoints").delete().eq("id", id);
    },
    [supabase],
  );

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (unsupported) {
    return (
      <div className={`glass rounded-2xl p-6 ${className}`}>
        <h3 className="font-display text-lg font-medium text-white">Patrol checkpoints</h3>
        <p className="mt-2 text-sm text-amber-400">
          Checkpoints need a database update (migration 0059). Apply it to place
          patrol points.
        </p>
      </div>
    );
  }

  return (
    <div className={`glass rounded-2xl p-6 ${className}`}>
      <h3 className="font-display text-lg font-medium text-white">Patrol checkpoints</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Tap the map to drop posts guards must reach (fire exits, perimeter
        corners, main door). A guard logs a visit automatically when they walk
        within range — proof of patrol, not just presence.
      </p>

      {!mapboxToken || !hasCoords ? (
        <p className="mt-4 text-sm text-amber-400">
          {!mapboxToken
            ? "Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the checkpoint map."
            : "Set a check-in pin for this booking first."}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="h-[320px] w-full overflow-hidden rounded-lg">
            <Map
              initialViewState={center}
              mapStyle={MAP_STYLE}
              mapboxAccessToken={mapboxToken}
              style={{ width: "100%", height: "100%" }}
              attributionControl={false}
              onClick={onMapClick}
            >
              <NavigationControl position="top-right" />
              {zoneData && (
                <Source id="cp-zone" type="geojson" data={zoneData}>
                  <Layer id="cp-zone-fill" type="fill" paint={{ "fill-color": "#10B981", "fill-opacity": 0.1 }} />
                  <Layer id="cp-zone-line" type="line" paint={{ "line-color": "#10B981", "line-width": 2, "line-opacity": 0.6 }} />
                </Source>
              )}
              {checkpoints.map((c, i) => (
                <Marker key={c.id} longitude={c.lng} latitude={c.lat} anchor="center">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-black shadow ring-2 ring-white/70">
                    {i + 1}
                  </div>
                </Marker>
              ))}
            </Map>
          </div>

          {loading ? (
            <div className="h-12 animate-pulse rounded-lg bg-white/5" />
          ) : checkpoints.length === 0 ? (
            <p className="text-xs text-zinc-500">No checkpoints yet — tap the map to add one.</p>
          ) : (
            <div className="space-y-2">
              {checkpoints.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-black">
                    {i + 1}
                  </span>
                  <input
                    value={c.label}
                    onChange={(e) =>
                      setCheckpoints((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    onBlur={(e) => updateCheckpoint(c.id, { label: e.target.value.trim() || c.label })}
                    className="flex-1 bg-transparent text-sm text-white outline-none"
                  />
                  <label className="flex items-center gap-1 text-xs text-zinc-500">
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={c.radius_m}
                      onChange={(e) =>
                        updateCheckpoint(c.id, {
                          radius_m: Math.max(10, Math.min(200, Number(e.target.value) || 30)),
                        })
                      }
                      className="w-14 rounded bg-white/5 px-1.5 py-1 text-right text-white outline-none"
                    />
                    m
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteCheckpoint(c.id)}
                    className="rounded-md px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
