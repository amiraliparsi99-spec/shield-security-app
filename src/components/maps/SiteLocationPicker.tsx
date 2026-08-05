"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/forms/AddressAutocomplete";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries";

const MapPin = dynamic(
  () => import("./SiteLocationPinMap").then((m) => m.SiteLocationPinMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] animate-pulse rounded-xl bg-black/40 border border-white/10" />
    ),
  },
);

export type SiteLocationValue = {
  lat: number;
  lng: number;
  label: string;
  addressText: string;
  precision: "exact" | "approximate";
};

type Props = {
  value: SiteLocationValue | null;
  onChange: (value: SiteLocationValue | null) => void;
  className?: string;
  /** Shorter map + tighter layout for modals. */
  compact?: boolean;
};

function buildAddressQuery(parts: {
  address_line1: string;
  city: string;
  postcode: string;
}): string {
  return [parts.address_line1, parts.city, parts.postcode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export function SiteLocationPicker({ value, onChange, className = "", compact = false }: Props) {
  const [manual, setManual] = useState({
    address_line1: "",
    city: "",
    postcode: "",
  });
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(!compact || !value);

  const onPickSuggestion = useCallback(
    (s: AddressSuggestion) => {
      const isExact = s.place_type === "address" || s.place_type === "poi";
      onChange({
        lat: s.center[1],
        lng: s.center[0],
        label: s.place_name.split(",")[0]?.trim() || s.place_name,
        addressText: s.place_name,
        precision: isExact ? "exact" : "approximate",
      });
      setGeocodeError(null);
      if (compact) setMapOpen(false);
    },
    [onChange],
  );

  const setPinFromTypedAddress = useCallback(async () => {
    const q = buildAddressQuery(manual);
    if (q.length < 3) {
      setGeocodeError("Enter at least a street, area, or postcode.");
      return;
    }
    setGeocodeLoading(true);
    setGeocodeError(null);
    try {
      const params = new URLSearchParams({ q, country: DEFAULT_COUNTRY_CODE.toLowerCase() });
      const res = await fetch(`/api/geocode/suggest?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        onChange(null);
        setGeocodeError(typeof data.error === "string" ? data.error : "Address lookup failed.");
        return;
      }
      const results = data.results as
        | { place_name: string; center: [number, number]; place_type?: string }[]
        | undefined;
      if (!Array.isArray(results) || results.length === 0) {
        onChange(null);
        setGeocodeError("Couldn't place that on the map. Try adding a city or postcode.");
        return;
      }
      const first = results[0];
      const isExact = first.place_type === "address" || first.place_type === "poi";
      onChange({
        lat: first.center[1],
        lng: first.center[0],
        label: first.place_name.split(",")[0]?.trim() || first.place_name,
        addressText: first.place_name,
        precision: isExact ? "exact" : "approximate",
      });
    } catch {
      onChange(null);
      setGeocodeError("Could not reach address lookup.");
    } finally {
      setGeocodeLoading(false);
    }
  }, [manual, onChange]);

  const mapCenter = useMemo(
    () =>
      value
        ? { latitude: value.lat, longitude: value.lng, zoom: 16 }
        : { latitude: 52.4862, longitude: -1.8904, zoom: 11 },
    [value],
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {!value && (
        <>
          <AddressAutocomplete
            label="Find the site"
            help="Search for the address, then fine-tune the pin on the map."
            onSelect={onPickSuggestion}
            placeholder="Address, postcode, or venue name"
            country={DEFAULT_COUNTRY_CODE.toLowerCase()}
          />
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            {manualOpen ? "Hide manual entry" : "Can't find it? Enter manually"}
          </button>
          {manualOpen && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <input
                value={manual.address_line1}
                onChange={(e) => setManual((m) => ({ ...m, address_line1: e.target.value }))}
                placeholder="Street or site name"
                className="scheduler-input"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={manual.city}
                  onChange={(e) => setManual((m) => ({ ...m, city: e.target.value }))}
                  placeholder="City"
                  className="scheduler-input"
                />
                <input
                  value={manual.postcode}
                  onChange={(e) => setManual((m) => ({ ...m, postcode: e.target.value }))}
                  placeholder="Postcode"
                  className="scheduler-input"
                />
              </div>
              <button
                type="button"
                onClick={() => void setPinFromTypedAddress()}
                disabled={geocodeLoading}
                className="w-full rounded-lg border border-shield-500/30 bg-shield-500/10 px-3 py-2 text-sm text-shield-200 hover:bg-shield-500/20 transition disabled:opacity-50"
              >
                {geocodeLoading ? "Finding…" : "Drop pin from these fields"}
              </button>
            </div>
          )}
        </>
      )}

      {value && (
        <div
          className={`rounded-xl border p-3 ${
            value.precision === "exact"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex items-start gap-2.5">
              <span className="mt-0.5 text-base leading-none" aria-hidden>
                📍
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{value.label}</p>
                <p className="text-xs text-zinc-400 break-words mt-0.5">{value.addressText}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setMapOpen(true);
              }}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-shield-300 bg-shield-500/10 hover:bg-shield-500/20 transition"
            >
              Change
            </button>
          </div>
          {compact && value && !mapOpen && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Adjust pin on map →
            </button>
          )}
        </div>
      )}

      {(!compact || mapOpen || !value) && (
        <MapPin
          center={mapCenter}
          pin={value ? { lat: value.lat, lng: value.lng } : null}
          onPinChange={(lat, lng) => {
            onChange({
              lat,
              lng,
              label: value?.label || "Custom pin",
              addressText: value?.addressText || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              precision: "exact",
            });
          }}
          className={compact ? "h-[160px]" : undefined}
          mapHeight={compact ? 160 : 220}
        />
      )}

      {geocodeError && <p className="text-xs text-amber-400">{geocodeError}</p>}
      {!compact && (
        <p className="text-[11px] text-zinc-500">
          Click the map or drag the pin to set the exact check-in location for this shift.
        </p>
      )}
    </div>
  );
}
