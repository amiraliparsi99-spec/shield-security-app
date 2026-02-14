"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { VenueWithRequests } from "@/lib/dashboard-mock";

// Fix default marker icon in Next.js (Leaflet's default paths break with bundling)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface VenuesMapProps {
  venues: VenueWithRequests[];
  center: { lat: number; lng: number };
  zoom?: number;
}

export function VenuesMap({ venues, center, zoom = 14 }: VenuesMapProps) {
  return (
    <div className="h-full w-full min-h-[360px] overflow-hidden rounded-2xl border border-white/10">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {venues.map((v) => (
          <Marker key={v.id} position={[v.lat, v.lng]}>
            <Popup>
              <div className="min-w-[200px]">
                <p className="font-semibold text-ink-950">{v.name}</p>
                {v.address && <p className="mt-1 text-sm text-ink-700">{v.address}</p>}
                <p className="mt-2 text-sm text-shield-600">
                  {v.openRequests.length} open request{v.openRequests.length !== 1 ? "s" : ""} ·{" "}
                  {v.openRequests.reduce((s, r) => s + r.guardsCount, 0)} guards needed
                </p>
                <ul className="mt-2 list-inside list-disc text-xs text-ink-600">
                  {v.openRequests.slice(0, 2).map((r) => (
                    <li key={r.id}>{r.title} — {r.guardsCount} guard{r.guardsCount !== 1 ? "s" : ""}</li>
                  ))}
                  {v.openRequests.length > 2 && <li>+{v.openRequests.length - 2} more</li>}
                </ul>
                <Link
                  href={`/venue/${v.id}`}
                  className="mt-3 block text-sm font-semibold text-shield-600 hover:underline"
                >
                  View full details →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
