"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useVenueProfile, useAgencyProfile, useCreateBooking } from "@/hooks";
import { useSupabase } from "@/hooks/useSupabase";
import {
  checkPersonnelAvailabilityDetailed,
  type AvailabilityCheckResult,
} from "@/lib/db/availability";
import { toCanonicalStaffRequirements } from "@/lib/pricing";
import type { Personnel } from "@/lib/database.types";
import { appendPostcodeIfMissing } from "@/lib/addressFormat";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/forms/AddressAutocomplete";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import {
  describeError,
  errorMessage,
  isMissingColumnError,
} from "@/lib/postgresErrors";
import dynamic from "next/dynamic";
import { polygonCentroid, type GeoJsonPolygon } from "@/lib/geo/polygon";
import { HelpHint } from "@/components/ui/HelpHint";

const GeofenceEditor = dynamic(
  () => import("@/components/maps/GeofenceEditor").then((m) => m.GeofenceEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-lg bg-white/5" />
    ),
  },
);

/** Combine manual fields for Mapbox forward geocoding (UK). */
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

function formatVenueAddressSnapshot(v: {
  address_line1?: string | null;
  city?: string | null;
  postcode?: string | null;
}): string {
  return [v.address_line1, v.city, v.postcode]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Combine calendar date (YYYY-MM-DD) + times in the user's local timezone.
 * Avoids `new Date("YYYY-MM-DD")` parsing as UTC midnight, which shifts the calendar day in some zones.
 */
function scheduledRangeFromFormParts(
  dateStr: string,
  startTime: string,
  endTime: string,
): { scheduledStart: Date; scheduledEnd: Date } | null {
  if (!dateStr || !startTime || !endTime) return null;
  const dparts = dateStr.split("-").map((x) => Number(x));
  if (dparts.length !== 3 || dparts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = dparts;
  const st = startTime.split(":").map(Number);
  const et = endTime.split(":").map(Number);
  if (st.length < 2 || et.length < 2 || st.some(Number.isNaN) || et.some(Number.isNaN)) return null;

  const scheduledStart = new Date(y, mo - 1, d, st[0], st[1], 0, 0);
  const scheduledEnd = new Date(y, mo - 1, d, et[0], et[1], 0, 0);
  if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }
  return { scheduledStart, scheduledEnd };
}

function formatShortDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

type StaffRequirement = {
  role: string;
  quantity: number;
  rate: number;
};

type PersonnelWithAvailability = Personnel & {
  availabilityInfo?: AvailabilityCheckResult;
  reputation?: {
    avgRating: number;
    totalReviews: number;
  };
};

const roleOptions = [
  { value: "Door Supervisor", defaultRate: 18 },
  { value: "Security Guard", defaultRate: 16 },
  { value: "CCTV Operator", defaultRate: 17 },
];

const attireOptions = [
  { value: "Smart black uniform", note: "Black shirt/trousers, polished footwear, SIA displayed." },
  { value: "Formal suit", note: "Suit and tie or business formal presentation." },
  { value: "Venue branded uniform", note: "Venue-issued branded uniform." },
  { value: "Hi-vis / stewarding", note: "High-visibility for crowd and perimeter control." },
  { value: "Tactical / PPE", note: "Boots, utility belt, and role-appropriate PPE." },
  { value: "Smart casual", note: "Clean smart-casual attire as agreed by venue." },
];

/* ─── Stripe Checkout Form (rendered inside <Elements>) ─── */
function CheckoutForm({
  amountPence,
  onSuccess,
}: {
  amountPence: number;
  onSuccess: (paymentIntentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError, paymentIntent } =
      await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

    if (submitError) {
      setError(submitError.message || "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      setError("Payment was not completed. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{ layout: "tabs" }}
        onLoadError={(event) => {
          // Stripe's React lib otherwise logs a useless `{}` to console. Pull
          // the real message (network, invalid publishable key, blocked by
          // extension, etc.) and surface it inline.
          const message =
            event?.error?.message ||
            "We couldn't load the payment form. Check your internet connection, disable ad-blockers on localhost, and try again.";
          console.error("[Stripe] PaymentElement load failed:", {
            type: event?.error?.type,
            code: event?.error?.code,
            message: event?.error?.message,
            raw: event,
          });
          setError(message);
        }}
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-lg transition"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing Payment...
          </span>
        ) : (
          `Pay £${(amountPence / 100).toFixed(2)}`
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure payment powered by Stripe
      </div>
    </form>
  );
}

/* ─── Main Page ─── */
export type BookingOwnerType = "venue" | "agency";

/**
 * The full "Book Security" wizard, shared by the venue and agency dashboards.
 *
 * For agencies the venue-only concepts simply fall away: there is no profile
 * map pin and no saved-sites library, so the location step always uses the
 * "new place" search, and the booking row is owned via `agency_id` instead of
 * `venue_id`.
 */
export function NewBookingFlow({ ownerType }: { ownerType: BookingOwnerType }) {
  const isAgency = ownerType === "agency";
  const basePath = isAgency ? "/d/agency" : "/d/venue";
  const router = useRouter();
  const supabase = useSupabase();
  const { data: venueProfile, loading: venueProfileLoading } = useVenueProfile();
  const { data: agencyProfile, loading: agencyProfileLoading } = useAgencyProfile();
  // The owning entity drives everything below. Agencies lack the venue-only
  // fields (latitude/longitude), so coordinate-dependent branches naturally
  // fall through to the "new place" flow.
  const venue = (isAgency ? agencyProfile : venueProfile) as any;
  const venueLoading = isAgency ? agencyProfileLoading : venueProfileLoading;
  const { mutate: createBooking, loading: submitting } = useCreateBooking();

  const [step, setStep] = useState(1);
  const [postToBoard, setPostToBoard] = useState(true);
  const [selectSpecific, setSelectSpecific] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffFilter, setStaffFilter] = useState<"all" | "available">("available");
  const [availablePersonnel, setAvailablePersonnel] = useState<PersonnelWithAvailability[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [availabilityStats, setAvailabilityStats] = useState({ available: 0, unavailable: 0, total: 0 });

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [postingJob, setPostingJob] = useState(false);

  const [formData, setFormData] = useState({
    eventName: "",
    date: "",
    startTime: "",
    endTime: "",
    staffRequirements: [{ role: "Door Supervisor", quantity: 2, rate: 18 }] as StaffRequirement[],
    attireRequirement: "Smart black uniform",
    briefNotes: "",
  });

  // "Repeat booking" prefill: a past booking stashes its details in
  // sessionStorage; we hydrate the form once (date left blank for a new date).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("shield:rebook");
      if (!raw) return;
      sessionStorage.removeItem("shield:rebook");
      const p = JSON.parse(raw) as Partial<{
        eventName: string;
        startTime: string;
        endTime: string;
        staffRequirements: StaffRequirement[];
        attireRequirement: string;
        briefNotes: string;
      }>;
      setFormData((prev) => ({
        ...prev,
        eventName: p.eventName ?? prev.eventName,
        startTime: p.startTime ?? prev.startTime,
        endTime: p.endTime ?? prev.endTime,
        staffRequirements:
          Array.isArray(p.staffRequirements) && p.staffRequirements.length > 0
            ? p.staffRequirements
            : prev.staffRequirements,
        attireRequirement: p.attireRequirement ?? prev.attireRequirement,
        briefNotes: p.briefNotes ?? prev.briefNotes,
      }));
    } catch {
      // ignore malformed prefill
    }
  }, []);

  type LocationSource = "profile" | "saved" | "new";
  const [savedLocations, setSavedLocations] = useState<
    {
      id: string;
      label: string;
      address_line1: string | null;
      city: string | null;
      postcode: string | null;
      country_code: string | null;
      latitude: number;
      longitude: number;
      geofence_polygon?: GeoJsonPolygon | null;
    }[]
  >([]);
  const [locationSource, setLocationSource] = useState<LocationSource>(
    isAgency ? "new" : "profile",
  );
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState<string | null>(null);
  // Drawn on-site boundary for this booking (snapshot / override). Null = the
  // pin + radius fallback (or the saved site's own geofence) is used.
  const [siteGeofencePolygon, setSiteGeofencePolygon] =
    useState<GeoJsonPolygon | null>(null);
  // The boundary map is hidden by default so the optional, more advanced step
  // doesn't intimidate or block users. They opt in only if they want it.
  const [showBoundaryEditor, setShowBoundaryEditor] = useState(false);
  const [newSite, setNewSite] = useState({
    label: "",
    address_line1: "",
    city: "",
    postcode: "",
    country_code: DEFAULT_COUNTRY_CODE,
  });
  const newSiteRef = useRef(newSite);
  useEffect(() => {
    newSiteRef.current = newSite;
  }, [newSite]);
  /** Mapbox result; lockedQuery = buildAddressQuery when pin was set (clears if user edits address).
   *  precision: "exact" for address/poi picks, "approximate" for postcode/locality centroids
   *  chosen via the drill-down fallback (so we can warn the user it may be ~100m off). */
  const [newSiteGeocoded, setNewSiteGeocoded] = useState<{
    lat: number;
    lng: number;
    placeName: string;
    lockedQuery: string;
    precision: "exact" | "approximate";
  } | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // Agencies have no venue_locations library, so never offer to save there.
  const [saveNewSiteToLibrary, setSaveNewSiteToLibrary] = useState(!isAgency);
  /** Manual address fields start collapsed — most users only need the search. */
  const [newSiteManualOpen, setNewSiteManualOpen] = useState(false);

  const clearNewSitePin = useCallback(() => {
    setNewSiteGeocoded(null);
    setGeocodeError(null);
  }, []);

  // When the venue profile loads, default new-site country to the venue's
  // own country so the dropdown and geocoder start pre-filtered correctly.
  const venueCountryCode =
    ((venue as { country_code?: string | null } | null)?.country_code ??
      DEFAULT_COUNTRY_CODE)
      .toUpperCase();
  useEffect(() => {
    setNewSite((prev) =>
      prev.country_code === DEFAULT_COUNTRY_CODE && venueCountryCode
        ? { ...prev, country_code: venueCountryCode }
        : prev,
    );
    // Only react to venue-provided code. If the user has already changed the
    // country manually, leave it alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueCountryCode]);

  /** If the user already has typed manual data but no pin, default to manual-open. */
  useEffect(() => {
    if (newSiteGeocoded) return;
    const hasManualInput =
      newSite.address_line1.trim().length > 0 ||
      newSite.city.trim().length > 0 ||
      newSite.postcode.trim().length > 0;
    if (hasManualInput && !newSiteManualOpen) setNewSiteManualOpen(true);
  }, [newSite.address_line1, newSite.city, newSite.postcode, newSiteGeocoded, newSiteManualOpen]);

  const onPickSuggestion = useCallback((s: AddressSuggestion) => {
    const prev = newSiteRef.current;
    const merged = {
      label: prev.label,
      address_line1: s.address_line1 || prev.address_line1,
      city: s.city || prev.city,
      postcode: s.postcode || prev.postcode,
      country_code: s.country_code
        ? s.country_code.toUpperCase()
        : prev.country_code,
    };
    const isExact = s.place_type === "address" || s.place_type === "poi";
    setNewSite(merged);
    setNewSiteGeocoded({
      lat: s.center[1],
      lng: s.center[0],
      placeName: s.place_name,
      lockedQuery: buildAddressQuery({
        address_line1: merged.address_line1,
        city: merged.city,
        postcode: merged.postcode,
      }),
      precision: isExact ? "exact" : "approximate",
    });
    setGeocodeError(null);
  }, []);

  const setPinFromTypedAddress = useCallback(async () => {
    const q = buildAddressQuery(newSite);
    if (q.length < 3) {
      setGeocodeError(
        "Enter at least a few characters — street, site name, area, or postcode (door number optional).",
      );
      return;
    }
    setGeocodeLoading(true);
    setGeocodeError(null);
    try {
      const params = new URLSearchParams({ q });
      if (newSite.country_code) {
        params.set("country", newSite.country_code.toLowerCase());
      }
      const res = await fetch(`/api/geocode/suggest?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setNewSiteGeocoded(null);
        setGeocodeError(
          typeof data.error === "string" ? data.error : "Address lookup failed.",
        );
        return;
      }
      const results = data.results as
        | {
            place_name: string;
            center: [number, number];
            place_type?: string;
          }[]
        | undefined;
      if (!Array.isArray(results) || results.length === 0) {
        setNewSiteGeocoded(null);
        setGeocodeError(
          "Couldn't place that on the map. Try adding a city or postcode, or spell out the area.",
        );
        return;
      }
      const first = results[0];
      const [lng, lat] = first.center;
      const isExact =
        first.place_type === "address" || first.place_type === "poi";
      setNewSiteGeocoded({
        lat,
        lng,
        placeName: first.place_name,
        lockedQuery: q,
        precision: isExact ? "exact" : "approximate",
      });
      setGeocodeError(null);
    } catch {
      setNewSiteGeocoded(null);
      setGeocodeError("Could not reach address lookup.");
    } finally {
      setGeocodeLoading(false);
    }
  }, [newSite]);

  const hasProfileCoords = useMemo(() => {
    if (!venue) return false;
    const la = Number(venue.latitude);
    const lo = Number(venue.longitude);
    return Number.isFinite(la) && Number.isFinite(lo) && (la !== 0 || lo !== 0);
  }, [venue]);

  useEffect(() => {
    if (isAgency || !venue?.id || !supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("venue_locations")
        .select(
          "id, label, address_line1, city, postcode, country_code, latitude, longitude, geofence_polygon",
        )
        .eq("venue_id", venue.id)
        .order("label");
      if (error && isMissingColumnError(error)) {
        // Schema predates migration 0057 — load without the geofence column.
        const fb = await supabase
          .from("venue_locations")
          .select(
            "id, label, address_line1, city, postcode, country_code, latitude, longitude",
          )
          .eq("venue_id", venue.id)
          .order("label");
        if (!cancelled && !fb.error && fb.data) setSavedLocations(fb.data);
      } else if (!cancelled && !error && data) {
        setSavedLocations(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAgency, venue?.id, supabase]);

  useEffect(() => {
    if (locationSource === "saved" && savedLocations.length > 0 && !selectedSavedLocationId) {
      setSelectedSavedLocationId(savedLocations[0].id);
    }
  }, [locationSource, savedLocations, selectedSavedLocationId]);

  useEffect(() => {
    if (!newSiteGeocoded) return;
    const current = buildAddressQuery({
      address_line1: newSite.address_line1,
      city: newSite.city,
      postcode: newSite.postcode,
    });
    if (current !== newSiteGeocoded.lockedQuery) {
      setNewSiteGeocoded(null);
    }
  }, [newSite.address_line1, newSite.city, newSite.postcode, newSiteGeocoded]);

  /** If the venue profile has no map pin, move off "Main venue address" once options are known. */
  useEffect(() => {
    if (!venue || hasProfileCoords) return;
    if (locationSource !== "profile") return;
    if (savedLocations.length > 0) {
      setLocationSource("saved");
      setSelectedSavedLocationId(savedLocations[0].id);
    } else {
      setLocationSource("new");
    }
  }, [venue, hasProfileCoords, savedLocations, locationSource]);

  const siteReady = useMemo(() => {
    if (!venue) return false;
    if (locationSource === "profile") return hasProfileCoords;
    if (locationSource === "saved") return !!selectedSavedLocationId;
    if (locationSource === "new") {
      // A label + confirmed map pin is sufficient. Postcode is optional
      // (some countries don't have one; in others users might only fill in
      // a street/city and rely on the pin for geofencing).
      return (
        newSite.label.trim().length > 0 &&
        newSiteGeocoded != null &&
        Number.isFinite(newSiteGeocoded.lat) &&
        Number.isFinite(newSiteGeocoded.lng)
      );
    }
    return false;
  }, [
    venue,
    locationSource,
    selectedSavedLocationId,
    newSite.label,
    newSiteGeocoded,
    hasProfileCoords,
  ]);

  // Effective check-in pin coordinates for the geofence editor, by source.
  const editorSite = useMemo<{ lat: number; lng: number } | null>(() => {
    if (locationSource === "profile" && hasProfileCoords && venue) {
      return { lat: Number(venue.latitude), lng: Number(venue.longitude) };
    }
    if (locationSource === "saved" && selectedSavedLocationId) {
      const loc = savedLocations.find((s) => s.id === selectedSavedLocationId);
      if (loc) return { lat: loc.latitude, lng: loc.longitude };
    }
    if (
      locationSource === "new" &&
      newSiteGeocoded &&
      Number.isFinite(newSiteGeocoded.lat) &&
      Number.isFinite(newSiteGeocoded.lng)
    ) {
      return { lat: newSiteGeocoded.lat, lng: newSiteGeocoded.lng };
    }
    return null;
  }, [
    locationSource,
    hasProfileCoords,
    venue,
    selectedSavedLocationId,
    savedLocations,
    newSiteGeocoded,
  ]);

  // Seed the boundary from the saved site's own geofence (if any) when the
  // source/site changes; reset to none for profile/new sites.
  useEffect(() => {
    if (locationSource === "saved" && selectedSavedLocationId) {
      const loc = savedLocations.find((s) => s.id === selectedSavedLocationId);
      setSiteGeofencePolygon(loc?.geofence_polygon ?? null);
    } else {
      setSiteGeofencePolygon(null);
    }
  }, [locationSource, selectedSavedLocationId, savedLocations]);

  const siteSummaryLine = useMemo(() => {
    if (!venue) return "";
    if (locationSource === "profile" && hasProfileCoords) {
      return `${venue.name} — main account address`;
    }
    if (locationSource === "saved" && selectedSavedLocationId) {
      const loc = savedLocations.find((s) => s.id === selectedSavedLocationId);
      if (!loc) return "";
      const tail = [loc.address_line1, loc.city, loc.postcode].filter(Boolean).join(", ");
      return tail ? `${loc.label} (${tail})` : loc.label;
    }
    if (locationSource === "new") {
      if (!newSite.label.trim() || !newSiteGeocoded) return "";
      const typed = buildAddressQuery(newSite);
      return typed
        ? `${newSite.label.trim()} — ${typed}`
        : newSite.label.trim();
    }
    return "";
  }, [
    venue,
    locationSource,
    hasProfileCoords,
    selectedSavedLocationId,
    savedLocations,
    newSite.label,
    newSite.address_line1,
    newSite.city,
    newSite.postcode,
    newSiteGeocoded,
  ]);

  const persistBookingSite = useCallback(async (): Promise<{
    venue_location_id: string | null;
    site_label: string;
    site_address_text: string;
    site_latitude: number;
    site_longitude: number;
    site_country_code: string;
  }> => {
    if (!venue) throw new Error("Venue not loaded");
    if (!supabase) throw new Error("Not connected");
    if (locationSource === "profile") {
      const la = Number(venue.latitude);
      const lo = Number(venue.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) {
        throw new Error(
          "Your venue profile has no map pin. Pick a saved site or enter a new address.",
        );
      }
      const site_address_text =
        formatVenueAddressSnapshot(venue).trim() || venue.name.trim();
      return {
        venue_location_id: null,
        site_label: `${venue.name} — main account address`,
        site_address_text,
        site_latitude: la,
        site_longitude: lo,
        site_country_code: (
          (venue as { country_code?: string | null }).country_code ||
          DEFAULT_COUNTRY_CODE
        ).toUpperCase(),
      };
    }
    if (locationSource === "saved") {
      const loc = savedLocations.find((s) => s.id === selectedSavedLocationId);
      if (!loc) throw new Error("Select a saved site.");
      const site_address_text =
        formatVenueAddressSnapshot(loc).trim() || loc.label.trim();
      return {
        venue_location_id: loc.id,
        site_label: loc.label,
        site_address_text,
        site_latitude: loc.latitude,
        site_longitude: loc.longitude,
        site_country_code: (
          (loc as { country_code?: string | null }).country_code ||
          venueCountryCode ||
          DEFAULT_COUNTRY_CODE
        ).toUpperCase(),
      };
    }
    if (!newSiteGeocoded) {
      throw new Error('Click "Set check-in pin from this address" after typing the location.');
    }
    const lat = newSiteGeocoded.lat;
    const lng = newSiteGeocoded.lng;
    if (!newSite.label.trim()) {
      throw new Error("Enter a site name.");
    }
    let venueLocationId: string | null = null;
    if (saveNewSiteToLibrary) {
      const basePayload: Record<string, unknown> = {
        venue_id: venue.id,
        label: newSite.label.trim(),
        address_line1: newSite.address_line1.trim() || null,
        city: newSite.city.trim() || null,
        postcode: newSite.postcode.trim() || null,
        latitude: lat,
        longitude: lng,
      };
      const payload: Record<string, unknown> = {
        ...basePayload,
        country_code: (
          newSite.country_code || DEFAULT_COUNTRY_CODE
        ).toUpperCase(),
      };
      let { data: inserted, error: locErr } = await supabase
        .from("venue_locations")
        .insert(payload)
        .select("id")
        .single();
      // Graceful degradation: if the migration hasn't been applied yet, retry
      // without the new column so existing venues aren't blocked from booking.
      if (locErr && isMissingColumnError(locErr)) {
        console.warn(
          "[Booking] venue_locations missing country_code column — retrying without it. Apply migration 0053_venue_country_code.sql.",
        );
        ({ data: inserted, error: locErr } = await supabase
          .from("venue_locations")
          .insert(basePayload)
          .select("id")
          .single());
      }
      if (locErr) throw locErr;
      venueLocationId = inserted!.id;
    }
    const typed = buildAddressQuery(newSite).trim();
    let site_address_text =
      typed || newSiteGeocoded.placeName?.trim() || newSite.label.trim() || "";
    site_address_text = appendPostcodeIfMissing(site_address_text, newSite.postcode);
    return {
      venue_location_id: venueLocationId,
      site_label: newSite.label.trim(),
      site_address_text,
      site_latitude: lat,
      site_longitude: lng,
      site_country_code: (
        newSite.country_code || DEFAULT_COUNTRY_CODE
      ).toUpperCase(),
    };
  }, [
    venue,
    venueCountryCode,
    locationSource,
    savedLocations,
    selectedSavedLocationId,
    newSite.label,
    newSite.address_line1,
    newSite.city,
    newSite.postcode,
    newSite.country_code,
    newSiteGeocoded,
    saveNewSiteToLibrary,
    supabase,
  ]);

  // Fetch available personnel with smart availability checking
  useEffect(() => {
    const fetchAvailablePersonnel = async () => {
      if (!formData.date || !formData.startTime || !formData.endTime) return;

      setLoadingStaff(true);
      try {
        const { data, error } = await supabase
          .from("personnel")
          .select("*")
          .eq("is_active", true)
          .order("shield_score", { ascending: false });

        if (!error && data) {
          const personnelIds = data.map((p) => p.id);
          const { data: reviewRows } =
            personnelIds.length > 0
              ? await supabase
                  .from("reviews")
                  .select("reviewee_id, overall_rating")
                  .in("reviewee_id", personnelIds)
                  .eq("is_public", true)
              : { data: [] as any[] };

          const reputationById: Record<string, { sum: number; count: number }> = {};
          (reviewRows || []).forEach((row: any) => {
            if (!row.reviewee_id) return;
            if (!reputationById[row.reviewee_id]) reputationById[row.reviewee_id] = { sum: 0, count: 0 };
            reputationById[row.reviewee_id].sum += Number(row.overall_rating || 0);
            reputationById[row.reviewee_id].count += 1;
          });

          const personnelWithAvailability: PersonnelWithAvailability[] = [];
          let availableCount = 0;
          let unavailableCount = 0;

          for (const person of data) {
            const availabilityInfo = await checkPersonnelAvailabilityDetailed(
              supabase,
              person.id,
              formData.date,
              formData.startTime,
              formData.endTime,
            );

            const rep = reputationById[person.id];
            personnelWithAvailability.push({
              ...person,
              availabilityInfo,
              reputation: {
                avgRating: rep && rep.count > 0 ? Math.round((rep.sum / rep.count) * 10) / 10 : 0,
                totalReviews: rep?.count || 0,
              },
            });

            if (availabilityInfo.available) {
              availableCount++;
            } else {
              unavailableCount++;
            }
          }

          personnelWithAvailability.sort((a, b) => {
            if (a.availabilityInfo?.available && !b.availabilityInfo?.available) return -1;
            if (!a.availabilityInfo?.available && b.availabilityInfo?.available) return 1;
            const ratingDiff = (b.reputation?.avgRating || 0) - (a.reputation?.avgRating || 0);
            if (ratingDiff !== 0) return ratingDiff;
            return (b.shield_score || 0) - (a.shield_score || 0);
          });

          setAvailablePersonnel(personnelWithAvailability);
          setAvailabilityStats({ available: availableCount, unavailable: unavailableCount, total: data.length });
        }
      } catch (e) {
        console.error("Error fetching personnel:", e);
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchAvailablePersonnel();
  }, [formData.date, formData.startTime, formData.endTime, supabase]);

  const addStaffRequirement = () => {
    setFormData((prev) => ({
      ...prev,
      staffRequirements: [...prev.staffRequirements, { role: "Security Guard", quantity: 1, rate: 18 }],
    }));
  };

  const updateStaffRequirement = (index: number, field: keyof StaffRequirement, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      staffRequirements: prev.staffRequirements.map((req, i) => {
        if (i === index) {
          if (field === "role") {
            return { ...req, role: value as string };
          }
          return { ...req, [field]: value };
        }
        return req;
      }),
    }));
  };

  const removeStaffRequirement = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      staffRequirements: prev.staffRequirements.filter((_, i) => i !== index),
    }));
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaff((prev) => (prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]));
  };

  const calculateHours = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const [startH, startM] = formData.startTime.split(":").map(Number);
    const [endH, endM] = formData.endTime.split(":").map(Number);
    let hours = endH - startH + (endM - startM) / 60;
    if (hours <= 0) hours += 24;
    return hours;
  };

  const getScheduledRange = () => {
    const parsed = scheduledRangeFromFormParts(formData.date, formData.startTime, formData.endTime);
    if (parsed) return parsed;
    const eventDate = new Date(formData.date);
    const [startH, startM] = formData.startTime.split(":").map(Number);
    const [endH, endM] = formData.endTime.split(":").map(Number);
    const scheduledStart = new Date(eventDate);
    scheduledStart.setHours(startH, startM, 0, 0);
    const scheduledEnd = new Date(eventDate);
    scheduledEnd.setHours(endH, endM, 0, 0);
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd.setDate(scheduledEnd.getDate() + 1);
    }
    return { scheduledStart, scheduledEnd };
  };

  const calculateTotal = () => {
    const hours = calculateHours();
    return formData.staffRequirements.reduce((sum, req) => sum + req.quantity * req.rate * hours, 0);
  };

  const totalStaff = formData.staffRequirements.reduce((sum, req) => sum + req.quantity, 0);

  const estimatedTotalPounds = calculateTotal();
  const platformFeePounds = estimatedTotalPounds * 0.05;
  const grandTotalPounds = estimatedTotalPounds + platformFeePounds;
  const totalPence = Math.round(grandTotalPounds * 100);

  /* ── Initiate Stripe PaymentIntent when entering step 5 ── */
  const initiatePayment = async () => {
    if (!venue) return;

    setCreatingIntent(true);
    setPaymentError(null);

    try {
      const { scheduledEnd } = getScheduledRange();
      const now = Date.now();
      if (scheduledEnd.getTime() <= now) {
        setPaymentError(
          `That shift ends on ${formatShortDateTime(scheduledEnd)}, which is already before now (${formatShortDateTime(new Date(now))}). Guards only see shifts that are still ongoing or in the future. For an early-morning slot, choose tomorrow's date (or pick an end time later tonight).`,
        );
        setCreatingIntent(false);
        return;
      }

      const res = await fetch("/api/stripe/booking-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_pence: totalPence,
          event_name: formData.eventName,
          venue_id: isAgency ? null : venue.id,
          agency_id: isAgency ? venue.id : null,
        }),
      });
      const raw = await res.text();
      const data = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

      if (!res.ok) {
        if (data?.error) {
          setPaymentError(data.error);
        } else if (raw.trim().startsWith("<")) {
          setPaymentError(
            "Payment API returned an HTML response. Please ensure the web server is running on localhost:3000 and try again."
          );
        } else {
          setPaymentError("Failed to initiate payment");
        }
        setCreatingIntent(false);
        return;
      }

      if (!data || !data.client_secret || !data.payment_intent_id) {
        setPaymentError("Payment API returned an invalid response. Please try again.");
        setCreatingIntent(false);
        return;
      }

      setClientSecret(data.client_secret);
      setPaymentIntentId(data.payment_intent_id);
      setStep(5);
    } catch (e: any) {
      setPaymentError(e.message || "Something went wrong");
    } finally {
      setCreatingIntent(false);
    }
  };

  /* ── After payment succeeds, create booking + shifts + notify ── */
  const handlePaymentSuccess = async (piId: string) => {
    if (!venue) return;

    setPostingJob(true);

    let siteSnap: {
      venue_location_id: string | null;
      site_label: string;
      site_address_text: string;
      site_latitude: number;
      site_longitude: number;
      site_country_code: string;
    };
    try {
      siteSnap = await persistBookingSite();
    } catch (e: unknown) {
      console.error("[Booking] persistBookingSite failed:", describeError(e));
      if (isMissingColumnError(e)) {
        alert(
          "A database migration is missing on this environment. " +
            "Please apply the latest Supabase migrations (0053_venue_country_code.sql) and try again.\n\n" +
            "Details: " +
            errorMessage(e),
        );
      } else {
        alert(errorMessage(e) || "Could not save shift location.");
      }
      setPostingJob(false);
      return;
    }

    const hours = calculateHours();
    const canonicalStaffRequirements = toCanonicalStaffRequirements(formData.staffRequirements);
    const attireLine = `Attire requirement: ${formData.attireRequirement}`;
    const bookingNotes = [formData.briefNotes?.trim(), attireLine].filter(Boolean).join("\n");

    const baseBookingPayload: Record<string, unknown> = {
      ...(isAgency ? { agency_id: venue.id } : { venue_id: venue.id }),
      venue_location_id: siteSnap.venue_location_id,
      site_label: siteSnap.site_label,
      site_address_text: siteSnap.site_address_text.trim() || null,
      site_latitude: siteSnap.site_latitude,
      site_longitude: siteSnap.site_longitude,
      event_name: formData.eventName,
      event_date: formData.date,
      start_time: formData.startTime,
      end_time: formData.endTime,
      brief_notes: bookingNotes || null,
      staff_requirements: canonicalStaffRequirements,
      status: "pending",
      estimated_total: Math.round(grandTotalPounds * 100) / 100,
      platform_fee: Math.round(platformFeePounds * 100) / 100,
      auto_assign: postToBoard,
      payment_status: "paid",
      stripe_payment_intent_id: piId,
    };
    const bookingPayload: Record<string, unknown> = {
      ...baseBookingPayload,
      site_country_code: siteSnap.site_country_code,
    };
    let { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert(bookingPayload)
      .select()
      .single();
    if (bookingError && isMissingColumnError(bookingError)) {
      console.warn(
        "[Booking] bookings missing site_country_code column — retrying without it. Apply migration 0053_venue_country_code.sql.",
      );
      ({ data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert(baseBookingPayload)
        .select()
        .single());
    }

    if (bookingError || !booking) {
      console.error(
        "[Booking] insert after payment failed:",
        describeError(bookingError),
      );
      if (isMissingColumnError(bookingError)) {
        alert(
          "Payment succeeded but the booking could not be saved — a database " +
            "migration is missing (0053_venue_country_code.sql). Apply the " +
            "latest Supabase migrations, then contact support with payment " +
            "reference: " +
            piId +
            "\n\nDetails: " +
            errorMessage(bookingError),
        );
      } else {
        alert(
          "Payment succeeded but booking creation failed. Contact support " +
            "with payment reference: " +
            piId +
            "\n\nDetails: " +
            errorMessage(bookingError),
        );
      }
      setPostingJob(false);
      return;
    }

    // Persist the drawn on-site boundary (best-effort). Snapshots onto the
    // booking and, when this booking saved/used a library site, onto that saved
    // site too so future bookings inherit it. Silently ignored if the 0057
    // geofence columns aren't present yet.
    if (siteGeofencePolygon) {
      const centroid = polygonCentroid(siteGeofencePolygon);
      const { error: geoErr } = await supabase
        .from("bookings")
        .update({ site_geofence_polygon: siteGeofencePolygon })
        .eq("id", booking.id);
      if (geoErr && !isMissingColumnError(geoErr)) {
        console.warn("[Booking] geofence snapshot failed:", errorMessage(geoErr));
      }
      if (siteSnap.venue_location_id) {
        await supabase
          .from("venue_locations")
          .update({
            geofence_polygon: siteGeofencePolygon,
            geofence_centroid_lat: centroid?.lat ?? null,
            geofence_centroid_lng: centroid?.lng ?? null,
            geofence_updated_at: new Date().toISOString(),
          })
          .eq("id", siteSnap.venue_location_id);
      }
    }

    // Create shifts — assign specific staff first, then post remaining to board
    const shiftsToCreate: any[] = [];
    const { scheduledStart, scheduledEnd } = getScheduledRange();
    if (scheduledEnd.getTime() <= Date.now()) {
      alert(
        `This shift ends at ${formatShortDateTime(scheduledEnd)} — that time has already passed. Adjust the date or times and try again.`,
      );
      setPostingJob(false);
      return;
    }

    const roleSlots = canonicalStaffRequirements.flatMap((req) =>
      Array.from({ length: req.count }, () => ({ role: req.role, rate: req.rate_pence / 100 })),
    );

    let assigned = 0;

    if (selectSpecific && selectedStaff.length > 0) {
      for (const personnelId of selectedStaff) {
        if (assigned >= roleSlots.length) break;
        const slot = roleSlots[assigned];
        const person = availablePersonnel.find((p) => p.id === personnelId);
        shiftsToCreate.push({
          booking_id: booking.id,
          personnel_id: personnelId,
          role: slot.role,
          hourly_rate: person?.hourly_rate || slot.rate,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: "pending",
        });
        assigned += 1;
      }
    }

    const shouldPostRemainder = postToBoard || assigned < roleSlots.length;
    if (shouldPostRemainder) {
      for (let i = assigned; i < roleSlots.length; i++) {
        const slot = roleSlots[i];
        shiftsToCreate.push({
          booking_id: booking.id,
          personnel_id: null,
          role: slot.role,
          hourly_rate: slot.rate,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: "pending",
        });
      }
    }

    if (shiftsToCreate.length > 0) {
      const { error: shiftsError } = await supabase.from("shifts").insert(shiftsToCreate);
      if (shiftsError) console.error("Shifts error:", shiftsError);
    }

    // Smart notify guards
    try {
      const notifyRes = await fetch("/api/shifts/notify-guards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      const notifyRaw = await notifyRes.text();
      const notifyData = notifyRaw
        ? (() => {
            try {
              return JSON.parse(notifyRaw);
            } catch {
              return null;
            }
          })()
        : null;
      const offersCreated = Number(notifyData?.offers_created ?? 0);
      const guardsNotified = Number(notifyData?.guards_notified ?? 0);
      if (!notifyData?.success || offersCreated <= 0 || guardsNotified <= 0) {
        const { data: allPersonnel } = await supabase.from("personnel").select("user_id").eq("is_active", true);
        if (allPersonnel && allPersonnel.length > 0) {
          const eventDateStr = new Date(formData.date).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          const notifications = allPersonnel
            .filter((p) => p.user_id)
            .map((p) => ({
              user_id: p.user_id,
              type: "shift" as const,
              title: "New Shifts Available!",
              body: `${shiftsToCreate.length} shift${shiftsToCreate.length > 1 ? "s" : ""} at ${siteSnap.site_label} on ${eventDateStr}. Attire: ${formData.attireRequirement}. Tap to claim!`,
              data: { booking_id: booking.id },
            }));
          if (notifications.length > 0) {
            await supabase.from("notifications").insert(notifications);
          }
        }
      }
    } catch (notifyErr) {
      console.error("Error calling notify-guards API:", notifyErr);
    }

    // Notify venue owner
    await supabase.from("notifications").insert({
      user_id: venue.user_id,
      type: "booking",
      title: "Job Posted!",
      body: `Your booking for "${formData.eventName}" is now live. Attire set: ${formData.attireRequirement}. ${shiftsToCreate.length} shift${shiftsToCreate.length > 1 ? "s" : ""} available for guards to claim.`,
      data: { booking_id: booking.id, attire_requirement: formData.attireRequirement },
    });

    setStep(6); // success step
    setPostingJob(false);
  };

  if (venueLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const stepLabels = [
    { num: 1, label: "Event Details" },
    { num: 2, label: "Staff Requirements" },
    { num: 3, label: "Select Staff" },
    { num: 4, label: "Review" },
    { num: 5, label: "Payment" },
  ];
  const currentStepLabel = stepLabels.find((s) => s.num === step)?.label ?? "";

  // Plain-language reasons the current step can't be completed yet. Shown
  // inline next to the Next button so users never wonder why it's disabled.
  const step1Issues: string[] = [];
  if (!formData.eventName) step1Issues.push("Add an event name");
  if (!formData.date) step1Issues.push("Pick a date");
  if (!formData.startTime) step1Issues.push("Set a start time");
  if (!formData.endTime) step1Issues.push("Set an end time");
  if (!siteReady) step1Issues.push("Choose where the event is");

  const step2Issues: string[] = [];
  if (formData.staffRequirements.length === 0) {
    step2Issues.push("Add at least one role");
  }
  if (formData.staffRequirements.some((r) => !r.quantity || r.quantity < 1)) {
    step2Issues.push("Each role needs at least 1 guard");
  }
  if (formData.staffRequirements.some((r) => !r.rate || r.rate <= 0)) {
    step2Issues.push("Set an hourly rate for every role");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href={`${basePath}/bookings`} className="text-zinc-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bookings
        </Link>
        <h1 className="text-2xl font-bold text-white">Book Security</h1>
        <p className="text-sm text-zinc-400">Fill in the details, select your team, and pay to post</p>
      </div>

      {/* Progress Steps */}
      {step <= 5 && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-purple-300">
            Step {step} of {stepLabels.length}: {currentStepLabel}
          </p>
          <p className="text-xs text-zinc-500">
            {Math.round((step / stepLabels.length) * 100)}% complete
          </p>
        </div>
      )}
      {step <= 5 && (
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {stepLabels.map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2 shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                  step >= s.num ? "bg-purple-500 text-white" : "bg-white/10 text-zinc-500"
                }`}
              >
                {step > s.num ? "✓" : s.num}
              </div>
              <span className={`text-sm whitespace-nowrap ${step >= s.num ? "text-white" : "text-zinc-500"}`}>{s.label}</span>
              {idx < stepLabels.length - 1 && (
                <div className={`w-6 h-0.5 ${step > s.num ? "bg-purple-500" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 6: Success ── */}
      {step === 6 && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 mx-auto mb-4">
            <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Successful &amp; Job Posted!</h2>
          <p className="text-zinc-400 mb-6">
            Your payment of <span className="text-emerald-400 font-semibold">£{(totalPence / 100).toFixed(2)}</span> has been processed.
            All security guards have been notified and can now claim shifts from the job board.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push(`${basePath}/bookings`)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-medium transition"
            >
              View Bookings
            </button>
            <button
              onClick={() => router.push(basePath)}
              className="border border-white/10 bg-white/[0.04] px-6 py-3 rounded-xl text-zinc-300 font-medium transition hover:bg-white/[0.08]"
            >
              Dashboard
            </button>
          </div>
        </motion.div>
      )}

      {step <= 5 && (
        <div className="glass rounded-xl p-6">
          {/* Step 1: Event Details */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="text-lg font-semibold text-white">Event Details</h2>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Event Name</label>
                <input
                  type="text"
                  value={formData.eventName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                  placeholder="e.g. Friday Night, VIP Event"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {calculateHours() > 0 && (
                <p className="text-sm text-zinc-400">
                  Duration: <span className="text-white font-medium">{calculateHours()} hours</span>
                </p>
              )}

              <div className="border border-white/10 rounded-2xl p-5 space-y-5 bg-white/[0.02]">
                <div>
                  <h3 className="text-base font-semibold text-white">Where is this shift?</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isAgency
                      ? "This is where guards will check in. Search for the client site's address."
                      : "This is where guards will check in. Pick one of your venues or search for somewhere new."}
                  </p>
                </div>

                {/* 3-way chooser as proper cards (venues only — agencies always
                    enter the site address directly) */}
                {!isAgency && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(() => {
                    const selectedClasses =
                      "border-purple-500/60 bg-purple-500/10 ring-1 ring-purple-500/40";
                    const baseClasses =
                      "border border-white/10 bg-white/[0.02] hover:border-white/20";
                    const disabledClasses =
                      "border border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed";

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setLocationSource("profile")}
                          disabled={!hasProfileCoords}
                          className={`rounded-xl p-3 text-left transition ${
                            !hasProfileCoords
                              ? disabledClasses
                              : locationSource === "profile"
                                ? selectedClasses
                                : baseClasses
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏢</span>
                            <p className="text-sm font-medium text-white">
                              This venue
                            </p>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 truncate">
                            {hasProfileCoords && venue?.name
                              ? venue.name
                              : "Profile needs an address"}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLocationSource("saved")}
                          disabled={savedLocations.length === 0}
                          className={`rounded-xl p-3 text-left transition ${
                            savedLocations.length === 0
                              ? disabledClasses
                              : locationSource === "saved"
                                ? selectedClasses
                                : baseClasses
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📍</span>
                            <p className="text-sm font-medium text-white">
                              Saved site
                            </p>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 truncate">
                            {savedLocations.length === 0
                              ? "You haven't saved any yet"
                              : `${savedLocations.length} ${savedLocations.length === 1 ? "site" : "sites"} saved`}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setLocationSource("new")}
                          className={`rounded-xl p-3 text-left transition ${
                            locationSource === "new" ? selectedClasses : baseClasses
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">➕</span>
                            <p className="text-sm font-medium text-white">
                              New place
                            </p>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 truncate">
                            Search a postcode or address
                          </p>
                        </button>
                      </>
                    );
                  })()}
                </div>
                )}

                {/* ── Panel: main venue ── */}
                {locationSource === "profile" && (
                  <>
                    {hasProfileCoords && venue ? (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">🏢</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white truncate">
                              {venue.name}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">
                              {[venue.address_line1, venue.city, venue.postcode]
                                .filter(Boolean)
                                .join(", ") || "Address on file"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <p className="text-sm text-amber-200">
                          Your venue profile doesn&apos;t have a map pin yet.
                        </p>
                        <Link
                          href="/d/venue/settings"
                          className="mt-1 inline-block text-xs text-amber-300 hover:text-amber-200 underline"
                        >
                          Add your address in settings →
                        </Link>
                      </div>
                    )}
                  </>
                )}

                {/* ── Panel: saved site ── */}
                {locationSource === "saved" && savedLocations.length > 0 && (
                  <div className="space-y-2">
                    <select
                      value={selectedSavedLocationId || ""}
                      onChange={(e) =>
                        setSelectedSavedLocationId(e.target.value || null)
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none"
                    >
                      {savedLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.label}
                          {loc.city ? ` — ${loc.city}` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedSavedLocationId &&
                      (() => {
                        const sel = savedLocations.find(
                          (s) => s.id === selectedSavedLocationId,
                        );
                        if (!sel) return null;
                        const addr = [sel.address_line1, sel.city, sel.postcode]
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <p className="text-xs text-zinc-400 px-1">
                            {addr || "Saved location"}
                          </p>
                        );
                      })()}
                  </div>
                )}

                {/* ── Panel: new place ── */}
                {locationSource === "new" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Name this place *
                      </label>
                      <input
                        type="text"
                        value={newSite.label}
                        onChange={(e) =>
                          setNewSite((s) => ({ ...s, label: e.target.value }))
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm"
                        placeholder="e.g. All Bar One — New Street"
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">
                        What guards will see in their shift list.
                      </p>
                    </div>

                    {/* State A: no pin yet → show the search prominently */}
                    {!newSiteGeocoded && (
                      <>
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-zinc-400 mb-1">
                            Country
                          </label>
                          <select
                            value={newSite.country_code}
                            onChange={(e) =>
                              setNewSite((p) => ({
                                ...p,
                                country_code: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <AddressAutocomplete
                          label="Find the address *"
                          help="Pick from the list — we'll fill the rest in."
                          onSelect={onPickSuggestion}
                          placeholder="Address, postcode, city or place name"
                          country={newSite.country_code.toLowerCase()}
                        />

                        <button
                          type="button"
                          onClick={() => setNewSiteManualOpen((v) => !v)}
                          className="text-xs text-zinc-400 hover:text-white transition inline-flex items-center gap-1"
                        >
                          <svg
                            className={`h-3 w-3 transition-transform ${newSiteManualOpen ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          {newSiteManualOpen
                            ? "Hide manual entry"
                            : "Can't find it? Enter manually"}
                        </button>
                      </>
                    )}

                    {/* State B: pin set → clean confirmation card */}
                    {newSiteGeocoded && (
                      <div
                        className={`rounded-xl border p-4 ${
                          newSiteGeocoded.precision === "exact"
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-amber-500/40 bg-amber-500/10"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-xl">
                            {newSiteGeocoded.precision === "exact" ? "📍" : "📮"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-white">
                                {newSiteGeocoded.precision === "exact"
                                  ? "Exact check-in pin set"
                                  : "Approximate pin — area centre"}
                              </p>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                  newSiteGeocoded.precision === "exact"
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : "bg-amber-500/20 text-amber-200"
                                }`}
                              >
                                {newSiteGeocoded.precision}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-300 break-words">
                              {newSiteGeocoded.placeName}
                            </p>
                            {newSiteGeocoded.precision === "approximate" && (
                              <p className="mt-1.5 text-[11px] text-amber-200/90">
                                Heads up — this pin is the area centre and may
                                be up to ~100m from the actual door. For
                                accurate check-in, change to a specific address
                                below.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-4 text-xs">
                          <button
                            type="button"
                            onClick={clearNewSitePin}
                            className="text-zinc-300 hover:text-white transition"
                          >
                            Change address
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewSiteManualOpen((v) => !v)}
                            className="text-zinc-300 hover:text-white transition inline-flex items-center gap-1"
                          >
                            <svg
                              className={`h-3 w-3 transition-transform ${newSiteManualOpen ? "rotate-90" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            {newSiteManualOpen
                              ? "Hide details"
                              : "Edit address details"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual fields — collapsed by default, visible when toggled */}
                    {newSiteManualOpen && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Address / location
                          </label>
                          <textarea
                            value={newSite.address_line1}
                            onChange={(e) =>
                              setNewSite((s) => ({
                                ...s,
                                address_line1: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full resize-y bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600"
                            placeholder="e.g. Broad Street, city centre"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">
                              Town / city
                            </label>
                            <input
                              type="text"
                              value={newSite.city}
                              onChange={(e) =>
                                setNewSite((s) => ({
                                  ...s,
                                  city: e.target.value,
                                }))
                              }
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                              placeholder="e.g. Birmingham"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">
                              Postcode / ZIP{" "}
                              <span className="text-zinc-500">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={newSite.postcode}
                              onChange={(e) =>
                                setNewSite((s) => ({
                                  ...s,
                                  postcode: e.target.value,
                                }))
                              }
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                              placeholder="e.g. B1 2PW, L-1234"
                            />
                          </div>
                        </div>

                        {!newSiteGeocoded && (
                          <button
                            type="button"
                            onClick={() => void setPinFromTypedAddress()}
                            disabled={
                              geocodeLoading ||
                              (newSite.address_line1.trim().length === 0 &&
                                newSite.postcode.trim().length === 0)
                            }
                            className="w-full rounded-lg border border-purple-500/30 bg-purple-500/15 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {geocodeLoading
                              ? "Finding…"
                              : "Drop pin from these fields"}
                          </button>
                        )}

                        {geocodeError && (
                          <p className="text-xs text-amber-400">{geocodeError}</p>
                        )}
                      </div>
                    )}

                    {!isAgency && (
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 pt-1">
                        <input
                          type="checkbox"
                          checked={saveNewSiteToLibrary}
                          onChange={(e) => setSaveNewSiteToLibrary(e.target.checked)}
                          className="rounded border-white/20"
                        />
                        <span className="text-xs text-zinc-300">
                          Save this place for next time
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Unified ready state at the bottom */}
                {siteReady && siteSummaryLine && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <span className="text-emerald-400 mt-0.5 shrink-0">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-emerald-300">
                        Ready — guards will check in here
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-300 break-words">
                        {siteSummaryLine}
                      </p>
                    </div>
                  </div>
                )}

                {/* Optional: draw the area guards must stay inside. Hidden by
                 * default so it never blocks or overwhelms the user. */}
                {siteReady && editorSite && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Draw the area guards must stay inside{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          (optional)
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Most venues can skip this. For large or unusual sites you can
                        draw the exact area on a map so the app knows when guards
                        arrive and if they wander off. If you skip it, we simply check
                        guards in when they reach the address.
                      </p>
                    </div>

                    {!showBoundaryEditor ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBoundaryEditor(true)}
                          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08]"
                        >
                          Draw the area on a map
                        </button>
                        <span className="text-[11px] text-zinc-500">
                          {siteGeofencePolygon
                            ? "Area set — tap to edit."
                            : "Skipped — we'll check guards in at the address."}
                        </span>
                      </div>
                    ) : (
                      <>
                        <GeofenceEditor
                          key={`${locationSource}-${selectedSavedLocationId ?? "x"}-${editorSite.lat.toFixed(5)}`}
                          siteLat={editorSite.lat}
                          siteLng={editorSite.lng}
                          value={siteGeofencePolygon}
                          onChange={setSiteGeofencePolygon}
                          className="h-[320px] w-full"
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-zinc-500">
                            {siteGeofencePolygon
                              ? "Area set for this booking."
                              : "No area drawn yet — you can still skip this."}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSiteGeofencePolygon(null);
                              setShowBoundaryEditor(false);
                            }}
                            className="text-[11px] font-medium text-zinc-400 underline-offset-2 hover:text-white hover:underline"
                          >
                            Skip for now
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {step1Issues.length > 0 && (
                  <p className="text-xs text-amber-300/90 text-right">
                    Before you continue: {step1Issues.join(", ")}.
                  </p>
                )}
                <motion.button
                  onClick={() => setStep(2)}
                  disabled={step1Issues.length > 0}
                  className="bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition"
                  whileHover={step1Issues.length > 0 ? undefined : { scale: 1.02 }}
                  whileTap={step1Issues.length > 0 ? undefined : { scale: 0.98 }}
                >
                  Next: Staff Requirements &rarr;
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Staff Requirements */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Staff Requirements</h2>
                <button onClick={addStaffRequirement} className="text-sm text-purple-400 hover:text-purple-300 transition">
                  + Add Role
                </button>
              </div>

              <div className="space-y-3">
                {formData.staffRequirements.map((req, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white/5 rounded-lg p-3">
                    <select
                      value={req.role}
                      onChange={(e) => updateStaffRequirement(index, "role", e.target.value)}
                      className="col-span-5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none transition"
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.value}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-3 flex items-center gap-2">
                      <input
                        type="number"
                        value={req.quantity}
                        onChange={(e) => updateStaffRequirement(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none transition text-center"
                        min="1"
                      />
                      <span className="text-zinc-500 text-sm">staff</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-1 justify-end">
                      <span className="text-emerald-400 font-medium">£</span>
                      <input
                        type="number"
                        value={req.rate}
                        onChange={(e) => updateStaffRequirement(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-emerald-400 text-sm font-medium focus:border-purple-500 focus:outline-none transition text-center"
                        min="1"
                        step="0.50"
                      />
                      <span className="text-zinc-500 text-sm">/hr</span>
                    </div>
                    <button
                      onClick={() => removeStaffRequirement(index)}
                      className="col-span-1 text-red-400 hover:text-red-300 transition p-2"
                      disabled={formData.staffRequirements.length === 1}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Brief Notes (Optional)</label>
                <textarea
                  value={formData.briefNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, briefNotes: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition h-24 resize-none"
                  placeholder="Any special requirements, dress code, areas to focus on..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-400 mb-1 inline-flex items-center gap-1.5">
                  Required Attire
                  <HelpHint label="What is required attire?">
                    This is the dress code guards must turn up in &mdash; for example a smart black uniform,
                    hi-vis, or smart casual. We include it in the job alert so every guard knows exactly what
                    to wear before they accept the shift.
                  </HelpHint>
                </label>
                <select
                  value={formData.attireRequirement}
                  onChange={(e) => setFormData((prev) => ({ ...prev, attireRequirement: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none transition"
                >
                  {attireOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-300 mt-2">
                  Notification preview: Guards will be alerted with "{formData.attireRequirement}".
                </p>
              </div>

              <div className="flex items-end justify-between gap-3">
                <button onClick={() => setStep(1)} className="text-zinc-400 hover:text-white transition pb-2">
                  &larr; Back
                </button>
                <div className="flex flex-col items-end gap-2">
                  {step2Issues.length > 0 && (
                    <p className="text-xs text-amber-300/90 text-right">
                      Before you continue: {step2Issues.join(", ")}.
                    </p>
                  )}
                  <motion.button
                    onClick={() => setStep(3)}
                    disabled={step2Issues.length > 0}
                    className="bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium transition"
                    whileHover={step2Issues.length > 0 ? undefined : { scale: 1.02 }}
                    whileTap={step2Issues.length > 0 ? undefined : { scale: 0.98 }}
                  >
                    Next: Select Staff &rarr;
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Assign Staff */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white">How would you like to fill this job?</h2>
                <p className="text-sm text-zinc-400 mt-1">Choose one or both assignment methods</p>
              </div>

              {/* Post to Job Board toggle */}
              <button
                onClick={() => setPostToBoard(!postToBoard)}
                className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition text-left ${
                  postToBoard ? "border-emerald-500 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="text-3xl shrink-0">🚀</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">Post to Job Board</p>
                  <p className="text-sm text-zinc-400 mt-1">All security guards get notified instantly. First to claim gets the shift — like Uber.</p>
                </div>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    postToBoard ? "border-emerald-500 bg-emerald-500" : "border-white/20"
                  }`}
                >
                  {postToBoard && (
                    <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Select Specific Staff toggle */}
              <button
                onClick={() => setSelectSpecific(!selectSpecific)}
                className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition text-left ${
                  selectSpecific ? "border-purple-500 bg-purple-500/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span className="text-3xl shrink-0">👥</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">Select Specific Staff</p>
                  <p className="text-sm text-zinc-400 mt-1">Handpick trusted guards from your network. They&apos;ll be notified directly.</p>
                </div>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    selectSpecific ? "border-purple-500 bg-purple-500" : "border-white/20"
                  }`}
                >
                  {selectSpecific && (
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Validation warning */}
              {!postToBoard && !selectSpecific && (
                <p className="text-center text-sm text-amber-400">Please select at least one assignment method</p>
              )}

              {/* Combined mode info */}
              {postToBoard && selectSpecific && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-sm text-purple-300">
                    <span className="font-semibold text-white">Both selected:</span> Your handpicked staff will be assigned first. Any remaining shifts will be posted to the job board for other guards to claim.
                  </p>
                </div>
              )}

              {/* Job Board info (only when board is sole method) */}
              {postToBoard && !selectSpecific && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <p className="font-medium text-white">How Job Board Works</p>
                      <p className="text-sm text-zinc-400 mt-1">Like Uber or DoorDash — guards claim shifts instantly</p>
                      <ul className="text-sm text-zinc-400 mt-2 space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">1.</span> All guards get notified instantly
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">2.</span> They see the job on their board
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">3.</span> First to tap &ldquo;Claim&rdquo; gets the shift
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400">4.</span> Mission Control chat activates
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Personnel picker (shown when Select Specific is on) */}
              <AnimatePresence>
                {selectSpecific && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{loadingStaff ? "..." : availabilityStats.available}</p>
                        <p className="text-xs text-zinc-400">Available</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-amber-400">{loadingStaff ? "..." : availabilityStats.unavailable}</p>
                        <p className="text-xs text-zinc-400">Unavailable</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-white">{loadingStaff ? "..." : selectedStaff.length}</p>
                        <p className="text-xs text-zinc-400">Selected</p>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400">
                      Showing availability for {formData.date} &bull; {formData.startTime} - {formData.endTime}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setStaffFilter("available")}
                        className={`px-3 py-1.5 rounded-lg text-sm transition ${
                          staffFilter === "available"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                            : "bg-white/5 text-zinc-400 border border-white/10"
                        }`}
                      >
                        Available Only
                      </button>
                      <button
                        onClick={() => setStaffFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-sm transition ${
                          staffFilter === "all"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                            : "bg-white/5 text-zinc-400 border border-white/10"
                        }`}
                      >
                        Show All
                      </button>
                    </div>

                    <div className="grid gap-3 max-h-96 overflow-y-auto">
                      {availablePersonnel
                        .filter((staff) => staffFilter === "all" || staff.availabilityInfo?.available)
                        .map((staff) => {
                          const isAvailable = staff.availabilityInfo?.available;
                          const isSelected = selectedStaff.includes(staff.id);
                          return (
                            <motion.div
                              key={staff.id}
                              onClick={() => isAvailable && toggleStaffSelection(staff.id)}
                              className={`p-4 rounded-xl transition ${
                                !isAvailable
                                  ? "bg-red-500/5 border border-red-500/20 opacity-60 cursor-not-allowed"
                                  : isSelected
                                    ? "bg-purple-500/20 border border-purple-500 cursor-pointer"
                                    : "bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer"
                              }`}
                              whileHover={isAvailable ? { scale: 1.01 } : {}}
                              whileTap={isAvailable ? { scale: 0.99 } : {}}
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                                    !isAvailable
                                      ? "bg-red-500/20 text-red-400"
                                      : isSelected
                                        ? "bg-purple-500 text-white"
                                        : "bg-gradient-to-br from-shield-500 to-emerald-500 text-white"
                                  }`}
                                >
                                  {!isAvailable ? "✗" : isSelected ? "✓" : staff.display_name?.charAt(0) || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-white">{staff.display_name}</p>
                                    {isAvailable ? (
                                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Available</span>
                                    ) : (
                                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Unavailable</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
                                    <span className="text-shield-400">Shield: {staff.shield_score || 0}</span>
                                    <span>{staff.total_shifts || 0} shifts</span>
                                    {staff.reputation && staff.reputation.totalReviews > 0 && (
                                      <span className="text-amber-400">
                                        {staff.reputation.avgRating.toFixed(1)}★ ({staff.reputation.totalReviews})
                                      </span>
                                    )}
                                    {staff.city && <span>{staff.city}</span>}
                                  </div>
                                  {!isAvailable && staff.availabilityInfo?.reason && (
                                    <p className="text-xs text-red-400 mt-1">
                                      {staff.availabilityInfo.reason}
                                      {staff.availabilityInfo.conflictingShifts && staff.availabilityInfo.conflictingShifts.length > 0 && (
                                        <span> ({staff.availabilityInfo.conflictingShifts.length} conflict)</span>
                                      )}
                                    </p>
                                  )}
                                  {isAvailable && staff.availabilityInfo?.availabilityWindow && (
                                    <p className="text-xs text-emerald-400 mt-1">
                                      Window: {staff.availabilityInfo.availabilityWindow.start} - {staff.availabilityInfo.availabilityWindow.end}
                                    </p>
                                  )}
                                  {staff.skills && staff.skills.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {(staff.skills as string[]).slice(0, 3).map((skill: string) => (
                                        <span key={skill} className="text-[10px] bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded">
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className={`text-lg font-bold ${isAvailable ? "text-emerald-400" : "text-zinc-500"}`}>
                                    £{staff.hourly_rate || 16}
                                  </p>
                                  <p className="text-xs text-zinc-500">/hour</p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}

                      {availablePersonnel.length === 0 && !loadingStaff && (
                        <p className="text-center text-zinc-500 py-8">No personnel available. They will be notified when you create the booking.</p>
                      )}
                    </div>

                    {selectedStaff.length > 0 && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                        <p className="text-purple-400 font-medium">
                          {selectedStaff.length} staff selected
                          {postToBoard && selectedStaff.length < totalStaff && (
                            <span className="text-zinc-400 font-normal"> &bull; {totalStaff - selectedStaff.length} remaining to job board</span>
                          )}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="text-zinc-400 hover:text-white transition">
                  &larr; Back
                </button>
                <motion.button
                  onClick={() => setStep(4)}
                  disabled={!postToBoard && !selectSpecific}
                  className="bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-700 text-white px-6 py-2 rounded-xl font-medium transition"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Next: Review &rarr;
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <h2 className="text-lg font-semibold text-white">Review Your Booking</h2>

              <div className="bg-white/5 rounded-lg p-4 space-y-4">
                <div>
                  <p className="text-sm text-zinc-400">Event</p>
                  <p className="text-lg font-semibold text-white">{formData.eventName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-zinc-400">Date</p>
                    <p className="text-white">
                      {new Date(formData.date).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Time</p>
                    <p className="text-white">
                      {formData.startTime} - {formData.endTime} ({calculateHours()}hrs)
                    </p>
                  </div>
                </div>

                {siteSummaryLine && (
                  <div>
                    <p className="text-sm text-zinc-400">Shift location (check-in)</p>
                    <p className="text-white text-sm">{siteSummaryLine}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-zinc-400 mb-2">Assignment</p>
                  <div className="space-y-2">
                    {postToBoard && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                        <p className="text-emerald-400 font-medium">🚀 Job Board - All Guards Notified</p>
                        <div className="mt-2 space-y-1">
                          {formData.staffRequirements.map((req, idx) => (
                            <div key={idx} className="text-sm text-zinc-300">
                              {req.quantity}x {req.role} @ £{req.rate}/hr
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                          {selectSpecific && selectedStaff.length > 0
                            ? "Remaining unfilled shifts posted to board"
                            : "First guards to claim get the shifts"}
                        </p>
                      </div>
                    )}
                    {selectSpecific && selectedStaff.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-500 font-medium">👥 HANDPICKED STAFF ({selectedStaff.length})</p>
                        {availablePersonnel
                          .filter((s) => selectedStaff.includes(s.id))
                          .map((staff) => (
                            <div key={staff.id} className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                                  {staff.display_name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-white text-sm font-medium">{staff.display_name}</p>
                                  <p className="text-xs text-zinc-400">Shield: {staff.shield_score}</p>
                                </div>
                              </div>
                              <span className="text-emerald-400 font-medium">£{staff.hourly_rate || 16}/hr</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {formData.briefNotes && (
                  <div>
                    <p className="text-sm text-zinc-400">Notes</p>
                    <p className="text-white text-sm">{formData.briefNotes}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-zinc-400">Required attire</p>
                  <p className="text-white text-sm">{formData.attireRequirement}</p>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <h3 className="text-sm text-zinc-500 font-medium mb-3">PAYMENT BREAKDOWN</h3>
                <div className="flex justify-between">
                  <span className="text-zinc-300">
                    {totalStaff} staff &times; {calculateHours()}hrs
                  </span>
                  <span className="text-white font-medium">£{estimatedTotalPounds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-sm">Platform fee (5%)</span>
                  <span className="text-zinc-400 text-sm">£{platformFeePounds.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-white font-bold">Total to pay</span>
                    <span className="text-emerald-400 font-bold text-2xl">£{(totalPence / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {paymentError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-sm">{paymentError}</p>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setStep(3)} className="text-zinc-400 hover:text-white transition">
                  &larr; Back
                </button>
                <motion.button
                  onClick={initiatePayment}
                  disabled={creatingIntent}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-8 py-3 rounded-xl font-bold text-lg transition"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {creatingIntent ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Preparing Payment...
                    </span>
                  ) : (
                    <>Confirm &amp; Pay £{(totalPence / 100).toFixed(2)}</>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Stripe Payment Form */}
          {step === 5 && clientSecret && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15">
                  <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Secure Payment</h2>
                  <p className="text-sm text-zinc-400">
                    Pay £{(totalPence / 100).toFixed(2)} for &ldquo;{formData.eventName}&rdquo;
                  </p>
                </div>
              </div>

              {/* Quick summary */}
              <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{formData.eventName}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(formData.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {formData.startTime} - {formData.endTime} · {totalStaff} staff
                  </p>
                </div>
                <p className="text-emerald-400 font-bold text-xl">£{(totalPence / 100).toFixed(2)}</p>
              </div>

              {/* Plain-language reassurance: what paying actually does. */}
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-200/90">
                <span className="text-sm leading-none">ℹ️</span>
                <p>
                  When you pay, your job goes live and guards are notified straight away. Your money is held
                  securely and only released once the shifts are completed. If something falls through, you&rsquo;re
                  protected.
                </p>
              </div>

              {postingJob ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="animate-spin h-10 w-10 text-emerald-400 mb-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <p className="text-white font-medium">Payment successful! Posting job...</p>
                  <p className="text-zinc-400 text-sm mt-1">Notifying security guards...</p>
                </div>
              ) : (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: "night",
                      variables: {
                        colorPrimary: "#10B981",
                        colorBackground: "#18181b",
                        colorText: "#ffffff",
                        colorDanger: "#ef4444",
                        borderRadius: "12px",
                        fontFamily: "system-ui, sans-serif",
                      },
                    },
                  }}
                >
                  <CheckoutForm amountPence={totalPence} onSuccess={handlePaymentSuccess} />
                </Elements>
              )}

              {!postingJob && (
                <button
                  onClick={() => {
                    setStep(4);
                    setClientSecret(null);
                  }}
                  className="text-zinc-400 hover:text-white transition text-sm"
                >
                  &larr; Back to review
                </button>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
