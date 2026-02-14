"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FadeIn, FloatingOrb, motion } from "@/components/ui/motion";

export default function VenueSignUp() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    businessName: "",
    companiesHouseNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    venueType: "",
    capacity: "",
    password: "",
    confirmPassword: "",
  });

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
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
      
      // Create auth user
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

      // Create profile first (required for foreign key)
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

      // Create the venue record
      const { error: venueError } = await supabase.from("venues").insert({
        user_id: authData.user.id,
        name: formData.businessName,
        type: formData.venueType || null,
        address_line1: formData.addressLine1,
        address_line2: formData.addressLine2 || null,
        city: formData.city || "Birmingham",
        postcode: formData.postcode,
        phone: formData.contactPhone || null,
        email: formData.contactEmail,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        is_active: true,
      });

      if (venueError) {
        console.error("Venue creation error:", JSON.stringify(venueError, null, 2));
      }

      // Redirect directly to dashboard (email confirmation is disabled)
      router.push("/d/venue");
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

          <motion.div
            className="glass rounded-2xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-2xl">
                🏢
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">Register your Venue</h1>
                <p className="text-zinc-400 text-sm">Find security professionals for your events</p>
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

              {/* Address */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">2</span>
                  Venue Address
                </h2>
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
                      City <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Birmingham"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Postcode <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      required
                      placeholder="e.g. B1 1AA"
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

              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gradient-to-r from-shield-500 to-shield-600 px-4 py-3.5 font-semibold text-white transition hover:from-shield-600 hover:to-shield-700 focus:outline-none focus:ring-2 focus:ring-shield-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {isLoading ? "Creating account..." : "Create Venue Account"}
              </motion.button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-shield-500 hover:text-shield-400 transition">
                Log in
              </Link>
            </p>
          </motion.div>
        </div>
      </FadeIn>
    </div>
  );
}
