"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Personnel } from "@/types/database";

// Dynamically import Leaflet components with no SSR
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface LiveMapProps {
  personnel: Personnel[];
}

export function LiveMap({ personnel }: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastCount, setBroadcastCount] = useState(0);

  // Initialize Leaflet icons on mount
  useEffect(() => {
    (async () => {
      // Import Leaflet and CSS dynamically
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix icon issues
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;

      // Use CDN URLs for reliable asset loading in Next.js
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
      
      setMounted(true);
    })();
  }, []);

  // London coordinates as default center
  const center = [51.5074, -0.1278] as [number, number];

  const handleBroadcast = () => {
    setBroadcasting(true);
    // Simulate finding guards
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      setBroadcastCount(count);
      if (count >= personnel.length) {
        clearInterval(interval);
        setTimeout(() => setBroadcasting(false), 2000);
      }
    }, 200);
  };

  if (!mounted) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center rounded-xl bg-white/[0.04] border border-white/10">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-shield-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="text-sm text-zinc-500">Initializing Live Map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-zinc-900">
      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          {/* Dark mode map tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {personnel.map((p, i) => {
            // Generate random nearby coordinates for demo
            const lat = 51.5074 + (Math.random() - 0.5) * 0.05;
            const lng = -0.1278 + (Math.random() - 0.5) * 0.05;
            
            return (
              <Marker key={p.id || i} position={[lat, lng]}>
                <Popup className="custom-popup">
                  <div className="p-1">
                    <div className="font-bold text-slate-900">{p.display_name}</div>
                    <div className="text-xs text-slate-600 mb-2">SIA Licensed • ★ 4.9</div>
                    <button className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      Book Now
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Overlay UI */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6">
        {/* Top Status Bar */}
        <div className="flex items-center justify-between">
          <div className="pointer-events-auto rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            {personnel.length} Guards Online
          </div>
          <div className="pointer-events-auto rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-md border border-white/10 shadow-lg">
            ⚡ Surge: 1.0x
          </div>
        </div>

        {/* Bottom Broadcast Panel */}
        <div className="pointer-events-auto w-full max-w-md self-center rounded-2xl bg-black/80 p-6 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Need security now?</h3>
            <p className="text-sm text-zinc-400">Broadcast your shift to all nearby verified guards.</p>
          </div>
          
          <button
            onClick={handleBroadcast}
            disabled={broadcasting}
            className={`group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4 font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-blue-500/25 active:scale-[0.98] ${
              broadcasting ? "opacity-90 cursor-wait" : ""
            }`}
          >
            {broadcasting ? (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Pinging Guards ({broadcastCount})...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Broadcast Shift
              </span>
            )}
            
            {/* Ripple effect overlay */}
            {!broadcasting && (
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </button>
          
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Avg. response: 45s
            </span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verified only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
