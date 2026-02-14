"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface BidWithRequest {
  id: string;
  request_id: string;
  agency_id: string;
  proposed_rate: number;
  cover_letter: string | null;
  status: string;
  created_at: string;
  security_requests: {
    id: string;
    title: string;
    event_date: string;
    status: string;
    venues: { name: string; city: string | null } | null;
  } | null;
}

export default function AgencyBidsPage() {
  const [bids, setBids] = useState<BidWithRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBids();
  }, []);

  const loadBids = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agency) {
      setLoading(false);
      return;
    }

    const { data: list } = await supabase
      .from("request_bids")
      .select(`
        id, request_id, proposed_rate, cover_letter, status, created_at,
        security_requests:request_id(
          id, title, event_date, status,
          venues:venue_id(name, city)
        )
      `)
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    setBids(list || []);
    setLoading(false);
  };

  const pending = bids.filter((b) => b.status === "pending");
  const accepted = bids.filter((b) => b.status === "accepted");
  const declined = bids.filter((b) => b.status === "declined" || b.status === "withdrawn"));

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">My bids</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track your bids on venue security requests
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : bids.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-zinc-400">No bids yet. Browse requests to submit a bid.</p>
          <Link
            href="/d/agency/requests"
            className="mt-4 inline-block rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-400"
          >
            Browse requests
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-white">Pending ({pending.length})</h2>
              <div className="space-y-2">
                {pending.map((bid) => (
                  <div
                    key={bid.id}
                    className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {bid.security_requests?.title ?? "Request"}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {bid.security_requests?.venues?.name ?? "Venue"} · {bid.security_requests?.event_date}
                      </p>
                      <p className="text-sm text-zinc-500">
                        Your quote: £{(bid.proposed_rate / 100).toFixed(2)}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-400">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {accepted.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-white">Accepted ({accepted.length})</h2>
              <div className="space-y-2">
                {accepted.map((bid) => (
                  <div
                    key={bid.id}
                    className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {bid.security_requests?.title ?? "Request"}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {bid.security_requests?.venues?.name ?? "Venue"} · {bid.security_requests?.event_date}
                      </p>
                      <p className="text-sm text-zinc-500">
                        £{(bid.proposed_rate / 100).toFixed(2)} · You won this bid
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-400">
                      Accepted
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {declined.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-white">Declined / Withdrawn</h2>
              <div className="space-y-2">
                {declined.map((bid) => (
                  <div
                    key={bid.id}
                    className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 opacity-75"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {bid.security_requests?.title ?? "Request"}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {bid.security_requests?.venues?.name ?? "Venue"} · £{(bid.proposed_rate / 100).toFixed(2)}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-500/20 px-3 py-1 text-sm text-zinc-400">
                      {bid.status}
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
