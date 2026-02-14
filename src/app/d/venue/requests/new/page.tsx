"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const defaultRequirements = [{ role: "Door Security", quantity: 1, min_rate: 18 }];

export default function NewRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    staff_requirements: defaultRequirements,
    budget_min: "",
    budget_max: "",
    partners_only: false,
    expires_days: "7",
  });

  const updateRequirement = (i: number, field: string, value: string | number) => {
    const next = [...form.staff_requirements];
    (next[i] as Record<string, string | number>)[field] = value;
    setForm({ ...form, staff_requirements: next });
  };

  const addRequirement = () => {
    setForm({
      ...form,
      staff_requirements: [...form.staff_requirements, { role: "Security", quantity: 1, min_rate: 18 }],
    });
  };

  const removeRequirement = (i: number) => {
    if (form.staff_requirements.length <= 1) return;
    setForm({
      ...form,
      staff_requirements: form.staff_requirements.filter((_, idx) => idx !== i),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.event_date || !form.start_time || !form.end_time) {
      alert("Please fill in title, date, start time and end time.");
      return;
    }
    setSubmitting(true);
    try {
      const expires_at = form.expires_days
        ? new Date(Date.now() + Number(form.expires_days) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const res = await fetch("/api/requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          event_date: form.event_date,
          start_time: form.start_time,
          end_time: form.end_time,
          staff_requirements: form.staff_requirements,
          budget_min: form.budget_min ? Number(form.budget_min) * 100 : null,
          budget_max: form.budget_max ? Number(form.budget_max) * 100 : null,
          partners_only: form.partners_only,
          expires_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create request");
        return;
      }
      router.push("/d/venue/requests");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 max-w-2xl">
      <Link
        href="/d/venue/requests"
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back to requests
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-white">Post security request</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Agencies can view and submit bids. You choose the winning bid.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
            placeholder="e.g. Friday night club security"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
            placeholder="Any extra details for agencies"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Event date *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300">Start *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">End *</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Staff requirements</label>
          {form.staff_requirements.map((req, i) => (
            <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={req.role}
                onChange={(e) => updateRequirement(i, "role", e.target.value)}
                placeholder="Role"
                className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
              />
              <input
                type="number"
                min={1}
                value={req.quantity}
                onChange={(e) => updateRequirement(i, "quantity", e.target.value)}
                className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
              />
              <input
                type="number"
                min={0}
                value={req.min_rate}
                onChange={(e) => updateRequirement(i, "min_rate", Number(e.target.value))}
                placeholder="Min £/hr"
                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
              />
              <button
                type="button"
                onClick={() => removeRequirement(i)}
                className="text-zinc-500 hover:text-white"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRequirement}
            className="mt-2 text-sm text-shield-400 hover:text-shield-300"
          >
            + Add role
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Budget min (£)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.budget_min}
              onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Budget max (£)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.budget_max}
              onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="partners_only"
            checked={form.partners_only}
            onChange={(e) => setForm({ ...form, partners_only: e.target.checked })}
            className="rounded border-white/10 bg-white/5"
          />
          <label htmlFor="partners_only" className="text-sm text-zinc-300">
            Only show to partner agencies
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Request expires in (days)</label>
          <input
            type="number"
            min={1}
            value={form.expires_days}
            onChange={(e) => setForm({ ...form, expires_days: e.target.value })}
            className="mt-1 w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-shield-500/50"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-shield-500 px-6 py-2.5 font-medium text-white hover:bg-shield-400 disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post request"}
          </button>
          <Link
            href="/d/venue/requests"
            className="rounded-xl border border-white/10 px-6 py-2.5 font-medium text-zinc-300 hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
