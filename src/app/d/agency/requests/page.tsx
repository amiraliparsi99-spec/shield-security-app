"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SecurityRequest {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  staff_requirements: unknown;
  budget_min: number | null;
  budget_max: number | null;
  partners_only: boolean;
  expires_at: string | null;
  created_at: string;
  venues: { id: string; name: string; city: string | null; address_line1: string | null } | null;
}

export default function AgencyRequestsPage() {
  const [requests, setRequests] = useState<SecurityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnersOnly, setPartnersOnly] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [bidding, setBidding] = useState<string | null>(null);
  const [bidModal, setBidModal] = useState<SecurityRequest | null>(null);
  const [bidForm, setBidForm] = useState({ proposed_rate: "", cover_letter: "" });

  useEffect(() => {
    loadRequests();
  }, [partnersOnly, fromDate, toDate]);

  const loadRequests = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (partnersOnly) params.set("partners_only", "true");
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    const res = await fetch(`/api/requests/browse?${params}`);
    const data = await res.json();
    if (res.ok) setRequests(data.requests || []);
    setLoading(false);
  };

  const openBidModal = (req: SecurityRequest) => {
    setBidModal(req);
    setBidForm({ proposed_rate: "", cover_letter: "" });
  };

  const submitBid = async () => {
    if (!bidModal || !bidForm.proposed_rate) return;
    const ratePence = Math.round(parseFloat(bidForm.proposed_rate) * 100);
    if (isNaN(ratePence) || ratePence <= 0) {
      alert("Enter a valid amount in pounds");
      return;
    }
    setBidding(bidModal.id);
    try {
      const res = await fetch("/api/requests/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: bidModal.id,
          proposed_rate: ratePence,
          cover_letter: bidForm.cover_letter || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to submit bid");
        return;
      }
      setBidModal(null);
      loadRequests();
    } finally {
      setBidding(null);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Browse requests</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Find security requests from venues and submit your bid
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={partnersOnly}
            onChange={(e) => setPartnersOnly(e.target.checked)}
            className="rounded border-white/10 bg-white/5"
          />
          <span className="text-sm text-zinc-300">Partners only</span>
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="From date"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-shield-500/50"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="To date"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-shield-500/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-shield-500 border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-zinc-400">No open requests match your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
            >
              <div>
                <h3 className="font-medium text-white">{req.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {req.venues?.name ?? "Venue"} · {req.venues?.city ?? ""}
                </p>
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
                {req.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{req.description}</p>
                )}
              </div>
              <button
                onClick={() => openBidModal(req)}
                className="rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-shield-400"
              >
                Submit bid
              </button>
            </div>
          ))}
        </div>
      )}

      {bidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg font-semibold text-white">Submit bid</h3>
            <p className="mt-1 text-sm text-zinc-500">{bidModal.title}</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-300">Your quote (£)</label>
              <input
                type="number"
                step={0.01}
                min={0}
                value={bidForm.proposed_rate}
                onChange={(e) => setBidForm({ ...bidForm, proposed_rate: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
                placeholder="e.g. 250.00"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-300">Cover letter (optional)</label>
              <textarea
                value={bidForm.cover_letter}
                onChange={(e) => setBidForm({ ...bidForm, cover_letter: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
                placeholder="Brief message to the venue"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={submitBid}
                disabled={bidding === bidModal.id}
                className="rounded-xl bg-shield-500 px-4 py-2.5 font-medium text-white hover:bg-shield-400 disabled:opacity-50"
              >
                {bidding === bidModal.id ? "Submitting…" : "Submit bid"}
              </button>
              <button
                onClick={() => setBidModal(null)}
                className="rounded-xl border border-white/10 px-4 py-2.5 font-medium text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
