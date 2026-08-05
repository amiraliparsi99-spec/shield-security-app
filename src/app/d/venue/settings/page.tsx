"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { ReplayTourButton } from "@/components/onboarding/ReplayTourButton";
import { DemoExportButtons } from "@/components/exports/ExportButtons";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/forms/AddressAutocomplete";
import { SiteGeofenceManager } from "@/components/venue/SiteGeofenceManager";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import { isMissingColumnError } from "@/lib/postgresErrors";

const venueTypes = [
  { value: "club", label: "Nightclub" },
  { value: "bar", label: "Bar / Pub" },
  { value: "stadium", label: "Stadium / Arena" },
  { value: "event_space", label: "Event Space" },
  { value: "restaurant", label: "Restaurant" },
  { value: "corporate", label: "Corporate Building" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"general" | "sites" | "exports">(
    "general",
  );
  const [venueId, setVenueId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [venue, setVenue] = useState<{
    name: string;
    address_line1: string;
    address_line2: string;
    city: string;
    postcode: string;
    country_code: string;
    phone: string;
    email: string;
    capacity: string;
    type: string;
    latitude: number | null;
    longitude: number | null;
    is_rural: boolean;
    is_critical: boolean;
  }>({
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    country_code: DEFAULT_COUNTRY_CODE,
    phone: "",
    email: "",
    capacity: "",
    type: "",
    latitude: null,
    longitude: null,
    is_rural: false,
    is_critical: false,
  });
  const venueRef = useRef(venue);
  useEffect(() => {
    venueRef.current = venue;
  }, [venue]);

  const [notifications, setNotifications] = useState({
    bookingConfirmations: true,
    staffCheckIns: true,
    incidentReports: true,
    invoices: true,
    marketing: false,
  });

  useEffect(() => {
    loadVenue();
  }, []);

  const loadVenue = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("venues")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setVenueId(data.id);
        const latRaw = Number(data.latitude);
        const lngRaw = Number(data.longitude);
        const hasCoords =
          Number.isFinite(latRaw) &&
          Number.isFinite(lngRaw) &&
          (latRaw !== 0 || lngRaw !== 0);
        setVenue({
          name: data.name || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          city: data.city || "",
          postcode: data.postcode || "",
          country_code: (data.country_code || DEFAULT_COUNTRY_CODE).toUpperCase(),
          phone: data.phone || "",
          email: data.email || "",
          capacity: data.capacity ? String(data.capacity) : "",
          type: data.type || "",
          latitude: hasCoords ? latRaw : null,
          longitude: hasCoords ? lngRaw : null,
          is_rural: data.is_rural === true,
          is_critical: data.is_critical === true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onPickVenueAddress = useCallback((s: AddressSuggestion) => {
    const prev = venueRef.current;
    setVenue({
      ...prev,
      address_line1: s.address_line1 || prev.address_line1,
      city: s.city || prev.city,
      postcode: s.postcode || prev.postcode,
      country_code: s.country_code
        ? s.country_code.toUpperCase()
        : prev.country_code,
      latitude: s.center[1],
      longitude: s.center[0],
    });
  }, []);

  /** Forward-geocode the manual address fields once (best-effort, ignores failures). */
  const geocodeManualAddress = async (
    query: string,
    countryCode: string,
  ): Promise<{ lat: number; lng: number } | null> => {
    if (query.trim().length < 3) return null;
    try {
      const params = new URLSearchParams({ q: query });
      if (countryCode) params.set("country", countryCode.toLowerCase());
      const res = await fetch(`/api/geocode/suggest?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      const first = Array.isArray(data.results) ? data.results[0] : null;
      if (first?.center && Array.isArray(first.center) && first.center.length === 2) {
        return { lng: first.center[0], lat: first.center[1] };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    if (!venueId) return;
    setIsSaving(true);
    setSaved(false);
    try {
      let lat = venue.latitude;
      let lng = venue.longitude;

      if (
        (lat == null || lng == null) &&
        (venue.address_line1.trim() || venue.postcode.trim())
      ) {
        const q = [venue.address_line1, venue.city, venue.postcode]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
        const geo = await geocodeManualAddress(q, venue.country_code);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        }
      }

      const baseVenueUpdate: Record<string, unknown> = {
        name: venue.name,
        address_line1: venue.address_line1,
        address_line2: venue.address_line2 || null,
        city: venue.city,
        postcode: venue.postcode || null,
        phone: venue.phone || null,
        email: venue.email || null,
        capacity: venue.capacity ? parseInt(venue.capacity) : null,
        type: venue.type || null,
        ...(lat != null && lng != null
          ? { latitude: lat, longitude: lng }
          : {}),
      };
      const withCoverFlags: Record<string, unknown> = {
        ...baseVenueUpdate,
        is_rural: venue.is_rural,
        is_critical: venue.is_critical,
      };
      const venueUpdate: Record<string, unknown> = {
        ...withCoverFlags,
        country_code: (venue.country_code || DEFAULT_COUNTRY_CODE).toUpperCase(),
      };

      // Tolerant write: drop columns the running schema may not have yet.
      let { error } = await supabase
        .from("venues")
        .update(venueUpdate)
        .eq("id", venueId);
      if (error && isMissingColumnError(error)) {
        console.warn(
          "[Settings] venues missing column — retrying without country_code (migration 0053).",
        );
        ({ error } = await supabase
          .from("venues")
          .update(withCoverFlags)
          .eq("id", venueId));
      }
      if (error && isMissingColumnError(error)) {
        console.warn(
          "[Settings] venues missing column — retrying without is_rural/is_critical (migration 0056).",
        );
        ({ error } = await supabase
          .from("venues")
          .update(baseVenueUpdate)
          .eq("id", venueId));
      }

      if (!error) {
        setSaved(true);
        if (lat != null && lng != null) {
          setVenue((p) => ({ ...p, latitude: lat, longitude: lng }));
        }
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-[#00d4aa]/50 focus:outline-none focus:ring-1 focus:ring-[#00d4aa]/20 transition";

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="mb-8">
          <div className="h-8 w-32 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-4 w-56 mt-2 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-400">Manage your venue profile and preferences</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {([{ id: "general", label: "General" }, { id: "sites", label: "Sites & Geofences" }, { id: "exports", label: "Export Reports" }] as const).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeTab === tab.id ? "bg-[#00d4aa] text-[#0c0d10]" : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sites" && (
        <div className="space-y-6">
          <SiteGeofenceManager venueId={venueId} />
        </div>
      )}

      {activeTab === "exports" && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Export Your Data</h3>
            <p className="text-sm text-zinc-400 mb-6">Generate PDF invoices for your bookings and reports for accounting.</p>
            <DemoExportButtons />
          </div>
        </div>
      )}

      {activeTab === "general" && (
        <div className="space-y-6">
          <ThemeToggle />

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Help &amp; Guided Tour</h2>
            <p className="text-sm text-zinc-400 mb-4">
              New here or need a refresher? Replay the quick walkthrough that shows you around your dashboard.
            </p>
            <ReplayTourButton tourId="venue-v1" />
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Venue Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Venue Name</label>
                <input type="text" value={venue.name} onChange={(e) => setVenue((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Country</label>
                  <select
                    value={venue.country_code}
                    onChange={(e) =>
                      setVenue((p) => ({
                        ...p,
                        country_code: e.target.value,
                        latitude: null,
                        longitude: null,
                      }))
                    }
                    className={inputClass}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <AddressAutocomplete
                  label="Search address or postcode"
                  help="Pick from the list — we'll fill the fields and save a map pin so guards can find you."
                  onSelect={onPickVenueAddress}
                  placeholder="Address, postcode, city or place name"
                  country={venue.country_code.toLowerCase()}
                />

                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or edit manually</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Address Line 1</label>
                  <input type="text" value={venue.address_line1} onChange={(e) => setVenue((p) => ({ ...p, address_line1: e.target.value, latitude: null, longitude: null }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Address Line 2</label>
                  <input type="text" value={venue.address_line2} onChange={(e) => setVenue((p) => ({ ...p, address_line2: e.target.value }))} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">City / Town</label>
                    <input type="text" value={venue.city} onChange={(e) => setVenue((p) => ({ ...p, city: e.target.value, latitude: null, longitude: null }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Postcode / ZIP <span className="text-zinc-500 text-xs font-normal">(optional)</span>
                    </label>
                    <input type="text" value={venue.postcode} onChange={(e) => setVenue((p) => ({ ...p, postcode: e.target.value, latitude: null, longitude: null }))} className={inputClass} />
                  </div>
                </div>

                {venue.latitude != null && venue.longitude != null ? (
                  <p className="text-xs text-emerald-400">
                    ✓ Map pin set at {venue.latitude.toFixed(5)}, {venue.longitude.toFixed(5)} — ready for guard check-ins.
                  </p>
                ) : (
                  <p className="text-xs text-amber-400">
                    No map pin yet. Pick from the search above, or hit Save and we'll geocode your address for you.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
                  <input type="tel" value={venue.phone} onChange={(e) => setVenue((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                  <input type="email" value={venue.email} onChange={(e) => setVenue((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Capacity</label>
                  <input type="number" value={venue.capacity} onChange={(e) => setVenue((p) => ({ ...p, capacity: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Venue Type</label>
                  <select value={venue.type} onChange={(e) => setVenue((p) => ({ ...p, type: e.target.value }))} className={inputClass}>
                    <option value="">Select type...</option>
                    {venueTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Cover Sourcing Preferences</h2>
            <p className="text-xs text-zinc-500 mb-5">Tune how the platform escalates when a guard goes silent or fails to arrive.</p>
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setVenue((p) => ({ ...p, is_rural: !p.is_rural }))}
                className="flex w-full items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-left hover:bg-white/[0.04] transition"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Rural / hard-to-reach venue</div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Multiplies our distance thresholds by 2.5×. Use this if your venue is in a village,
                    rural area, or anywhere that "5 km from site" is too tight to be a useful warning.
                  </p>
                </div>
                <span
                  className={`mt-1 h-6 w-12 shrink-0 rounded-full transition relative ${venue.is_rural ? "bg-[#00d4aa]" : "bg-white/20"}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${venue.is_rural ? "left-7" : "left-1"}`}
                  />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVenue((p) => ({ ...p, is_critical: !p.is_critical }))}
                className="flex w-full items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-left hover:bg-white/[0.04] transition"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Critical venue tier</div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Cover sourcing fires <span className="text-amber-300">earlier</span>: we start
                    contacting standby guards 20 minutes before scheduled start, and mark a no-show
                    just 5 minutes after. Best for sites that can't afford any exposure window.
                  </p>
                </div>
                <span
                  className={`mt-1 h-6 w-12 shrink-0 rounded-full transition relative ${venue.is_critical ? "bg-[#00d4aa]" : "bg-white/20"}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${venue.is_critical ? "left-7" : "left-1"}`}
                  />
                </span>
              </button>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Notifications</h2>
            <div className="space-y-4">
              {Object.entries({
                bookingConfirmations: "Booking confirmations",
                staffCheckIns: "Staff check-in alerts",
                incidentReports: "Incident reports",
                invoices: "Invoice notifications",
                marketing: "Marketing & updates",
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-white">{label}</span>
                  <button onClick={() => setNotifications((p) => ({ ...p, [key]: !p[key as keyof typeof notifications] }))} className={`w-12 h-6 rounded-full transition relative ${notifications[key as keyof typeof notifications] ? "bg-[#00d4aa]" : "bg-white/20"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${notifications[key as keyof typeof notifications] ? "left-7" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#00d4aa] hover:bg-[#00e5b8] text-[#0c0d10] py-3 rounded-xl font-semibold transition disabled:opacity-60"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {isSaving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </motion.button>
        </div>
      )}
    </div>
  );
}
