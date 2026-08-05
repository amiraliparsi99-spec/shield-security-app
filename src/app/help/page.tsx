"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { ShieldAIFloating } from "@/components/ai/ShieldAIFloating";
import { FAQS, FAQ_CATEGORIES, faqsForRole, type FAQCategory } from "@/data/faqs";
import { motion } from "@/components/ui/motion";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition"
      >
        <span className="font-medium text-white pr-4">{question}</span>
        <motion.span
          className="text-zinc-400 text-xl flex-shrink-0"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          +
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed">{answer}</p>
      </motion.div>
    </div>
  );
}

export default function HelpCentrePage() {
  const { user, role } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FAQCategory | "all">("all");

  const dashboardRole =
    role === "venue" || role === "personnel" || role === "agency" ? role : null;

  const relevantFaqs = useMemo(
    () => (dashboardRole ? faqsForRole(dashboardRole) : FAQS),
    [dashboardRole]
  );

  const visibleCategories = useMemo(() => {
    const present = new Set(relevantFaqs.map((f) => f.category));
    return FAQ_CATEGORIES.filter((c) => present.has(c.id));
  }, [relevantFaqs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return relevantFaqs.filter((f) => {
      if (activeCategory !== "all" && f.category !== activeCategory) return false;
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    });
  }, [relevantFaqs, activeCategory, search]);

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
            Help Centre
          </span>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            How can we <span className="text-gradient-teal">help?</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">
            Search the knowledge base, ask Shield AI, or raise a ticket with our team.
          </p>
        </div>

        {/* Quick actions */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/help/tickets"
            className="glass-strong group rounded-2xl p-5 transition hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/15 text-shield-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75zm0 5.25h.008v.008H3.75V12zm0 5.25h.008v.008H3.75v-.008z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-white group-hover:text-shield-300 transition">
                  Raise a support ticket
                </div>
                <div className="text-sm text-zinc-400">
                  Track replies from our team
                </div>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("shield-ai:open"))}
            disabled={!dashboardRole}
            className="glass-strong group rounded-2xl p-5 text-left transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-white group-hover:text-purple-300 transition">
                  Ask Shield AI
                </div>
                <div className="text-sm text-zinc-400">
                  {dashboardRole ? "Instant answers, any time" : "Log in to use the assistant"}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="mt-8">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for answers…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 pl-12 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-shield-500/50 focus:bg-white/[0.05]"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-gradient-to-r from-shield-500 to-shield-600 text-white shadow-lg shadow-shield-500/30"
                : "glass text-zinc-400 hover:text-white"
            }`}
          >
            All
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? "bg-gradient-to-r from-shield-500 to-shield-600 text-white shadow-lg shadow-shield-500/30"
                  : "glass text-zinc-400 hover:text-white"
              }`}
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ list */}
        <div className="mt-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-zinc-400">
                No answers matched your search. Try different keywords, ask Shield AI,
                or{" "}
                <Link href="/help/tickets" className="text-shield-400 hover:text-shield-300">
                  raise a ticket
                </Link>
                .
              </p>
            </div>
          ) : (
            filtered.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))
          )}
        </div>

        {/* Contact */}
        <div className="mt-12 glass-strong rounded-2xl p-6 text-center">
          <h2 className="font-display text-lg font-semibold text-white">
            Still stuck?
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Raise a ticket and our team will get back to you, or email{" "}
            <a href="mailto:hello@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">
              hello@shieldsecurity.app
            </a>
            .
          </p>
        </div>
      </main>

      {/* Floating assistant so "Ask Shield AI" works on this page too */}
      {dashboardRole && (
        <ShieldAIFloating
          userRole={dashboardRole}
          userName={user?.email ?? undefined}
        />
      )}
    </div>
  );
}
