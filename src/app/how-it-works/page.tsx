"use client";

import Link from "next/link";
import { FadeIn, StaggerContainer, StaggerItem, FloatingOrb, GlowCard, PulseButton } from "@/components/ui/motion";

export default function HowItWorks() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-40 top-40" delay={0} />
        <FloatingOrb size={300} color="cyan" className="absolute right-0 top-1/3" delay={2} />
        <FloatingOrb size={250} color="teal" className="absolute left-1/4 bottom-20" delay={4} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        {/* Hero */}
        <FadeIn>
          <div className="text-center">
            <span className="mb-4 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
              Simple by design
            </span>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              How <span className="text-gradient-teal">Shield HQ</span> works
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              From signup to your first shift — here&apos;s how venues find security staff and how guards find work, all in one platform.
            </p>
          </div>
        </FadeIn>

        {/* Visual Timeline - Venues */}
        <FadeIn delay={0.1}>
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-shield-500 to-shield-600 shadow-lg shadow-shield-500/30">
                <span className="text-xl">🏢</span>
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">For Venues</h2>
                <p className="text-sm text-zinc-400">Find verified security staff in minutes</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-shield-500/50 via-shield-500/20 to-transparent hidden sm:block" />

              <StaggerContainer className="space-y-6" staggerDelay={0.1}>
                {[
                  { step: 1, title: "Create your venue profile", desc: "Add your venue name, type (bar, club, event space), location, and any specific compliance requirements. It takes under 2 minutes.", icon: "📝" },
                  { step: 2, title: "Post a shift request", desc: "Tell us what you need: the date, time, number of guards, any certifications required (e.g. SIA Door Supervisor), and the hourly rate you're offering.", icon: "📋" },
                  { step: 3, title: "Get matched with available staff", desc: "Shield HQ instantly shows you verified, SIA-licensed professionals who are available for your shift. Browse their profiles, ratings, and experience — or wait for them to apply.", icon: "🔍" },
                  { step: 4, title: "Book with one click", desc: "Found the right person? Send an offer. Once they accept, it becomes a confirmed booking — both of you see it on your dashboard and calendar.", icon: "✅" },
                  { step: 5, title: "Track and manage everything", desc: "See live check-ins when staff arrive, track shift progress in real-time, rate your guards afterwards, and view all spending from one dashboard.", icon: "📊" },
                ].map((item) => (
                  <StaggerItem key={item.step}>
                    <div className="flex gap-5 items-start">
                      <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-shield-500/15 border border-shield-500/20 text-xl z-10">
                        {item.icon}
                      </div>
                      <div className="glass glass-hover rounded-2xl p-5 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-shield-400 bg-shield-500/10 px-2 py-0.5 rounded-full">Step {item.step}</span>
                        </div>
                        <h3 className="font-display text-lg font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </FadeIn>

        {/* Visual Timeline - Security */}
        <FadeIn delay={0.2}>
          <div className="mt-20">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <span className="text-xl">🛡️</span>
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold text-white">For Security Professionals</h2>
                <p className="text-sm text-zinc-400">Get more shifts and earn more money</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-transparent hidden sm:block" />

              <StaggerContainer className="space-y-6" staggerDelay={0.1}>
                {[
                  { step: 1, title: "Sign up and verify your SIA licence", desc: "Create your profile with your SIA licence details, experience, and the hourly rate you want. Upload your licence for verification — this makes you stand out to venues.", icon: "🪪" },
                  { step: 2, title: "Set your availability", desc: "Tell Shield HQ when you're free to work. Set one-off availability or recurring weekly blocks. Update anytime from your phone.", icon: "📅" },
                  { step: 3, title: "Get notified of matching shifts", desc: "When a venue posts a shift that matches your availability, location, and qualifications, you get an instant notification. Accept shifts Uber-style with one tap.", icon: "🔔" },
                  { step: 4, title: "Work the shift", desc: "Check in on arrival with GPS verification. The venue sees you're on-site in real-time. Complete your shift and clock out through the app.", icon: "💼" },
                  { step: 5, title: "Get paid and build your reputation", desc: "Earnings go straight to your account with full transparency — you keep 90%, Shield HQ takes a small 10% fee. Build ratings and reviews that get you booked by top venues.", icon: "💷" },
                ].map((item) => (
                  <StaggerItem key={item.step}>
                    <div className="flex gap-5 items-start">
                      <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-xl z-10">
                        {item.icon}
                      </div>
                      <div className="glass rounded-2xl p-5 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Step {item.step}</span>
                        </div>
                        <h3 className="font-display text-lg font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </FadeIn>

        {/* Trust & Safety */}
        <FadeIn delay={0.3}>
          <div className="mt-20">
            <h2 className="font-display text-center text-2xl font-semibold text-white sm:text-3xl mb-10">
              Built on <span className="text-gradient-teal">trust</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { icon: "🪪", title: "SIA Verified", desc: "Every security professional verifies their SIA licence before they can accept any shifts on Shield HQ." },
                { icon: "⭐", title: "Ratings & Reviews", desc: "Both venues and guards rate each other after every shift. Quality stays high, and reputations are earned." },
                { icon: "🔒", title: "Secure Payments", desc: "All payments processed through Stripe. Full transaction history, fast payouts, and complete transparency." },
              ].map((item, i) => (
                <div
                  key={i}
                  className="glass glass-hover rounded-2xl p-6 text-center"
                >
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-display text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Pricing Quick Overview */}
        <FadeIn delay={0.4}>
          <div className="mt-20">
            <GlowCard className="p-8 sm:p-10 text-center">
              <h2 className="font-display text-2xl font-semibold text-white">Simple, honest pricing</h2>
              <p className="mt-2 text-zinc-400">No subscriptions, no hidden fees, no contracts.</p>

              <div className="mt-8 grid sm:grid-cols-2 gap-6 max-w-xl mx-auto">
                <div className="glass rounded-2xl p-6">
                  <div className="text-2xl mb-2">🏢</div>
                  <div className="text-3xl font-bold text-shield-400">£0</div>
                  <div className="text-sm text-zinc-400 mt-1">For venues</div>
                  <p className="text-xs text-zinc-500 mt-3">Completely free to post shifts, browse staff, and manage bookings. No venue fees ever.</p>
                </div>
                <div className="glass rounded-2xl p-6">
                  <div className="text-2xl mb-2">🛡️</div>
                  <div className="text-3xl font-bold text-emerald-400">10%</div>
                  <div className="text-sm text-zinc-400 mt-1">Guard fee</div>
                  <p className="text-xs text-zinc-500 mt-3">A small 10% comes from the guard&apos;s earnings per shift. Far less than the 30-40% agencies take.</p>
                </div>
              </div>
            </GlowCard>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.5}>
          <div className="mt-16 glass-strong rounded-2xl p-8 sm:p-10 text-center">
            <h2 className="font-display text-2xl font-semibold text-white">Ready to get started?</h2>
            <p className="mt-2 text-zinc-400">Join Shield HQ and see how easy security staffing can be.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup/venue">
                <PulseButton variant="primary">I need security staff</PulseButton>
              </Link>
              <Link href="/signup/personnel">
                <PulseButton variant="secondary">I&apos;m SIA licensed</PulseButton>
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Have questions? Check our <Link href="/faqs" className="text-shield-400 hover:text-shield-300">FAQs</Link> or email <a href="mailto:hello@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">hello@shieldsecurity.app</a>
            </p>
          </div>
        </FadeIn>
      </main>
    </div>
  );
}
