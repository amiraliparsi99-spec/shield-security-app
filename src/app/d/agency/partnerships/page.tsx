"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PartnershipWithVenue {
  id: string;
  venue_id: string;
  agency_id: string;
  status: string;
  initiated_by: string;
  custom_commission_rate: number | null;
  notes: string | null;
  created_at: string;
  responded_at: string | null;
  venues: { id: string; name: string; city: string | null; address_line1: string | null } | null;
}

export default function AgencyPartnershipsPage() {
  const [partnerships, setPartnerships] = useState<PartnershipWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");

  useEffect(() => {
    loadPartnerships();
  }, []);

  const loadPartnerships = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partnerships/list?as=agency");
      const data = await res.json();
      if (res.ok) setPartnerships(data.partnerships || []);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (partnershipId: string, accept: boolean) => {
    setResponding(partnershipId);
    try {
      const res = await fetch("/api/partnerships/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnership_id: partnershipId, accept }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to respond");
        return;
      }
      await loadPartnerships();
    } finally {
      setResponding(null);
    }
  };

  const filtered = partnerships.filter((p) => {
    if (filter === "active") return p.status === "active";
    if (filter === "pending") return p.status === "pending";
    return true;
  });

  const activeCount = partnerships.filter((p) => p.status === "active").length;
  const pendingCount = partnerships.filter((p) => p.status === "pending").length;

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Partnerships</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Venue partnerships and pending requests
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filter === "all" ? "bg-shield-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filter === "active" ? "bg-shield-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filter === "pending" ? "bg-shield-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          Pending ({pendingCount})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-zinc-400">
            {filter === "all"
              ? "No partnerships yet. Venues can send you requests from their agency discovery page."
              : `No ${filter} partnerships.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-shield-500/20 text-shield-400 font-semibold">
                  {(p.venues?.name || "V").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-white">{p.venues?.name ?? "Venue"}</h3>
                  <p className="text-sm text-zinc-500">{p.venues?.city ?? ""} {p.venues?.address_line1 ?? ""}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {p.initiated_by === "agency" ? "You sent request" : "Venue sent request"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    p.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : p.status === "pending"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-zinc-500/20 text-zinc-400"
                  }`}
                >
                  {p.status}
                </span>
                {p.status === "pending" && p.initiated_by === "venue" && (
                  <>
                    <button
                      onClick={() => handleRespond(p.id, true)}
                      disabled={!!responding}
                      className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-400 disabled:opacity-50"
                    >
                      {responding === p.id ? "…" : "Accept"}
                    </button>
                    <button
                      onClick={() => handleRespond(p.id, false)}
                      disabled={!!responding}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </>
                )}
                {p.status === "active" && (
                  <Link
                    href="/d/agency/messages"
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
                  >
                    Message
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
