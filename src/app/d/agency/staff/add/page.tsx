"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Personnel, AgencyStaffRole } from "@/types/database";

export default function AddStaffPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Personnel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [role, setRole] = useState<AgencyStaffRole>("contractor");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchPersonnel();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchPersonnel = async () => {
    setIsSearching(true);
    try {
      const supabase = createClient();
      
      // First, get all available personnel
      const { data: personnelData } = await supabase
        .from("personnel")
        .select("*")
        .eq("is_available", true)
        .eq("is_active", true)
        .limit(50);

      if (!personnelData || personnelData.length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Get user IDs
      const userIds = personnelData.map((p) => p.user_id);

      // Get profiles for these users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds);

      // Create a map of user_id to profile
      const profilesMap = new Map(
        profilesData?.map((p) => [p.id, p]) || []
      );

      // Merge personnel with profiles and filter by search query
      const results = personnelData
        .map((person) => {
          const profile = profilesMap.get(person.user_id);
          return {
            ...person,
            display_name: profile?.display_name || person.display_name || "Unknown",
            email: profile?.email,
          };
        })
        .filter((person) => {
          const query = searchQuery.toLowerCase();
          return (
            person.display_name.toLowerCase().includes(query) ||
            person.email?.toLowerCase().includes(query) ||
            person.city?.toLowerCase().includes(query)
          );
        })
        .slice(0, 10);

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonnel) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Send invitation via API
      const response = await fetch("/api/agency/invite-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnel_id: selectedPersonnel.id,
          role,
          hourly_rate: hourlyRate || null,
          message: notes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invitation");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/d/agency/staff");
      }, 1500);
    } catch (error: any) {
      setError(error.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-6">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-white">Invitation Sent</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {selectedPersonnel?.display_name} has been invited to join your team.
            They&apos;ll appear as pending until they accept.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/d/agency/staff"
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Staff
        </Link>
        <h1 className="font-display text-2xl font-semibold text-white">Add Staff Member</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Search for verified security personnel and invite them to your team
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Search Section */}
        {!selectedPersonnel ? (
          <div className="glass rounded-2xl p-6">
            <label className="mb-2 block text-sm font-medium text-white">
              Search Personnel
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or certification..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50 focus:ring-1 focus:ring-shield-500/50"
                autoFocus
              />
            </div>

            {/* Search Results */}
            {isSearching ? (
              <div className="mt-4 flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="mt-4 space-y-2">
                {searchResults.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => setSelectedPersonnel(person)}
                    className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition hover:bg-white/5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-sm font-semibold text-white">
                      {person.display_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{person.display_name}</p>
                      <p className="mt-0.5 text-sm text-zinc-400">
                        {person.city || person.region || "Location not set"}
                        {person.rate_per_hour && (
                          <span className="ml-2 text-shield-400">
                            £{(person.rate_per_hour / 100).toFixed(2)}/hr
                          </span>
                        )}
                      </p>
                      {person.certs && person.certs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {person.certs.slice(0, 4).map((cert) => (
                            <span
                              key={cert}
                              className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                            >
                              {cert}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="mt-4 py-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-zinc-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-sm text-zinc-400">No personnel found</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Try a different search term
                </p>
              </div>
            ) : (
              <p className="mt-4 text-center text-sm text-zinc-500">
                Enter at least 2 characters to search
              </p>
            )}
          </div>
        ) : (
          /* Selected Personnel Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selected Person Card */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-lg font-semibold text-white">
                  {selectedPersonnel.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-medium text-white">
                    {selectedPersonnel.display_name}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {selectedPersonnel.city || selectedPersonnel.region || "Location not set"}
                  </p>
                  {selectedPersonnel.certs && selectedPersonnel.certs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedPersonnel.certs.map((cert) => (
                        <span
                          key={cert}
                          className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPersonnel(null)}
                  className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Role Selection */}
            <div className="glass rounded-2xl p-6">
              <label className="mb-4 block text-sm font-medium text-white">
                Employment Type
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  { value: "contractor", label: "Contractor", desc: "Freelance / Ad-hoc" },
                  { value: "employee", label: "Employee", desc: "Full-time staff" },
                  { value: "manager", label: "Manager", desc: "Team supervisor" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`rounded-xl p-4 text-left transition ${
                      role === option.value
                        ? "bg-shield-500/20 ring-1 ring-shield-500/50"
                        : "bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <p className="font-medium text-white">{option.label}</p>
                    <p className="mt-1 text-xs text-zinc-400">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Hourly Rate */}
            <div className="glass rounded-2xl p-6">
              <label htmlFor="rate" className="mb-2 block text-sm font-medium text-white">
                Hourly Rate (Optional)
              </label>
              <p className="mb-4 text-xs text-zinc-400">
                Override the default rate for this staff member
              </p>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">£</span>
                <input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder={selectedPersonnel.rate_per_hour 
                    ? (selectedPersonnel.rate_per_hour / 100).toFixed(2) 
                    : "0.00"}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-8 pr-12 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">/hr</span>
              </div>
            </div>

            {/* Personal Message */}
            <div className="glass rounded-2xl p-6">
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-white">
                Personal Message (Optional)
              </label>
              <p className="mb-3 text-xs text-zinc-400">
                This message will be included in the invitation sent to {selectedPersonnel.display_name}
              </p>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. We'd love to have you join our team. We have regular shifts available in Central London..."
                rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedPersonnel(null)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-shield-500 px-4 py-3 text-sm font-medium text-white shadow-glow-sm transition hover:bg-shield-400 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending Invitation...
                  </span>
                ) : (
                  "Send Invitation"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
