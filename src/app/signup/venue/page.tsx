"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FadeIn, FloatingOrb, motion } from "@/components/ui/motion";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/forms/AddressAutocomplete";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/lib/countries";
import { isMissingColumnError } from "@/lib/postgresErrors";

export default function VenueSignUp() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    businessName: string;
    companiesHouseNumber: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    postcode: string;
    countryCode: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    venueType: string;
    capacity: string;
    password: string;
    confirmPassword: string;
    latitude: number | null;
    longitude: number | null;
  }>({
    businessName: "",
    companiesHouseNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    countryCode: DEFAULT_COUNTRY_CODE,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    venueType: "",
    capacity: "",
    password: "",
    confirmPassword: "",
    latitude: null,
    longitude: null,
  });
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Manually editing an address field invalidates the saved map pin
      if (name === "addressLine1" || name === "city" || name === "postcode") {
        next.latitude = null;
        next.longitude = null;
      }
      return next;
    });
  };

  const onPickVenueAddress = useCallback((s: AddressSuggestion) => {
    const prev = formDataRef.current;
    setFormData({
      ...prev,
      addressLine1: s.address_line1 || prev.addressLine1,
      city: s.city || prev.city,
      postcode: s.postcode || prev.postcode,
      // Auto-update the country selector from the picked feature so the
      // dropdown stays in sync with what the venue actually chose. Falls
      // back to whatever the user had selected.
      countryCode: s.country_code
        ? s.country_code.toUpperCase()
        : prev.countryCode,
      latitude: s.center[1],
      longitude: s.center[0],
    });
  }, []);

  /** Best-effort forward-geocode the manual fields; returns null on failure. */
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.contactEmail,
        password: formData.password,
        options: {
          data: {
            role: "venue",
            display_name: formData.contactName,
          },
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        throw authError;
      }
      if (!authData.user) throw new Error("Failed to create account");

      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        role: "venue",
        email: formData.contactEmail,
        display_name: formData.contactName,
        phone: formData.contactPhone || null,
        is_verified: false,
        is_active: true,
      });

      if (profileError) {
        console.error("Profile creation error:", JSON.stringify(profileError, null, 2));
      }

      let lat = formData.latitude;
      let lng = formData.longitude;
      if (lat == null || lng == null) {
        const q = [formData.addressLine1, formData.city, formData.postcode]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
        const geo = await geocodeManualAddress(q, formData.countryCode);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        }
      }

      const baseVenuePayload: Record<string, unknown> = {
        user_id: authData.user.id,
        name: formData.businessName,
        type: formData.venueType || null,
        address_line1: formData.addressLine1,
        address_line2: formData.addressLine2 || null,
        city: formData.city || null,
        postcode: formData.postcode || null,
        phone: formData.contactPhone || null,
        email: formData.contactEmail,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        is_active: true,
        ...(lat != null && lng != null ? { latitude: lat, longitude: lng } : {}),
      };
      const venuePayload: Record<string, unknown> = {
        ...baseVenuePayload,
        country_code: (formData.countryCode || DEFAULT_COUNTRY_CODE).toUpperCase(),
      };
      let { error: venueError } = await supabase
        .from("venues")
        .insert(venuePayload);
      if (venueError && isMissingColumnError(venueError)) {
        console.warn(
          "[Signup] venues missing country_code column — retrying without it. Apply migration 0053_venue_country_code.sql.",
        );
        ({ error: venueError } = await supabase
          .from("venues")
          .insert(baseVenuePayload));
      }

      if (venueError) {
        console.error("Venue creation error:", JSON.stringify(venueError, null, 2));
      }

      // If email confirmation is required, Supabase won't return a session
      const hasSession = !!authData.session;
      if (hasSession) {
        router.push("/d/venue");
      } else {
        router.push(`/signup/confirm?email=${encodeURIComponent(formData.contactEmail)}`);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={350} color="teal" className="absolute -left-20 top-20" delay={0} />
        <FloatingOrb size={250} color="cyan" className="absolute right-10 bottom-20" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <FadeIn direction="up" delay={0.1}>
        <div className="w-full max-w-2xl">
          <Link href="/signup" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to role selection
          </Link>

          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl">
                🏢
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">Register Your Venue</h1>
                <p className="text-zinc-400 text-sm">Add your business and start booking verified security</p>
              </div>
            </div>

            {error && (
              <motion.div
                className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Details */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">1</span>
                  Business Details
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Business Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      required
                      placeholder="As registered on Companies House"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Companies House Number
                    </label>
                    <input
                      type="text"
                      name="companiesHouseNumber"
                      value={formData.companiesHouseNumber}
                      onChange={handleChange}
                      placeholder="e.g. 12345678"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Venue Type <span className="text-red-400">*</span>
                    </label>
                    <select
                      name="venueType"
                      value={formData.venueType}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    >
                      <option value="">Select type...</option>
                      {venueTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Venue Address */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">2</span>
                  Venue Address
                </h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Country <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="countryCode"
                    value={formData.countryCode}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-500">
                    Picking a country first narrows the address search and unlocks accurate map pins.
                  </p>
                </div>

                <div className="md:col-span-2 mb-4">
                  <AddressAutocomplete
                    label="Search address or postcode (fastest)"
                    help="Pick from the list and we'll fill the rest in and save a map pin for guard check-ins."
                    onSelect={onPickVenueAddress}
                    placeholder="Address, postcode, city or place name"
                    country={formData.countryCode.toLowerCase()}
                  />
                </div>

                <div className="flex items-center gap-2 mb-4 text-[11px] uppercase tracking-wider text-zinc-500">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or enter manually</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Address Line 1 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="addressLine1"
                      value={formData.addressLine1}
                      onChange={handleChange}
                      required
                      placeholder="Street address"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      name="addressLine2"
                      value={formData.addressLine2}
                      onChange={handleChange}
                      placeholder="Building, floor, etc."
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      City / Town <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Birmingham, Luxembourg-Ville"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Postcode / ZIP{" "}
                      <span className="text-zinc-500 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      placeholder="e.g. B1 1AA, L-1234"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Venue Capacity
                    </label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleChange}
                      placeholder="Maximum capacity"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                </div>

                {formData.latitude != null && formData.longitude != null ? (
                  <p className="mt-3 text-xs text-emerald-400">
                    ✓ Map pin captured — guards will be able to find you for check-in.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">
                    Tip: pick from the search above for the most accurate map pin. If you type everything by hand we'll try to geocode it when you submit.
                  </p>
                )}
              </div>

              {/* Contact Details */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">3</span>
                  Contact Details
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleChange}
                      required
                      placeholder="Full name"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      value={formData.contactPhone}
                      onChange={handleChange}
                      placeholder="e.g. 07123 456789"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      value={formData.contactEmail}
                      onChange={handleChange}
                      required
                      placeholder="you@business.com"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">4</span>
                  Create Password
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Repeat password"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gradient-to-r from-shield-500 to-shield-600 px-4 py-3.5 font-semibold text-white transition hover:from-shield-600 hover:to-shield-700 focus:outline-none focus:ring-2 focus:ring-shield-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isLoading ? "Creating account..." : "Create Venue Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-shield-500 hover:text-shield-400 transition">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
