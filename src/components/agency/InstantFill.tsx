"use client";

import { useState } from "react";

interface AvailableStaff {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  distance: string;
  hourlyRate: number;
  specialties: string[];
  siaVerified: boolean;
  responseTime: string;
}

interface InstantFillProps {
  shiftDate?: string;
  shiftTime?: string;
  location?: string;
  availableStaff?: AvailableStaff[];
  onBookStaff?: (staffId: string) => void;
}

export function InstantFill({ 
  shiftDate, 
  shiftTime, 
  location,
  availableStaff = [],
  onBookStaff 
}: InstantFillProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AvailableStaff[]>(availableStaff);
  const [formData, setFormData] = useState({
    date: shiftDate || "",
    startTime: shiftTime || "",
    endTime: "",
    location: location || "",
    guardsNeeded: 1,
    requirements: [] as string[],
  });

  // Demo search results
  const demoResults: AvailableStaff[] = [
    {
      id: "1",
      name: "Marcus J.",
      rating: 4.9,
      reviewCount: 47,
      distance: "2.3 miles",
      hourlyRate: 1500,
      specialties: ["Door Supervision", "Events"],
      siaVerified: true,
      responseTime: "Usually responds in 5 min",
    },
    {
      id: "2",
      name: "Sarah K.",
      rating: 4.8,
      reviewCount: 32,
      distance: "3.1 miles",
      hourlyRate: 1400,
      specialties: ["Door Supervision", "CCTV"],
      siaVerified: true,
      responseTime: "Usually responds in 10 min",
    },
    {
      id: "3",
      name: "James M.",
      rating: 4.7,
      reviewCount: 28,
      distance: "4.5 miles",
      hourlyRate: 1350,
      specialties: ["Door Supervision", "Close Protection"],
      siaVerified: true,
      responseTime: "Usually responds in 15 min",
    },
  ];

  const handleSearch = () => {
    setIsSearching(true);
    // Simulate search
    setTimeout(() => {
      setSearchResults(demoResults);
      setIsSearching(false);
    }, 1500);
  };

  const handleBook = (staffId: string) => {
    if (onBookStaff) {
      onBookStaff(staffId);
    } else {
      alert(`Booking request sent to staff ${staffId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
          <span className="text-xl">⚡</span>
        </div>
        <div>
          <h2 className="font-display text-lg font-medium text-white">Instant Fill</h2>
          <p className="text-sm text-zinc-400">Find backup staff from the Shield network in minutes</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="glass rounded-xl p-6">
        <h3 className="mb-4 font-medium text-white">What do you need?</h3>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500"
            />
          </div>
          
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Start Time</label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500"
            />
          </div>
          
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">End Time</label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500"
            />
          </div>
          
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Staff Needed</label>
            <select
              value={formData.guardsNeeded}
              onChange={(e) => setFormData({ ...formData, guardsNeeded: parseInt(e.target.value) })}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Enter postcode or address"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Requirements (optional)</label>
          <div className="flex flex-wrap gap-2">
            {["Door Supervision", "Events", "CCTV", "Close Protection", "First Aid"].map((req) => (
              <button
                key={req}
                onClick={() => {
                  const reqs = formData.requirements.includes(req)
                    ? formData.requirements.filter((r) => r !== req)
                    : [...formData.requirements, req];
                  setFormData({ ...formData, requirements: reqs });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  formData.requirements.includes(req)
                    ? "bg-shield-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {req}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={isSearching || !formData.date || !formData.startTime}
          className="mt-6 w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-red-600 disabled:opacity-50"
        >
          {isSearching ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching available staff...
            </span>
          ) : (
            "⚡ Find Available Staff Now"
          )}
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">
              {searchResults.length} staff available
            </h3>
            <span className="text-sm text-zinc-400">Sorted by distance</span>
          </div>

          <div className="space-y-3">
            {searchResults.map((staff) => (
              <div key={staff.id} className="glass rounded-xl p-4 transition hover:bg-white/[0.02]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-shield-500/20 text-lg font-semibold text-shield-300">
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{staff.name}</span>
                        {staff.siaVerified && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            ✓ SIA Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-zinc-400">
                        <span className="flex items-center gap-1">
                          <span className="text-yellow-400">⭐</span>
                          {staff.rating} ({staff.reviewCount})
                        </span>
                        <span>📍 {staff.distance}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {staff.specialties.map((spec) => (
                          <span key={spec} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            {spec}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500">{staff.responseTime}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">
                      £{(staff.hourlyRate / 100).toFixed(2)}<span className="text-sm text-zinc-400">/hr</span>
                    </div>
                    <button
                      onClick={() => handleBook(staff.id)}
                      className="mt-2 rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-shield-600"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchResults.length === 0 && !isSearching && formData.date && (
        <div className="glass rounded-xl p-8 text-center">
          <span className="text-3xl">🔍</span>
          <p className="mt-2 text-sm text-zinc-400">No search results yet. Fill in the form above to find available staff.</p>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-xl border border-shield-500/20 bg-shield-500/5 p-4">
        <div className="flex gap-3">
          <span className="text-xl">💡</span>
          <div>
            <h4 className="font-medium text-shield-300">How Instant Fill Works</h4>
            <p className="mt-1 text-sm text-zinc-400">
              When your staff calls in sick or you need extra cover, search our network of verified security professionals. 
              They'll work under your agency's name, and you set the rate. We just connect you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
