"use client";

import Link from "next/link";
import { FadeIn, FloatingOrb, GlowCard, PulseButton } from "@/components/ui/motion";

export default function CareersPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-40 top-40" delay={0} />
        <FloatingOrb size={300} color="cyan" className="absolute right-0 top-1/3" delay={2} />
        <FloatingOrb size={250} color="teal" className="absolute left-1/4 bottom-20" delay={4} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {/* Hero */}
        <FadeIn>
          <div className="text-center">
            <span className="mb-4 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
              Join the team
            </span>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Careers at <span className="text-gradient-teal">Shield HQ</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              We&apos;re building the future of security staffing — and we&apos;re always looking for talented people to help us get there.
            </p>
          </div>
        </FadeIn>

        {/* About Working at Shield */}
        <FadeIn delay={0.1}>
          <GlowCard className="mt-12 p-8 sm:p-10">
            <h2 className="font-display text-2xl font-semibold text-white">We&apos;re still growing</h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Shield HQ is an early-stage startup based in Birmingham, and we&apos;re on a mission to modernise 
              how venues find security staff and how guards find work. We&apos;re not a massive corporation — 
              we&apos;re a small, driven team building something real.
            </p>
            <p className="mt-3 text-zinc-400 leading-relaxed">
              Right now, we don&apos;t have any specific job postings open. But that doesn&apos;t mean we&apos;re 
              not looking. If you&apos;re talented, passionate, and think you can add value to what we&apos;re 
              building — we want to hear from you.
            </p>
          </GlowCard>
        </FadeIn>

        {/* What We're Looking For */}
        <FadeIn delay={0.15}>
          <div className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-white mb-6">The kind of people we&apos;re looking for</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: "💻", title: "Developers", desc: "React, React Native, Next.js, TypeScript, Supabase — if you know the stack or can learn fast, we'd love to talk." },
                { icon: "🎨", title: "Designers", desc: "UI/UX, branding, product design — help us make Shield HQ look and feel world-class on every platform." },
                { icon: "📈", title: "Growth & Marketing", desc: "Content, social media, partnerships — help us get Shield HQ in front of every venue and guard in the UK." },
                { icon: "🤝", title: "Operations", desc: "Onboarding, support, venue partnerships — help us build relationships and keep things running smoothly." },
              ].map((role, i) => (
                <div
                  key={i}
                  className="glass glass-hover rounded-2xl p-6"
                >
                  <div className="text-3xl mb-3">{role.icon}</div>
                  <h3 className="font-display text-base font-semibold text-white">{role.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{role.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Why Shield */}
        <FadeIn delay={0.2}>
          <div className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-white mb-6">Why join Shield HQ?</h2>
            <div className="space-y-3">
              {[
                { icon: "🚀", text: "Get in early — join a startup at the ground floor with real ownership and impact" },
                { icon: "🏙️", text: "Based in Birmingham — one of the UK's most exciting and growing tech scenes" },
                { icon: "🧠", text: "Work on a real problem — security staffing is broken, and we're fixing it" },
                { icon: "🤸", text: "Flexible working — remote-friendly, results-focused, no corporate nonsense" },
                { icon: "📱", text: "Full-stack product — web app, mobile app, real-time features, payments, maps" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 glass glass-hover rounded-xl p-4"
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <span className="text-sm text-zinc-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* CTA - Send Us Your Details */}
        <FadeIn delay={0.3}>
          <div className="mt-16 glass-strong rounded-2xl p-8 sm:p-10 text-center">
            <div className="text-4xl mb-4">📩</div>
            <h2 className="font-display text-2xl font-semibold text-white">Think you can add value?</h2>
            <p className="mt-3 text-zinc-400 max-w-lg mx-auto leading-relaxed">
              We don&apos;t need a polished CV. Just tell us who you are, what you&apos;re good at, and why 
              you&apos;re interested in Shield HQ. If you have a portfolio, GitHub, LinkedIn, or anything 
              that shows what you can do — send it over.
            </p>
            <div className="mt-6">
              <a href="mailto:careers@shieldsecurity.app?subject=I%20want%20to%20join%20Shield%20HQ">
                <PulseButton variant="primary" className="text-base">
                  Email us at careers@shieldsecurity.app
                </PulseButton>
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              We review every email personally. If there&apos;s a fit, we&apos;ll be in touch.
            </p>
          </div>
        </FadeIn>

        <div className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/" className="text-shield-400 hover:text-shield-300">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
