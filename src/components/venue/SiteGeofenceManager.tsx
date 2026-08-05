"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumnError } from "@/lib/postgresErrors";
import { polygonCentroid, type GeoJsonPolygon } from "@/lib/geo/polygon";
import { HelpHint } from "@/components/ui/HelpHint";

// Map libraries are client-only and heavy — load on demand.
const GeofenceEditor = dynamic(
  () => import("@/components/maps/GeofenceEditor").then((m) => m.GeofenceEditor),
  { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-lg bg-white/5" /> },
);

interface SavedSite {
  id: string;
  label: string;
  address_line1: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
  geofence_polygon: GeoJsonPolygon | null;
}

interface SiteGeofenceManagerProps {
  venueId: string | null;
}

/**
 * Lets a venue draw a custom on-site boundary for each of their saved sites.
 * Inside the boundary counts as "on-site" for check-in and tracking, replacing
 * the single pin + radius. Clearing it reverts to the radius behaviour.
 */
export function SiteGeofenceManager({ venueId }: SiteGeofenceManagerProps) {
  const supabase = createClient();
  const [sites, setSites] = useState<SavedSite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeoJsonPolygon | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const loadSites = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const rich = await supabase
        .from("venue_locations")
        .select(
          "id, label, address_line1, city, postcode, latitude, longitude, geofence_polygon",
        )
        .eq("venue_id", venueId)
        .order("created_at", { ascending: true });

      if (rich.error && isMissingColumnError(rich.error)) {
        // Schema predates migration 0057 — geofences can't be stored yet.
        setUnsupported(true);
        const basic = await supabase
          .from("venue_locations")
          .select("id, label, address_line1, city, postcode, latitude, longitude")
          .eq("venue_id", venueId)
          .order("created_at", { ascending: true });
        setSites(
          ((basic.data as Omit<SavedSite, "geofence_polygon">[]) ?? []).map((s) => ({
            ...s,
            geofence_polygon: null,
          })),
        );
      } else {
        setSites((rich.data as SavedSite[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, venueId]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const selectSite = (site: SavedSite) => {
    setSelectedId(site.id);
    setDraft(site.geofence_polygon ?? null);
    setSaved(false);
  };

  const selected = sites.find((s) => s.id === selectedId) ?? null;

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaved(false);
    try {
      const centroid = draft ? polygonCentroid(draft) : null;
      const { error } = await supabase
        .from("venue_locations")
        .update({
          geofence_polygon: draft,
          geofence_centroid_lat: centroid?.lat ?? null,
          geofence_centroid_lng: centroid?.lng ?? null,
          geofence_updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) {
        if (isMissingColumnError(error)) setUnsupported(true);
        return;
      }
      setSaved(true);
      setSites((prev) =>
        prev.map((s) =>
          s.id === selected.id ? { ...s, geofence_polygon: draft } : s,
        ),
      );
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!venueId) return null;

  if (unsupported) {
    return (
      <div className="glass rounded-xl p-6">
        <h2 className="mb-2 text-lg font-semibold text-white">Check-in areas</h2>
        <p className="text-sm text-amber-400">
          Drawing check-in areas needs a quick database update before it can be
          turned on. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white inline-flex items-center gap-2">
        Check-in areas
        <HelpHint label="What is a check-in area?">
          For each of your saved places you can draw the exact area guards work in. Anyone
          standing inside it counts as &ldquo;on-site&rdquo; when they check in. It&rsquo;s handy
          for big sites where the front-door pin is far from where guards are actually posted.
          Leave it blank and we simply check guards in when they reach the address.
        </HelpHint>
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Optional. Draw the area guards actually work in, so anyone inside it counts
        as on-site at check-in — useful for large sites where the entrance is far
        from where guards are posted.
      </p>

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-white/5" />
      ) : sites.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          No saved places yet. Saved places are created when you build a booking
          and tick &ldquo;Save this site&rdquo;. Once you have one, draw its
          check-in area here.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {sites.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => selectSite(site)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  selectedId === site.id
                    ? "bg-[#00d4aa] text-[#0c0d10]"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                <span className="block font-medium">{site.label}</span>
                <span
                  className={`block text-xs ${
                    selectedId === site.id ? "text-[#0c0d10]/70" : "text-zinc-500"
                  }`}
                >
                  {site.geofence_polygon ? "Area drawn" : "Uses address only"}
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-3">
              <GeofenceEditor
                key={selected.id}
                siteLat={selected.latitude}
                siteLng={selected.longitude}
                value={draft}
                onChange={setDraft}
                className="h-[360px] w-full"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-[#00d4aa] px-4 py-2 text-sm font-semibold text-[#0c0d10] transition hover:bg-[#00e5b8] disabled:opacity-60"
                >
                  {saving ? "Saving…" : saved ? "Saved!" : "Save check-in area"}
                </button>
                <span className="text-xs text-zinc-500">
                  {draft
                    ? "Area set — guards inside it count as on-site."
                    : "No area drawn — we'll check guards in at the address."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
