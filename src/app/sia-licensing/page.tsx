"use client";

import Link from "next/link";
import { FadeIn, FloatingOrb, GlowCard, StaggerContainer, StaggerItem, PulseButton } from "@/components/ui/motion";

export default function SIALicensingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={400} color="teal" className="absolute -left-40 top-40" delay={0} />
        <FloatingOrb size={300} color="cyan" className="absolute right-0 top-1/3" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        {/* Hero */}
        <FadeIn>
          <div className="text-center">
            <span className="mb-4 inline-block rounded-full glass px-4 py-1.5 text-xs font-medium text-shield-400">
              🪪 Essential info for guards
            </span>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              SIA Licensing <span className="text-gradient-teal">Guide</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              Everything you need to know about getting and maintaining your SIA licence to work as a security professional in the UK.
            </p>
          </div>
        </FadeIn>

        {/* What is SIA */}
        <FadeIn delay={0.1}>
          <GlowCard className="mt-12 p-8">
            <h2 className="font-display text-2xl font-semibold text-white">What is the SIA?</h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              The <strong className="text-white">Security Industry Authority (SIA)</strong> is the organisation responsible for regulating the private security industry in the UK. 
              If you want to work in security — as a door supervisor, security guard, CCTV operator, or close protection officer — you need a valid SIA licence.
            </p>
            <p className="mt-3 text-zinc-400 leading-relaxed">
              It is a legal requirement under the <strong className="text-white">Private Security Industry Act 2001</strong>. Working without a valid licence is a criminal offence and can result in prosecution, fines, or imprisonment.
            </p>
          </GlowCard>
        </FadeIn>

        {/* Licence Types */}
        <FadeIn delay={0.15}>
          <div className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-white mb-6">Types of SIA Licence</h2>
            <StaggerContainer className="grid sm:grid-cols-2 gap-5" staggerDelay={0.1}>
              {[
                { title: "Door Supervisor", icon: "🚪", desc: "Required for working at licensed premises — pubs, bars, clubs, and events where alcohol is served. The most common licence type on Shield HQ.", requirements: "Level 2 Award for Door Supervisors" },
                { title: "Security Guard", icon: "🛡️", desc: "For guarding premises, property, or people. Covers retail security, corporate sites, construction sites, and residential security.", requirements: "Level 2 Award for Security Guards" },
                { title: "CCTV Operator", icon: "📹", desc: "For operating CCTV systems in public spaces. Required if you're monitoring live CCTV footage that covers areas the public can access.", requirements: "Level 2 Award for CCTV Operators" },
                { title: "Close Protection", icon: "🕶️", desc: "For bodyguard and personal protection work. The most advanced licence, requiring significant additional training.", requirements: "Level 3 Certificate in Close Protection" },
              ].map((type, i) => (
                <StaggerItem key={i}>
                  <div className="glass glass-hover rounded-2xl p-6 h-full">
                    <div className="text-3xl mb-3">{type.icon}</div>
                    <h3 className="font-display text-lg font-semibold text-white">{type.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{type.desc}</p>
                    <div className="mt-3 bg-shield-500/10 rounded-lg px-3 py-2">
                      <span className="text-xs text-shield-400 font-medium">Training required: </span>
                      <span className="text-xs text-zinc-300">{type.requirements}</span>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeIn>

        {/* How to Get a Licence */}
        <FadeIn delay={0.2}>
          <div className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-white mb-6">How to get your SIA licence</h2>
            <div className="space-y-4">
              {[
                { step: 1, title: "Complete an approved training course", desc: "Find an SIA-approved training provider and complete the relevant qualification for your licence type. Door Supervisor courses typically take 4-6 days and cost £150-250. Training covers conflict management, physical intervention, and legal knowledge." },
                { step: 2, title: "Apply online via the SIA website", desc: "Once you have your qualification certificate, apply for your licence at sia.homeoffice.gov.uk. You'll need proof of identity, your training certificate, and the right to work in the UK." },
                { step: 3, title: "Identity check", desc: "The SIA will verify your identity. You may need to attend an identity check appointment or use an online verification service. This is a standard part of the process." },
                { step: 4, title: "Criminal record check", desc: "A DBS (Disclosure and Barring Service) check is carried out as part of the application. Certain criminal convictions may affect your eligibility." },
                { step: 5, title: "Receive your licence", desc: "Processing typically takes 4-6 weeks. Once approved, you'll receive your SIA licence card. You must carry this with you at all times while working in security." },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex gap-5 items-start group"
                >
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-shield-500 to-shield-600 text-sm font-bold text-white shadow-md shadow-shield-500/20">
                    {item.step}
                  </div>
                  <div className="glass glass-hover rounded-xl p-5 flex-1">
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Key Facts */}
        <FadeIn delay={0.25}>
          <GlowCard className="mt-12 p-8">
            <h2 className="font-display text-2xl font-semibold text-white mb-6">Key facts to know</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: "Licence cost", value: "£184", note: "Standard application fee" },
                { label: "Valid for", value: "3 years", note: "Then you must renew" },
                { label: "Processing time", value: "4-6 weeks", note: "From application to delivery" },
                { label: "Renewal cost", value: "£184", note: "Apply 16 weeks before expiry" },
              ].map((fact, i) => (
                <div key={i} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.05]">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider">{fact.label}</div>
                  <div className="text-2xl font-bold text-shield-400 mt-1">{fact.value}</div>
                  <div className="text-xs text-zinc-500 mt-1">{fact.note}</div>
                </div>
              ))}
            </div>
          </GlowCard>
        </FadeIn>

        {/* Renewal Reminder */}
        <FadeIn delay={0.3}>
          <div className="mt-12 glass rounded-2xl p-8 border border-amber-500/20">
            <div className="flex items-start gap-4">
              <div className="text-3xl flex-shrink-0">⚠️</div>
              <div>
                <h3 className="font-display text-xl font-semibold text-amber-400">Don&apos;t forget to renew</h3>
                <p className="mt-2 text-zinc-400 leading-relaxed">
                  Your SIA licence is valid for 3 years. The SIA recommends applying for renewal <strong className="text-white">at least 16 weeks before your licence expires</strong>. 
                  If your licence expires and you continue working, you&apos;re breaking the law. Set a reminder, or better yet — Shield HQ will notify you when your licence is approaching its expiry date.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Training Providers */}
        <FadeIn delay={0.35}>
          <div className="mt-12">
            <h2 className="font-display text-2xl font-semibold text-white mb-3">Find a training provider</h2>
            <p className="text-zinc-400 text-sm mb-6">
              To get your SIA licence, you need to complete an approved training course first. Here are some well-known providers that offer SIA-approved qualifications in and around Birmingham.
            </p>
            <StaggerContainer className="grid sm:grid-cols-2 gap-4" staggerDelay={0.08}>
              {[
                { name: "Get Licensed", location: "Birmingham & online", courses: "Door Supervisor, Security Guard, CCTV", price: "From £150", url: "https://www.getlicensed.co.uk/", note: "Popular choice with fast-track courses" },
                { name: "Highfield Qualifications", location: "Nationwide (various centres)", courses: "Door Supervisor, Security Guard", price: "From £180", url: "https://www.highfieldqualifications.com/", note: "One of the UK's largest awarding bodies" },
                { name: "Skills for Security", location: "National", courses: "All SIA licence types", price: "Varies by provider", url: "https://www.skillsforsecurity.org.uk/", note: "Industry skills body for the security sector" },
                { name: "Local colleges & training centres", location: "Birmingham area", courses: "Door Supervisor, Security Guard", price: "From £140", url: "", note: "Search for 'SIA training Birmingham' to find local options" },
              ].map((provider, i) => (
                <StaggerItem key={i}>
                  <div className="glass glass-hover rounded-2xl p-5 h-full flex flex-col">
                    <h3 className="font-semibold text-white">{provider.name}</h3>
                    <div className="mt-2 space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="text-shield-400">📍</span> {provider.location}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="text-shield-400">📋</span> {provider.courses}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="text-shield-400">💷</span> {provider.price}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500 italic">{provider.note}</p>
                    {provider.url && (
                      <a href={provider.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-shield-400 hover:text-shield-300 font-medium transition">
                        Visit website
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
            <p className="mt-4 text-xs text-zinc-500">
              Always verify that your chosen provider is approved by an SIA-recognised awarding body before enrolling. Prices and availability may vary.
            </p>
          </div>
        </FadeIn>

        {/* External Links */}
        <FadeIn delay={0.4}>
          <div className="mt-12">
            <h2 className="font-display text-xl font-semibold text-white mb-4">Official resources</h2>
            <div className="space-y-3">
              {[
                { label: "SIA Official Website", url: "https://www.gov.uk/government/organisations/security-industry-authority", desc: "The Security Industry Authority's main page" },
                { label: "Apply for an SIA Licence", url: "https://services.sia.homeoffice.gov.uk/", desc: "Start your licence application online" },
                { label: "Check a Licence", url: "https://services.sia.homeoffice.gov.uk/PublicRegister/", desc: "Verify if an SIA licence is valid" },
              ].map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between glass rounded-xl p-4 hover:bg-white/[0.04] transition group"
                >
                  <div>
                    <div className="font-medium text-white group-hover:text-shield-400 transition">{link.label}</div>
                    <div className="text-xs text-zinc-500">{link.desc}</div>
                  </div>
                  <svg className="h-4 w-4 text-zinc-500 group-hover:text-shield-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.4}>
          <div className="mt-16 glass-strong rounded-2xl p-8 text-center">
            <h2 className="font-display text-xl font-semibold text-white">Got your SIA licence?</h2>
            <p className="mt-2 text-zinc-400">
              Join Shield HQ and start earning. Sign up, verify your licence, and get matched with shifts near you.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup/personnel">
                <PulseButton variant="primary">Join as security</PulseButton>
              </Link>
              <Link href="/faqs">
                <PulseButton variant="secondary">Read FAQs</PulseButton>
              </Link>
            </div>
          </div>
        </FadeIn>
      </main>
    </div>
  );
}
