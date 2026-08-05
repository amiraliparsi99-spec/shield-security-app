"use client";

import { useCallback } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import type { MapLayerMouseEvent } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

type Props = {
  center: { latitude: number; longitude: number; zoom: number };
  pin: { lat: number; lng: number } | null;
  onPinChange: (lat: number, lng: number) => void;
  className?: string;
  mapHeight?: number;
};

export function SiteLocationPinMap({ center, pin, onPinChange, className = "", mapHeight = 220 }: Props) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      onPinChange(e.lngLat.lat, e.lngLat.lng);
    },
    [onPinChange],
  );

  if (!mapboxToken) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-white/10 bg-black/40 px-4 text-center text-xs text-zinc-500 ${className}`}
        style={{ height: mapHeight }}
      >
        Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the location map.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 ${className}`}>
      <Map
        mapboxAccessToken={mapboxToken}
        mapStyle={MAP_STYLE}
        initialViewState={center}
        onClick={onMapClick}
        style={{ width: "100%", height: mapHeight }}
        cursor="crosshair"
      >
        <NavigationControl position="top-right" showCompass={false} />
        {pin && (
          <Marker
            longitude={pin.lng}
            latitude={pin.lat}
            anchor="bottom"
            draggable
            onDragEnd={(e) => onPinChange(e.lngLat.lat, e.lngLat.lng)}
          >
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-shield-500 p-2 shadow-lg shadow-shield-500/40">
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                </svg>
              </div>
              <div className="mt-1 h-2 w-2 rounded-full bg-shield-500/60" />
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}
