"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Agency {
  id: string;
  name: string;
  city: string | null;
  average_rating: number | null;
  total_staff: number;
  description: string | null;
}

interface Partnership {
  id: string;
  agency_id: string;
  status: string;
  initiated_by: string;
}

export default function VenueAgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (venue) {
      setVenueId(venue.id);
      const { data: list } = await supabase
        .from("venue_agency_partnerships")
        .select("id, agency_id, status, initiated_by")
        .eq("venue_id", venue.id);
      setPartnerships(list || []);
    }

    const { data: agencyList } = await supabase
      .from("agencies")
      .select("id, name, city, average_rating, total_staff, description")
      .eq("is_active", true)
      .order("average_rating", { ascending: false });

    setAgencies(agencyList || []);
    setLoading(false);
  };

  const handlePartnershipRequest = async (agencyId: string) => {
    if (!venueId) return;
    setSendingRequest(agencyId);
    try {
      const res = await fetch("/api/partnerships/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          agency_id: agencyId,
          initiated_by: "venue",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to send request");
        return;
      }
      await loadData();
    } finally {
      setSendingRequest(null);
    }
  };

  const getPartnershipStatus = (agencyId: string) => {
    const p = partnerships.find((x) => x.agency_id === agencyId);
    return p ? p.status : null;
  };

  const filtered = agencies.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.name?.toLowerCase().includes(q) && !a.city?.toLowerCase().includes(q) && !a.description?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (cityFilter && a.city?.toLowerCase() !== cityFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const cities = Array.from(new Set(agencies.map((a) => a.city).filter(Boolean))) as string[];

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Agencies</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Find security agencies and send partnership requests or book directly
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by name or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 outline-none focus:border-shield-500/50"
        />
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
        >
          <option value="">All cities</option>
          {cities.sort().map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-zinc-400">No agencies match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agency) => {
            const status = getPartnershipStatus(agency.id);
            const isPending = status === "pending";
            const isActive = status === "active";

            return (
              <div
                key={agency.id}
                className="glass flex flex-col rounded-2xl p-6 transition hover:shadow-glow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-shield-500/20 text-shield-400 font-semibold">
                    {(agency.name || "A").charAt(0).toUpperCase()}
                  </div>
                  {status && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isPending
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {status}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-medium text-white">{agency.name}</h3>
                {agency.city && (
                  <p className="mt-1 text-sm text-zinc-500">{agency.city}</p>
                )}
                <div className="mt-2 flex items-center gap-3 text-sm text-zinc-400">
                  <span>Staff: {agency.total_staff ?? 0}</span>
                  {agency.average_rating != null && (
                    <span>Rating: {Number(agency.average_rating).toFixed(1)}</span>
                  )}
                </div>
                {agency.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{agency.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {!status && (
                    <button
                      onClick={() => handlePartnershipRequest(agency.id)}
                      disabled={!!sendingRequest}
                      className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-shield-400 disabled:opacity-50"
                    >
                      {sendingRequest === agency.id ? "Sending…" : "Partnership request"}
                    </button>
                  )}
                  {isActive && (
                    <Link
                      href={`/d/venue/bookings/new?agency=${agency.id}`}
                      className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-shield-400"
                    >
                      Book directly
                    </Link>
                  )}
                  <Link
                    href={`/d/venue/messages`}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
                  >
                    Message
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
