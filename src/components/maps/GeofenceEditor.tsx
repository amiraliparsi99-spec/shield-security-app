"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  useControl,
  type IControl,
} from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import {
  polygonAreaSqMeters,
  polygonCentroid,
  squarePolygonAround,
  type GeoJsonPolygon,
} from "@/lib/geo/polygon";
import { HelpHint } from "@/components/ui/HelpHint";

// Soft cap: warn (don't block — festivals/estates can be large) above this.
const MAX_REASONABLE_AREA_SQM = 5_000_000; // 5 km²

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

interface DrawControlProps {
  initialPolygon?: GeoJsonPolygon | null;
  onChange: (polygon: GeoJsonPolygon | null) => void;
  onReady?: (draw: MapboxDraw) => void;
}

/**
 * Mounts a Mapbox GL Draw control on the parent map and keeps a single polygon
 * in sync. Restricts the user to one polygon — drawing a new one replaces any
 * previous boundary.
 */
function DrawControl({ initialPolygon, onChange, onReady }: DrawControlProps) {
  const drawRef = useRef<MapboxDraw | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const syncFromDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const all = draw.getAll();
    const polys = all.features.filter(
      (f) => f.geometry && f.geometry.type === "Polygon",
    );
    if (polys.length > 1) {
      // Keep only the most recently drawn polygon.
      const removeIds = polys
        .slice(0, -1)
        .map((f) => f.id)
        .filter((id): id is string => typeof id === "string");
      if (removeIds.length) draw.delete(removeIds);
    }
    const keep = polys[polys.length - 1];
    if (keep && keep.geometry.type === "Polygon") {
      onChangeRef.current({
        type: "Polygon",
        coordinates: keep.geometry.coordinates as GeoJsonPolygon["coordinates"],
      });
    } else {
      onChangeRef.current(null);
    }
  }, []);

  useControl(
    () => {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      drawRef.current = draw;
      // MapboxDraw is a Mapbox IControl but doesn't structurally match
      // react-map-gl's IControl<MapInstance> generic — cast through unknown.
      return draw as unknown as IControl;
    },
    ({ map }: { map: { on: (ev: string, cb: () => void) => void } }) => {
      map.on("draw.create", syncFromDraw);
      map.on("draw.update", syncFromDraw);
      map.on("draw.delete", syncFromDraw);
      if (initialPolygon && drawRef.current) {
        drawRef.current.add({
          type: "Feature",
          properties: {},
          geometry: initialPolygon,
        } as never);
      }
      if (drawRef.current) onReady?.(drawRef.current);
    },
    () => {
      drawRef.current = null;
    },
    { position: "top-left" },
  );

  return null;
}

export interface GeofenceEditorProps {
  /** Check-in pin latitude — used to centre the map and as a reference marker. */
  siteLat: number;
  /** Check-in pin longitude. */
  siteLng: number;
  /** Existing boundary, if any. */
  value?: GeoJsonPolygon | null;
  /** Fired whenever the drawn boundary changes (null when cleared). */
  onChange: (polygon: GeoJsonPolygon | null) => void;
  className?: string;
}

/**
 * Lets a venue/agency draw a custom on-site boundary on a map. The boundary
 * replaces the single pin + radius for attendance: anyone inside it counts as
 * present. Clearing the boundary falls back to the radius behaviour.
 */
export function GeofenceEditor({
  siteLat,
  siteLng,
  value,
  onChange,
  className = "",
}: GeofenceEditorProps) {
  const drawInstance = useRef<MapboxDraw | null>(null);
  const [hasPolygon, setHasPolygon] = useState<boolean>(Boolean(value));

  // Centre on the existing polygon's centroid when present, otherwise the pin.
  const initialView = useMemo(() => {
    const centroid = value ? polygonCentroid(value) : null;
    return {
      longitude: centroid?.lng ?? siteLng,
      latitude: centroid?.lat ?? siteLat,
      zoom: 16,
    };
  }, [value, siteLat, siteLng]);

  const handleChange = useCallback(
    (polygon: GeoJsonPolygon | null) => {
      setHasPolygon(Boolean(polygon));
      onChange(polygon);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    drawInstance.current?.deleteAll();
    setHasPolygon(false);
    onChange(null);
  }, [onChange]);

  const handleSuggest = useCallback(() => {
    const draw = drawInstance.current;
    if (!draw) return;
    const square = squarePolygonAround(siteLat, siteLng, 60);
    draw.deleteAll();
    draw.add({
      type: "Feature",
      properties: {},
      geometry: square,
    } as never);
    setHasPolygon(true);
    onChange(square);
  }, [siteLat, siteLng, onChange]);

  const areaSqm = value ? polygonAreaSqMeters(value) : 0;
  const oversized = areaSqm > MAX_REASONABLE_AREA_SQM;

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <div
        className={`relative flex min-h-[320px] items-center justify-center rounded-lg bg-zinc-900/50 ${className}`}
      >
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-400">Map requires configuration</p>
          <p className="mt-2 text-xs text-zinc-500">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
          </p>
        </div>
      </div>
    );
  }

  if (!Number.isFinite(siteLat) || !Number.isFinite(siteLng)) {
    return (
      <div
        className={`relative flex min-h-[320px] items-center justify-center rounded-lg bg-zinc-900/50 ${className}`}
      >
        <p className="p-6 text-center text-sm text-zinc-400">
          Set a check-in pin first, then draw the on-site boundary.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <Map
        initialViewState={initialView}
        mapStyle={MAP_STYLE}
        mapboxAccessToken={mapboxToken}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />
        <DrawControl
          initialPolygon={value ?? null}
          onChange={handleChange}
          onReady={(d) => {
            drawInstance.current = d;
          }}
        />
        <Marker longitude={siteLng} latitude={siteLat} anchor="center">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-shield-500/90 text-white shadow-lg ring-2 ring-white/60">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </Marker>
      </Map>

      <div className="absolute left-4 top-4 max-w-[240px] rounded-lg bg-zinc-900/80 p-3 text-xs text-zinc-300 backdrop-blur">
        <p className="font-medium text-white inline-flex items-center gap-1.5">
          On-site boundary
          <HelpHint label="What is the on-site boundary?" side="bottom">
            This is the area on the map where guards count as &ldquo;on-site&rdquo;. When a guard is inside
            this zone, the app knows they&rsquo;ve arrived and can check in. If they leave it during a shift,
            you&rsquo;ll be alerted. If you skip drawing one, a simple circle around the check-in pin is used instead.
          </HelpHint>
        </p>
        <p className="mt-1 text-zinc-400">
          {hasPolygon
            ? "Use the polygon and trash tools (top-left) to edit. Anyone inside this area counts as on-site."
            : "Tap the polygon tool (top-left), then click points around your site to enclose it. Double-click to finish."}
        </p>
        {!hasPolygon && (
          <button
            type="button"
            onClick={handleSuggest}
            className="mt-2 rounded-md bg-shield-500/90 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-shield-400"
          >
            Suggest a starter zone
          </button>
        )}
        {oversized && (
          <p className="mt-2 text-amber-300">
            This zone is very large ({(areaSqm / 1_000_000).toFixed(1)} km²) —
            double-check it only covers your site.
          </p>
        )}
      </div>

      {hasPolygon && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute bottom-4 left-4 rounded-lg bg-zinc-900/80 px-3 py-2 text-xs font-medium text-red-300 backdrop-blur transition hover:bg-zinc-800"
        >
          Clear boundary (use radius)
        </button>
      )}
    </div>
  );
}
