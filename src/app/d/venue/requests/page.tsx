"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface SecurityRequest {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  partners_only: boolean;
  created_at: string;
  budget_min: number | null;
  budget_max: number | null;
}

interface Bid {
  id: string;
  request_id: string;
  agency_id: string;
  proposed_rate: number;
  cover_letter: string | null;
  status: string;
  created_at: string;
  agencies: { id: string; name: string; city: string | null } | null;
}

export default function VenueRequestsPage() {
  const [requests, setRequests] = useState<SecurityRequest[]>([]);
  const [bidsByRequest, setBidsByRequest] = useState<Record<string, Bid[]>>({});
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState<string | null>(null);

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

    if (!venue) {
      setLoading(false);
      return;
    }

    setVenueId(venue.id);

    const { data: list } = await supabase
      .from("security_requests")
      .select("id, title, description, event_date, start_time, end_time, status, partners_only, created_at, budget_min, budget_max")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false });

    setRequests(list || []);

    const requestIds = (list || []).map((r) => r.id);
    if (requestIds.length > 0) {
      const { data: bids } = await supabase
        .from("request_bids")
        .select(`
          id, request_id, agency_id, proposed_rate, cover_letter, status, created_at,
          agencies:agency_id(id, name, city)
        `)
        .in("request_id", requestIds)
        .eq("status", "pending");

      const byRequest: Record<string, Bid[]> = {};
      (bids || []).forEach((b) => {
        if (!byRequest[b.request_id]) byRequest[b.request_id] = [];
        byRequest[b.request_id].push(b);
      });
      setBidsByRequest(byRequest);
    }

    setLoading(false);
  };

  const handleAward = async (requestId: string, bidId: string) => {
    setAwarding(bidId);
    try {
      const res = await fetch("/api/requests/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, bid_id: bidId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to award");
        return;
      }
      await loadData();
    } finally {
      setAwarding(null);
    }
  };

  const openRequests = requests.filter((r) => r.status === "open");
  const otherRequests = requests.filter((r) => r.status !== "open");

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Security requests</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Post requests for agencies to bid on, then award the winning bid
          </p>
        </div>
        <Link
          href="/d/venue/requests/new"
          className="rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-shield-400"
        >
          Post request
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-zinc-400">No requests yet. Post one to get bids from agencies.</p>
          <Link
            href="/d/venue/requests/new"
            className="mt-4 inline-block rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-400"
          >
            Post request
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {openRequests.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-white">Open requests</h2>
              <div className="space-y-4">
                {openRequests.map((req) => {
                  const bids = bidsByRequest[req.id] || [];
                  return (
                    <div
                      key={req.id}
                      className="glass rounded-2xl p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-white">{req.title}</h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            {req.event_date} · {String(req.start_time).slice(0, 5)} – {String(req.end_time).slice(0, 5)}
                            {req.partners_only && " · Partners only"}
                          </p>
                          {req.budget_min != null && (
                            <p className="text-sm text-zinc-500">
                              Budget: £{(req.budget_min / 100).toFixed(2)}
                              {req.budget_max != null && ` – £${(req.budget_max / 100).toFixed(2)}`}
                            </p>
                          )}
                        </div>
                      </div>
                      {bids.length > 0 ? (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <p className="mb-2 text-sm font-medium text-zinc-400">Bids ({bids.length})</p>
                          <div className="space-y-2">
                            {bids.map((bid) => (
                              <div
                                key={bid.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 p-3"
                              >
                                <div>
                                  <p className="font-medium text-white">{bid.agencies?.name ?? "Agency"}</p>
                                  <p className="text-sm text-zinc-500">
                                    £{(bid.proposed_rate / 100).toFixed(2)} total
                                    {bid.cover_letter && ` · ${bid.cover_letter.slice(0, 60)}…`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleAward(req.id, bid.id)}
                                  disabled={!!awarding}
                                  className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-400 disabled:opacity-50"
                                >
                                  {awarding === bid.id ? "Awarding…" : "Award"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-zinc-500">No bids yet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {otherRequests.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-white">Other requests</h2>
              <div className="space-y-2">
                {otherRequests.map((req) => (
                  <div
                    key={req.id}
                    className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4"
                  >
                    <div>
                      <h3 className="font-medium text-white">{req.title}</h3>
                      <p className="text-sm text-zinc-500">
                        {req.event_date} · {req.status}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm ${
                        req.status === "awarded"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
