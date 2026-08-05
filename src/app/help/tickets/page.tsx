"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

const CATEGORIES = [
  { id: "general", label: "General question" },
  { id: "bookings", label: "Bookings & shifts" },
  { id: "payments", label: "Payments & fees" },
  { id: "account", label: "Account & settings" },
  { id: "verification", label: "Verification & documents" },
  { id: "technical", label: "Technical problem / bug" },
  { id: "other", label: "Something else" },
];

const STATUS_STYLES: Record<Ticket["status"], { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-500/15 text-amber-400" },
  in_progress: { label: "In progress", className: "bg-sky-500/15 text-sky-400" },
  resolved: { label: "Resolved", className: "bg-emerald-500/15 text-emerald-400" },
  closed: { label: "Closed", className: "bg-zinc-500/15 text-zinc-400" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_STYLES[ticket.status];
  const category = CATEGORIES.find((c) => c.id === ticket.category)?.label ?? ticket.category;

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="glass w-full rounded-2xl p-5 text-left transition hover:bg-white/[0.03]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">{ticket.subject}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {category} · {formatDate(ticket.created_at)}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {ticket.message}
          </p>
          {ticket.admin_reply ? (
            <div className="rounded-xl bg-shield-500/10 p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-shield-400">
                Shield HQ team{ticket.replied_at ? ` · ${formatDate(ticket.replied_at)}` : ""}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {ticket.admin_reply}
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              No reply yet — we&apos;ll get back to you as soon as possible.
            </p>
          )}
        </div>
      )}
    </button>
  );
}

export default function SupportTicketsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const loadTickets = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error: fetchError } = await supabase
      .from("support_tickets")
      .select("id, category, subject, message, status, admin_reply, replied_at, created_at")
      .order("created_at", { ascending: false });
    if (fetchError) {
      console.error("[support] fetch tickets:", fetchError.message);
    }
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (!authLoading) loadTickets();
  }, [authLoading, loadTickets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      role: role ?? "venue",
      category,
      subject: subject.trim(),
      message: message.trim(),
    });

    setSubmitting(false);
    if (insertError) {
      setError(
        insertError.message.includes("check constraint")
          ? "Please give a subject (3+ characters) and a message of at least 10 characters."
          : insertError.message
      );
      return;
    }

    setSubject("");
    setMessage("");
    setCategory("general");
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
    loadTickets();
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/help"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Help Centre
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Support tickets</h1>
            <p className="mt-1 text-zinc-400">
              Raise an issue with our team and track replies here.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition-colors hover:bg-shield-600"
            >
              {showForm ? "Cancel" : "New ticket"}
            </button>
          )}
        </div>

        {success && (
          <div className="mt-6 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Ticket submitted — we&apos;ll get back to you as soon as possible.
          </div>
        )}

        {!authLoading && !user && (
          <div className="mt-8 glass-strong rounded-2xl p-8 text-center">
            <p className="text-zinc-300">You need to be logged in to raise a support ticket.</p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-shield-600"
            >
              Log in
            </Link>
          </div>
        )}

        {showForm && user && (
          <form onSubmit={handleSubmit} className="mt-8 glass-strong space-y-4 rounded-2xl p-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                What&apos;s it about?
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 text-white outline-none transition focus:border-shield-500/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Subject</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Message</label>
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened, including booking names or dates if relevant…"
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition-colors hover:bg-shield-600 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit ticket"}
            </button>
          </form>
        )}

        {/* Ticket list */}
        {user && (
          <div className="mt-8 space-y-3">
            {loading ? (
              <div className="glass rounded-2xl p-8 text-center text-zinc-500">Loading…</div>
            ) : tickets.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-zinc-400">No tickets yet.</p>
                <p className="mt-1 text-sm text-zinc-500">
                  When you raise one, you&apos;ll see its status and our replies here.
                </p>
              </div>
            ) : (
              tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
            )}
          </div>
        )}
      </main>
    </div>
  );
}
