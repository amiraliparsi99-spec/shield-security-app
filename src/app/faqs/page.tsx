"use client";

import { useState } from "react";
import Link from "next/link";
import { FadeIn, FloatingOrb, GlowCard, PulseButton, motion } from "@/components/ui/motion";

type FAQCategory = "general" | "venues" | "guards" | "payments";

const faqs: { category: FAQCategory; question: string; answer: string }[] = [
  // General
  { category: "general", question: "What is Shield HQ?", answer: "Shield HQ is a platform that connects venues (bars, clubs, event spaces, and more) directly with SIA-licensed security professionals. We cut out the middleman so venues get reliable staff fast, and guards earn more money." },
  { category: "general", question: "Where is Shield HQ available?", answer: "We're currently launching in Birmingham, UK — one of the busiest nightlife cities in the country. We're expanding to other UK cities soon. Sign up now to be first in line when we reach your area." },
  { category: "general", question: "Is Shield HQ free to use?", answer: "For venues, yes — completely free. There are no subscription fees, no sign-up costs, and no per-booking charges for venues. Security guards pay a small 10% fee from their earnings per shift, which is significantly less than the 30-40% traditional agencies take." },
  { category: "general", question: "How is Shield HQ different from a security agency?", answer: "Traditional agencies take 30-40% of what venues pay, and guards wait weeks to get paid. Shield HQ connects venues and guards directly with just a 10% fee from the guard's earnings. Venues pay the same rate — guards just keep more of it." },
  { category: "general", question: "Do I need to download an app?", answer: "The mobile app (available on iOS and Android) is the best way to use Shield HQ if you're a security guard — you get instant shift notifications, GPS check-in, and can manage everything on the go. Venues can use the web dashboard or the app." },

  // Venues
  { category: "venues", question: "How quickly can I find security staff?", answer: "Most shifts get responses within minutes. When you post a shift, Shield HQ instantly notifies all matching, available guards in your area. For last-minute requests, our Uber-style instant matching means you can fill shifts same-day." },
  { category: "venues", question: "Are all guards on Shield HQ SIA licensed?", answer: "Yes. Every security professional on Shield HQ must verify their SIA licence before they can accept any shifts. We check licence validity and type (Door Supervisor, Security Guard, etc.) during signup." },
  { category: "venues", question: "Can I book the same guards again?", answer: "Absolutely. You can save preferred staff, view their past performance at your venue, and request them directly for future shifts. Building relationships with reliable guards is what Shield HQ is all about." },
  { category: "venues", question: "What if a guard doesn't show up?", answer: "Shield HQ has GPS-verified check-in so you know exactly when staff arrive. If a guard cancels or doesn't show, we immediately notify available backup staff in your area. Your ratings and reviews help ensure reliability." },
  { category: "venues", question: "How do I pay for shifts?", answer: "As a venue, you pay the agreed hourly rate for the guard. The 10% platform fee comes from the guard's earnings — you don't pay any extra. All payments are handled securely through Stripe." },

  // Guards
  { category: "guards", question: "What SIA licence do I need?", answer: "You need a valid SIA Door Supervisor or Security Guard licence. During signup, you'll upload your licence details and we verify them. Having additional qualifications (First Aid, CCTV, etc.) makes your profile more attractive to venues." },
  { category: "guards", question: "How much can I earn on Shield HQ?", answer: "You set your own hourly rate. A typical Door Supervisor in Birmingham earns £14-18/hr. With Shield HQ, you keep 90% of what the venue pays — compared to just 60-70% through traditional agencies. That's up to £672 more per month." },
  { category: "guards", question: "How do I get paid?", answer: "After completing a shift, your earnings (minus the 10% platform fee) are processed and sent to your bank account. You can track all your earnings, pending payments, and completed shifts in the app." },
  { category: "guards", question: "Can I choose which shifts I work?", answer: "Yes — you're in full control. Set your availability for when you're free, browse available shifts on the map, and accept only the ones that work for you. There's no minimum commitment or exclusivity." },
  { category: "guards", question: "What happens if I need to cancel a shift?", answer: "We understand things come up. You can cancel a shift through the app, but please give as much notice as possible. Repeated last-minute cancellations may affect your reliability rating, which venues can see." },

  // Payments
  { category: "payments", question: "What does the 10% fee cover?", answer: "The 10% guard fee covers the platform: instant matching, SIA verification, secure payments, GPS check-in, ratings and reviews, notifications, and ongoing support. It's taken from the guard's earnings — venues don't pay any platform fees." },
  { category: "payments", question: "Are there any hidden fees?", answer: "No. For venues: £0 — always. For guards: 10% from your shift earnings. That's it. No sign-up fees, no monthly subscriptions, no cancellation charges." },
  { category: "payments", question: "How are payments processed?", answer: "All payments go through Stripe, one of the world's most trusted payment processors. Your financial details are encrypted and never stored on our servers." },
  { category: "payments", question: "When do guards get paid?", answer: "Payments are processed after the venue confirms the shift is complete. We're building instant payouts so you can access your earnings even faster — stay tuned." },
];

const categories: { id: FAQCategory; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "💡" },
  { id: "venues", label: "For Venues", icon: "🏢" },
  { id: "guards", label: "For Guards", icon: "🛡️" },
  { id: "payments", label: "Payments & Fees", icon: "💷" },
];

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
