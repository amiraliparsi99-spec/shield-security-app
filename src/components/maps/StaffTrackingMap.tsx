"use client";

import { useState, useCallback, useMemo } from "react";
import Map, { Marker, Source, Layer, Popup, NavigationControl } from "react-map-gl";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Dark theme map style - matches glassmorphism design
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

interface StaffLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  isOnShift: boolean;
  venueName?: string;
  lastUpdated: string;
}

interface VenueGeofence {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}

interface StaffTrackingMapProps {
  staffLocations: StaffLocation[];
  venueGeofences?: VenueGeofence[];
  selectedStaffId?: string | null;
  onStaffSelect?: (staffId: string | null) => void;
  className?: string;
}

export function StaffTrackingMap({
  staffLocations,
  venueGeofences = [],
  selectedStaffId,
  onStaffSelect,
  className = "",
}: StaffTrackingMapProps) {
  const [popupInfo, setPopupInfo] = useState<StaffLocation | null>(null);
  const [viewState, setViewState] = useState({
    longitude: -0.1276, // Default to London
    latitude: 51.5074,
    zoom: 10,
  });

  // Calculate bounds to fit all markers
  const bounds = useMemo(() => {
    if (staffLocations.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    staffLocations.forEach(loc => {
      minLat = Math.min(minLat, loc.lat);
      maxLat = Math.max(maxLat, loc.lat);
      minLng = Math.min(minLng, loc.lng);
      maxLng = Math.max(maxLng, loc.lng);
    });

    // Add padding
    const latPadding = (maxLat - minLat) * 0.1 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.1 || 0.01;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    };
  }, [staffLocations]);

  // Update view to fit bounds on initial load
  const onMapLoad = useCallback((evt: { target: MapRef }) => {
    if (bounds && staffLocations.length > 0) {
      evt.target.fitBounds(
        [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
        { padding: 50, duration: 1000 }
      );
    }
  }, [bounds, staffLocations.length]);

  // Create geofence circle GeoJSON
  const geofenceData = useMemo(() => {
    if (venueGeofences.length === 0) return null;

    const features = venueGeofences.map(fence => {
      // Create a circle polygon (approximation with 64 points)
      const points = 64;
      const coordinates: [number, number][] = [];
      
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        // Convert radius from meters to degrees (approximate)
        const latOffset = (fence.radius / 111320) * Math.cos(angle);
        const lngOffset = (fence.radius / (111320 * Math.cos(fence.lat * Math.PI / 180))) * Math.sin(angle);
        coordinates.push([fence.lng + lngOffset, fence.lat + latOffset]);
      }

      return {
        type: "Feature" as const,
        properties: { id: fence.id, name: fence.name },
        geometry: {
          type: "Polygon" as const,
          coordinates: [coordinates],
        },
      };
    });

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [venueGeofences]);

  const handleMarkerClick = (staff: StaffLocation) => {
    setPopupInfo(staff);
    onStaffSelect?.(staff.id);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  // Check if Mapbox token is available
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!mapboxToken) {
    return (
      <div className={`relative flex items-center justify-center bg-zinc-900/50 ${className}`}>
        <div className="text-center p-8">
          <svg className="mx-auto h-12 w-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="mt-4 text-sm text-zinc-400">Map requires configuration</p>
          <p className="mt-2 text-xs text-zinc-500">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
          </p>
          <a
            href="https://mapbox.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-xs text-shield-400 hover:text-shield-300"
          >
            Get a free Mapbox token →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <Map
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
        onLoad={onMapLoad}
        mapStyle={MAP_STYLE}
        mapboxAccessToken={mapboxToken}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />

        {/* Geofence circles */}
        {geofenceData && (
          <Source id="geofences" type="geojson" data={geofenceData}>
            <Layer
              id="geofence-fill"
              type="fill"
              paint={{
                "fill-color": "#00B4D8",
                "fill-opacity": 0.1,
              }}
            />
            <Layer
              id="geofence-line"
              type="line"
              paint={{
                "line-color": "#00B4D8",
                "line-width": 2,
                "line-opacity": 0.5,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}

        {/* Staff markers */}
        {staffLocations.map((staff) => (
          <Marker
            key={staff.id}
            longitude={staff.lng}
            latitude={staff.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(staff);
            }}
          >
            <div
              className={`relative cursor-pointer transition-transform hover:scale-110 ${
                selectedStaffId === staff.id ? "scale-125" : ""
              }`}
            >
              {/* Pulse animation for on-shift staff */}
              {staff.isOnShift && (
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              {/* Marker dot */}
              <div
                className={`relative h-4 w-4 rounded-full border-2 border-white shadow-lg ${
                  staff.isOnShift ? "bg-emerald-500" : "bg-shield-500"
                }`}
              />
            </div>
          </Marker>
        ))}

        {/* Venue geofence center markers */}
        {venueGeofences.map((venue) => (
          <Marker
            key={`venue-${venue.id}`}
            longitude={venue.lng}
            latitude={venue.lat}
            anchor="center"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-shield-500/80 text-white shadow-lg">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.581.814L10 13.197l-4.419 3.617A1 1 0 014 16V4z" clipRule="evenodd" />
              </svg>
            </div>
          </Marker>
        ))}

        {/* Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            onClose={() => {
              setPopupInfo(null);
              onStaffSelect?.(null);
            }}
            closeButton={true}
            closeOnClick={false}
            className="staff-popup"
          >
            <div className="min-w-[180px] p-1">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    popupInfo.isOnShift ? "bg-emerald-500" : "bg-zinc-400"
                  }`}
                />
                <span className="font-medium text-zinc-900">{popupInfo.name}</span>
              </div>
              {popupInfo.venueName && (
                <p className="mt-1 text-xs text-zinc-600">@ {popupInfo.venueName}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>Updated {formatTime(popupInfo.lastUpdated)}</span>
                {popupInfo.accuracy && (
                  <span>±{Math.round(popupInfo.accuracy)}m</span>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 glass rounded-lg p-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-zinc-300">On Shift</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-shield-500" />
            <span className="text-zinc-300">Tracking</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-dashed border-shield-400 bg-shield-500/10" />
            <span className="text-zinc-300">Geofence</span>
          </div>
        </div>
      </div>

      {/* Staff count badge */}
      <div className="absolute right-4 top-4 glass rounded-lg px-3 py-2">
        <span className="text-sm font-medium text-white">{staffLocations.length}</span>
        <span className="ml-1 text-xs text-zinc-400">active</span>
      </div>

      <style jsx global>{`
        .mapboxgl-popup-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          padding: 8px;
        }
        .mapboxgl-popup-close-button {
          font-size: 16px;
          padding: 4px 8px;
          color: #666;
        }
        .mapboxgl-popup-close-button:hover {
          background: #f0f0f0;
          border-radius: 4px;
        }
        .mapboxgl-popup-tip {
          border-top-color: white;
        }
        .mapboxgl-ctrl-group {
          background: rgba(24, 24, 27, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(8px);
        }
        .mapboxgl-ctrl-group button {
          background: transparent !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
}
