"use client";

import Link from "next/link";
import { FadeIn, StaggerContainer, StaggerItem, FloatingOrb, GlowCard, PulseButton, motion } from "@/components/ui/motion";

const venueSteps = [
  "Create your venue profile (name, type, location, any compliance needs).",
  "Post a Request when you need guards: date, time, number of guards, certifications, and rate.",
  "Browse Available personnel and agencies that match, or wait for them to apply.",
  "Send an Offer. Once they accept, it becomes a Booking — both sides see it on their calendar.",
  "For recurring or last-minute needs, you can post standing requests or one-off fill-ins.",
];

const securitySteps = [
  "Sign up as Personnel (individual) or Agency (team).",
  "Build your profile: certs, experience, rate, insurance. Verification makes you stand out.",
  "Set your Availability — when you're free to work. You can do one-off or recurring blocks.",
  "You'll appear in venue searches. You can also browse Requests and apply to those that fit.",
  "When a venue sends an Offer, accept or decline. Accepted = Booking. Show up, get paid.",
];

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

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <FadeIn>
          <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            How <span className="text-gradient-teal">Shield</span> works
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            A short guide to the first marketplace built for venues and security.
          </p>
        </FadeIn>

        <div className="mt-12 space-y-12">
          {/* For Venues */}
          <FadeIn delay={0.1}>
            <GlowCard className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                  <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-semibold text-white">For venues</h2>
              </div>
              <StaggerContainer className="mt-6 space-y-4">
                {venueSteps.map((step, i) => (
                  <StaggerItem key={i}>
                    <div className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-shield-500/20 text-sm font-semibold text-shield-400">
                        {i + 1}
                      </span>
                      <p className="text-zinc-300">{step}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </GlowCard>
          </FadeIn>

          {/* For Security */}
          <FadeIn delay={0.2}>
            <GlowCard className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                  <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-semibold text-white">For security and agencies</h2>
              </div>
              <StaggerContainer className="mt-6 space-y-4">
                {securitySteps.map((step, i) => (
                  <StaggerItem key={i}>
                    <div className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-shield-500/20 text-sm font-semibold text-shield-400">
                        {i + 1}
                      </span>
                      <p className="text-zinc-300">{step}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </GlowCard>
          </FadeIn>

          {/* Trust and compliance */}
          <FadeIn delay={0.3}>
            <GlowCard className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                  <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-semibold text-white">Trust and compliance</h2>
              </div>
              <p className="mt-4 text-zinc-300 leading-relaxed">
                We treat certs and insurance as first-class. Profiles can show verified credentials
                (where we support it). Venues can filter by what they need (e.g. SIA, First Aid,
                alcohol-serving experience). Ratings and reviews on both sides keep quality high.
              </p>
            </GlowCard>
          </FadeIn>

          {/* Pricing */}
          <FadeIn delay={0.4}>
            <GlowCard className="p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                  <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-semibold text-white">Pricing and payments</h2>
              </div>
              <p className="mt-4 text-zinc-300 leading-relaxed">
                Rates are set per request (venue) or per profile (personnel/agency). We&apos;re building
                payments and escrow so booking and payouts happen in-app — no chasing invoices.
              </p>
            </GlowCard>
          </FadeIn>
        </div>

        {/* CTA */}
        <FadeIn delay={0.5}>
          <motion.div
            className="mt-16 glass-strong rounded-2xl p-8 text-center"
            whileHover={{ boxShadow: "0 0 50px rgba(20, 184, 166, 0.15)" }}
          >
            <h2 className="font-display text-xl font-semibold text-white">Ready to start?</h2>
            <p className="mt-2 text-zinc-400">Create your account and choose your role.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup">
                <PulseButton variant="primary">I&apos;m a venue</PulseButton>
              </Link>
              <Link href="/signup">
                <PulseButton variant="secondary">I&apos;m security or an agency</PulseButton>
              </Link>
            </div>
          </motion.div>
        </FadeIn>
      </main>
    </div>
  );
}
