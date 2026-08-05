"use client";

import { useState } from "react";
import Link from "next/link";
import { FadeIn, FloatingOrb, PulseButton, motion } from "@/components/ui/motion";
import { FAQS, PUBLIC_FAQ_CATEGORIES, type FAQCategory } from "@/data/faqs";

const faqs = FAQS.filter((f) => f.category !== "using-the-app");
const categories = PUBLIC_FAQ_CATEGORIES;

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

export default function FAQsPage() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>("general");
  const filtered = faqs.filter((f) => f.category === activeCategory);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-40 top-40" delay={0} />
        <FloatingOrb size={300} color="cyan" className="absolute right-0 top-1/3" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <FadeIn>
          <div className="text-center">
            <span className="mb-4 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
              Got questions?
            </span>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Frequently Asked <span className="text-gradient-teal">Questions</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              Everything you need to know about using Shield HQ — whether you&apos;re a venue or a security professional.
            </p>
          </div>
        </FadeIn>

        {/* Category Tabs */}
        <FadeIn delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
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
        </FadeIn>

        {/* FAQ List */}
        <div className="mt-8 space-y-3">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {filtered.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </motion.div>
        </div>

        {/* Still have questions */}
        <FadeIn delay={0.3}>
          <div className="mt-16 glass-strong rounded-2xl p-8 text-center">
            <h2 className="font-display text-xl font-semibold text-white">Still have questions?</h2>
            <p className="mt-2 text-zinc-400">
              We&apos;re here to help. Reach out and we&apos;ll get back to you as soon as possible.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href="mailto:hello@shieldsecurity.app">
                <PulseButton variant="primary">Email us</PulseButton>
              </a>
              <Link href="/how-it-works">
                <PulseButton variant="secondary">How Shield HQ works</PulseButton>
              </Link>
            </div>
          </div>
        </FadeIn>
      </main>
    </div>
  );
}
