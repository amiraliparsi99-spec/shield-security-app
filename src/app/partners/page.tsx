"use client";

import Link from "next/link";
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  GlowCard,
  FloatingOrb,
  PulseButton,
  motion,
} from "@/components/ui/motion";

export default function PartnersPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-32 top-20" delay={0} />
        <FloatingOrb size={300} color="cyan" className="absolute right-10 bottom-40" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-50" />
        <div className="noise absolute inset-0" />
      </div>

      {/* Hero */}
      <section className="relative border-b border-white/[0.06] pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <FadeIn direction="down" delay={0.1}>
            <span className="mb-6 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
              Agency Partnership Program
            </span>
          </FadeIn>

          <FadeIn direction="up" delay={0.2}>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Grow Your Agency with <span className="text-gradient-teal">Shield</span>
            </h1>
          </FadeIn>

          <FadeIn direction="up" delay={0.4}>
            <p className="mt-6 text-lg leading-relaxed text-zinc-400 sm:text-xl">
              We're not here to compete with you — we're here to bring you more bookings. 
              Partner with Shield and access venues looking for reliable security right now.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="relative border-b border-white/[0.06] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-2xl font-semibold sm:text-3xl">
              Why <span className="text-gradient-teal">Partner</span> with Shield?
            </h2>
          </FadeIn>

          <StaggerContainer className="mt-12 grid gap-6 md:grid-cols-3" staggerDelay={0.15}>
            <StaggerItem>
              <GlowCard className="h-full text-center">
                <div className="text-4xl mb-4">📈</div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  Extra Revenue Stream
                </h3>
                <p className="text-zinc-400 text-sm">
                  Get bookings from venues you've never worked with. We do the marketing, 
                  you provide the staff.
                </p>
              </GlowCard>
            </StaggerItem>

            <StaggerItem>
              <GlowCard className="h-full text-center">
                <div className="text-4xl mb-4">🤝</div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  Keep Your Relationships
                </h3>
                <p className="text-zinc-400 text-sm">
                  Your existing clients stay yours. Shield only brings you new business, 
                  never competes for your current accounts.
                </p>
              </GlowCard>
            </StaggerItem>

            <StaggerItem>
              <GlowCard className="h-full text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  Zero Effort to Start
                </h3>
                <p className="text-zinc-400 text-sm">
                  List your agency once, add your available staff. We handle payments, 
                  scheduling conflicts, and client communication.
                </p>
              </GlowCard>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* How It Works for Agencies */}
      <section className="relative border-b border-white/[0.06] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-2xl font-semibold text-white sm:text-3xl">
              How It <span className="text-gradient-teal">Works</span>
            </h2>
          </FadeIn>

          <StaggerContainer className="mt-12 grid gap-6 md:grid-cols-4" staggerDelay={0.1}>
            <StaggerItem>
              <motion.div
                className="glass rounded-2xl p-6 text-center"
                whileHover={{ scale: 1.03 }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-lg font-bold text-white mb-4">
                  1
                </div>
                <h3 className="font-semibold text-white mb-2">Sign Up</h3>
                <p className="text-sm text-zinc-400">
                  Create your agency profile with company details and service areas
                </p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div
                className="glass rounded-2xl p-6 text-center"
                whileHover={{ scale: 1.03 }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-lg font-bold text-white mb-4">
                  2
                </div>
                <h3 className="font-semibold text-white mb-2">Add Staff</h3>
                <p className="text-sm text-zinc-400">
                  Add your team members with their SIA details and availability
                </p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div
                className="glass rounded-2xl p-6 text-center"
                whileHover={{ scale: 1.03 }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-lg font-bold text-white mb-4">
                  3
                </div>
                <h3 className="font-semibold text-white mb-2">Get Requests</h3>
                <p className="text-sm text-zinc-400">
                  Venues post shifts, you get notified when there's a match
                </p>
              </motion.div>
            </StaggerItem>

            <StaggerItem>
              <motion.div
                className="glass rounded-2xl p-6 text-center"
                whileHover={{ scale: 1.03 }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-lg font-bold text-white mb-4">
                  4
                </div>
                <h3 className="font-semibold text-white mb-2">Get Paid</h3>
                <p className="text-sm text-zinc-400">
                  Accept bookings, deliver service, funds hit your account
                </p>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Revenue Calculator */}
      <section className="relative border-b border-white/[0.06] py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <FadeIn>
            <GlowCard className="text-center">
              <h2 className="font-display text-2xl font-semibold text-white mb-6">
                💰 Potential Extra Revenue
              </h2>
              
              <div className="grid grid-cols-3 gap-8 mb-8">
                <div>
                  <div className="text-3xl font-bold text-shield-400">10</div>
                  <div className="text-sm text-zinc-500">Extra shifts/month</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-shield-400">£120</div>
                  <div className="text-sm text-zinc-500">Average shift value</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-shield-400">90%</div>
                  <div className="text-sm text-zinc-500">You keep (10% platform fee)</div>
                </div>
              </div>

              <div className="bg-shield-500/10 rounded-xl p-6 border border-shield-500/20">
                <div className="text-sm text-zinc-400 mb-2">Potential monthly extra revenue</div>
                <div className="text-4xl font-bold text-gradient-teal">£1,080</div>
                <div className="text-sm text-zinc-500 mt-2">That's £12,960 extra per year</div>
              </div>
            </GlowCard>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative border-b border-white/[0.06] py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-2xl font-semibold text-white mb-12">
              Common <span className="text-gradient-teal">Questions</span>
            </h2>
          </FadeIn>

          <StaggerContainer className="space-y-4" staggerDelay={0.1}>
            <StaggerItem>
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Will this compete with my existing clients?</h3>
                <p className="text-zinc-400 text-sm">
                  No. You control which venues you work with through Shield. Your existing 
                  relationships and contracts remain 100% yours.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">What does it cost?</h3>
                <p className="text-zinc-400 text-sm">
                  Free to join. We take 10% of each booking made through the platform. 
                  You set your own rates — if you charge £15/hour, you keep £13.50.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">How quickly do I get paid?</h3>
                <p className="text-zinc-400 text-sm">
                  Standard payouts are free and arrive within 2-3 business days. 
                  Need it faster? Instant payouts (1% fee) hit your account in minutes.
                </p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Do I need to be SIA ACS approved?</h3>
                <p className="text-zinc-400 text-sm">
                  No, but ACS-approved agencies get a verified badge and appear higher 
                  in search results. It's a competitive advantage, not a requirement.
                </p>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20">
        <FloatingOrb size={350} color="teal" className="absolute left-0 top-0 -translate-y-1/2 opacity-50" delay={1} />

        <FadeIn>
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <motion.div
              className="glass-strong rounded-3xl p-10 sm:p-14"
              whileHover={{ boxShadow: "0 0 60px rgba(20, 184, 166, 0.15)" }}
            >
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                Ready to <span className="text-gradient-teal">Partner</span>?
              </h2>
              <p className="mt-4 text-zinc-400">
                Join Shield's partner network. 5-minute signup, no commitment until you accept your first booking.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup/agency">
                  <PulseButton variant="primary">
                    Register Your Agency
                  </PulseButton>
                </Link>
                <Link href="/login">
                  <PulseButton variant="secondary">
                    Already registered? Log in
                  </PulseButton>
                </Link>
              </div>
              <p className="mt-6 text-sm text-zinc-500">
                Questions? Email us at <span className="text-shield-400">partners@shieldapp.co.uk</span>
              </p>
            </motion.div>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.06] py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link href="/">
              <motion.span className="font-display text-xl font-semibold text-gradient-teal" whileHover={{ scale: 1.05 }}>
                Shield
              </motion.span>
            </Link>
            <div className="flex gap-6 text-sm text-zinc-500">
              <Link href="/" className="transition hover:text-zinc-300">Home</Link>
              <Link href="/how-it-works" className="transition hover:text-zinc-300">How it works</Link>
              <Link href="/signup" className="transition hover:text-zinc-300">Sign up</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
