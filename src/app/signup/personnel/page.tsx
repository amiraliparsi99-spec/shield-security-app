"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FadeIn, FloatingOrb, motion } from "@/components/ui/motion";

export default function PersonnelSignUp() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    postcode: "",
    siaLicenseNumber: "",
    siaExpiryDate: "",
    certifications: [] as string[],
    experienceYears: "",
    hourlyRate: "",
    bio: "",
    password: "",
    confirmPassword: "",
  });

  const certificationOptions = [
    { value: "door_supervisor", label: "SIA Door Supervisor" },
    { value: "security_guard", label: "SIA Security Guard" },
    { value: "close_protection", label: "SIA Close Protection" },
    { value: "cctv", label: "SIA CCTV" },
    { value: "first_aid", label: "First Aid at Work" },
    { value: "conflict_management", label: "Conflict Management" },
    { value: "fire_safety", label: "Fire Safety" },
    { value: "crowd_management", label: "Crowd Management" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCertToggle = (cert: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert],
    }));
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
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: "personnel",
            display_name: formData.fullName,
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
        role: "personnel",
        email: formData.email,
        display_name: formData.fullName,
        phone: formData.phone || null,
        is_verified: false,
        is_active: true,
      });

      if (profileError) {
        console.error("Profile creation error:", JSON.stringify(profileError, null, 2));
        // If profile fails, still try to continue - user is authenticated
      }

      // Map certifications to skills array
      const skillsMap: Record<string, string> = {
        door_supervisor: "Door Security",
        security_guard: "Security Guard",
        close_protection: "Close Protection",
        cctv: "CCTV Operator",
        first_aid: "First Aid",
        conflict_management: "Conflict Management",
        fire_safety: "Fire Safety",
        crowd_management: "Crowd Management",
      };
      const skills = formData.certifications.map(c => skillsMap[c] || c);

      // Create personnel record
      const { error: personnelError } = await supabase.from("personnel").insert({
        user_id: authData.user.id,
        display_name: formData.fullName,
        bio: formData.bio || null,
        city: formData.city || "Birmingham",
        postcode: formData.postcode || null,
        hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : 16.00,
        experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : 0,
        skills: skills,
        sia_license_number: formData.siaLicenseNumber || null,
        sia_expiry_date: formData.siaExpiryDate || null,
        sia_verified: false,
        dbs_verified: false,
        right_to_work_verified: false,
        max_travel_distance: 10,
        night_shifts_ok: true,
        weekend_only: false,
        is_active: true,
        is_available: true,
      });

      if (personnelError) {
        console.error("Personnel creation error:", JSON.stringify(personnelError, null, 2));
      }

      // Redirect directly to dashboard (email confirmation is disabled)
      router.push("/d/personnel");
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-2xl">
                🛡️
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-white">Join as Security Professional</h1>
                <p className="text-zinc-400 text-sm">Get booked for shifts and grow your career</p>
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
              {/* Personal Details */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">1</span>
                  Personal Details
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="Your full name"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="you@email.com"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g. 07123 456789"
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
                      Postcode
                    </label>
                    <input
                      type="text"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      placeholder="e.g. B1 1AA"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* SIA License */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">2</span>
                  SIA License
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      SIA License Number
                    </label>
                    <input
                      type="text"
                      name="siaLicenseNumber"
                      value={formData.siaLicenseNumber}
                      onChange={handleChange}
                      placeholder="e.g. 1234-5678-9012-3456"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      License Expiry Date
                    </label>
                    <input
                      type="date"
                      name="siaExpiryDate"
                      value={formData.siaExpiryDate}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  You can add this later, but venues will verify your SIA license before booking.
                </p>
              </div>

              {/* Certifications */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">3</span>
                  Certifications &amp; Skills
                </h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {certificationOptions.map(cert => (
                    <label
                      key={cert.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        formData.certifications.includes(cert.value)
                          ? "border-shield-500 bg-shield-500/10"
                          : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.certifications.includes(cert.value)}
                        onChange={() => handleCertToggle(cert.value)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        formData.certifications.includes(cert.value)
                          ? "border-shield-500 bg-shield-500"
                          : "border-zinc-600"
                      }`}>
                        {formData.certifications.includes(cert.value) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-zinc-300">{cert.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Experience & Rate */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">4</span>
                  Experience &amp; Rate
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Years of Experience
                    </label>
                    <select
                      name="experienceYears"
                      value={formData.experienceYears}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    >
                      <option value="">Select...</option>
                      <option value="0">Less than 1 year</option>
                      <option value="1">1-2 years</option>
                      <option value="3">3-5 years</option>
                      <option value="6">6-10 years</option>
                      <option value="10">10+ years</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Hourly Rate (£)
                    </label>
                    <input
                      type="number"
                      name="hourlyRate"
                      value={formData.hourlyRate}
                      onChange={handleChange}
                      placeholder="e.g. 15"
                      min="10"
                      max="100"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  About You
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Tell venues about your experience, specialties, and what makes you a great fit..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition resize-none"
                />
              </div>

              {/* Password */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-shield-500/20 text-shield-500 text-xs flex items-center justify-center">5</span>
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
                {isLoading ? "Creating account..." : "Create Security Account"}
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
