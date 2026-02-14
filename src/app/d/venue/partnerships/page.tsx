"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface PartnershipWithAgency {
  id: string;
  venue_id: string;
  agency_id: string;
  status: string;
  initiated_by: string;
  custom_commission_rate: number | null;
  notes: string | null;
  created_at: string;
  responded_at: string | null;
  agencies: { id: string; name: string; city: string | null; average_rating: number | null } | null;
}

export default function VenuePartnershipsPage() {
  const [partnerships, setPartnerships] = useState<PartnershipWithAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");

  useEffect(() => {
    loadPartnerships();
  }, []);

  const loadPartnerships = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partnerships/list?as=venue");
      const data = await res.json();
      if (res.ok) {
        setPartnerships(data.partnerships || []);
      }
    } finally {
      setLoading(false);
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
          Manage your agency partnerships and pending requests
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filter === "all"
              ? "bg-shield-500 text-white"
              : "bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filter === "active"
              ? "bg-shield-500 text-white"
              : "bg-white/5 text-zinc-400 hover:bg-white/10"
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            filter === "pending"
              ? "bg-shield-500 text-white"
              : "bg-white/5 text-zinc-400 hover:bg-white/10"
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
              ? "You have no partnerships yet. Browse agencies to send a request."
              : `No ${filter} partnerships.`}
          </p>
          <Link
            href="/d/venue/agencies"
            className="mt-4 inline-block rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-400"
          >
            Browse agencies
          </Link>
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
                  {(p.agencies?.name || "A").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-white">{p.agencies?.name ?? "Agency"}</h3>
                  <p className="text-sm text-zinc-500">{p.agencies?.city ?? ""}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {p.initiated_by === "venue" ? "You sent request" : "Agency sent request"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.custom_commission_rate != null && (
                      <> · Custom rate: {p.custom_commission_rate}%</>
                    )}
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
                {p.status === "active" && (
                  <Link
                    href={`/d/venue/bookings/new?agency=${p.agency_id}`}
                    className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white hover:bg-shield-400"
                  >
                    Book
                  </Link>
                )}
                <Link
                  href="/d/venue/messages"
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
                >
                  Message
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
