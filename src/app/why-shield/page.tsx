"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type UserType = "venue" | "security" | "agency";

const benefits = {
  venue: {
    color: "teal",
    gradient: "from-teal-600 to-teal-500",
    icon: "🏢",
    title: "For Venues",
    subtitle: "Find Verified Security Staff in Minutes",
    description: "Shield connects your venue with SIA-licensed security professionals instantly. No more phone tag with agencies, no more last-minute scrambles.",
    problems: [
      "Door staff calls in sick 2 hours before doors open",
      "Spending hours calling agencies to fill weekend shifts",
      "No idea if the staff showing up are actually SIA licensed",
      "Agency markup makes security your biggest cost",
    ],
    solutions: [
      { icon: "⚡", title: "Instant Booking", desc: "Post a shift, get matched with available staff in minutes" },
      { icon: "✅", title: "Verified Staff", desc: "Every professional has verified SIA license on file" },
      { icon: "💰", title: "Transparent Pricing", desc: "See rates upfront. 10% platform fee only when you book" },
      { icon: "⭐", title: "Reviews & Ratings", desc: "Book with confidence based on real venue feedback" },
    ],
    howItWorks: [
      { step: 1, title: "Post Your Shift", desc: "Date, time, number of staff, requirements" },
      { step: 2, title: "Get Matched", desc: "See available staff with ratings, experience" },
      { step: 3, title: "Confirm & Pay", desc: "One-click booking, secure payment" },
    ],
    cta: { text: "Get started as a venue", href: "/signup/venue" },
    pdfLink: "/pitch/venue",
  },
  security: {
    color: "emerald",
    gradient: "from-emerald-600 to-emerald-500",
    icon: "🛡️",
    title: "For Security Personnel",
    subtitle: "Get More Shifts. Get Paid Faster. Work on Your Terms.",
    description: "Shield connects SIA-licensed security professionals directly with Birmingham venues. No middleman fees eating your pay. Set your own rates. Choose your own shifts.",
    problems: [
      "Agencies taking 30-40% of what venues pay for you",
      "Waiting weeks to get paid for shifts you've already worked",
      "Getting called at random times for shifts you don't want",
      "No control over where or when you work",
    ],
    solutions: [
      { icon: "💰", title: "Keep More Money", desc: "Venues pay you directly. Only 10% platform fee vs 30-40% agency cut" },
      { icon: "⚡", title: "Get Paid Fast", desc: "Instant payouts available. Money in your account within minutes" },
      { icon: "📅", title: "You Choose", desc: "Set your availability. Accept only shifts that work for you" },
      { icon: "⭐", title: "Build Your Rep", desc: "Good reviews = more bookings. Your reputation works for you" },
    ],
    howItWorks: [
      { step: 1, title: "Create Profile", desc: "Add your SIA license, experience, and set your hourly rate" },
      { step: 2, title: "Set Availability", desc: "Mark when you're free to work. Update anytime" },
      { step: 3, title: "Accept & Work", desc: "Get notified of shifts, accept ones you want, get paid" },
    ],
    earnings: {
      agency: { hourly: 12, shift: 96, monthly: 1920 },
      shield: { hourly: 16.20, shift: 129.60, monthly: 2592 },
      extra: 672,
    },
    cta: { text: "Join as security", href: "/signup/personnel" },
    pdfLink: "/pitch/security",
  },
  agency: {
    color: "blue",
    gradient: "from-blue-600 to-blue-500",
    icon: "👥",
    title: "For Security Agencies",
    subtitle: "We're Not Your Competition. We're Your Sales Team.",
    description: "Shield brings you extra bookings from venues you've never worked with — without any marketing spend. Keep your existing clients. Keep your staff. Just add extra revenue.",
    problems: [],
    solutions: [
      { icon: "📈", title: "Extra Revenue", desc: "New clients find you through Shield. Zero marketing cost." },
      { icon: "⚡", title: "Fast Payment", desc: "Get paid in 2-3 days, guaranteed. No more chasing invoices." },
      { icon: "🛠️", title: "Free Tools", desc: "Staff management, compliance tracking, analytics — free." },
    ],
    keepControl: [
      { title: "Your Existing Clients", desc: "Shield only brings new business" },
      { title: "Your Staff", desc: "They work for you, not us" },
      { title: "Your Rates", desc: "You set the price, we don't interfere" },
      { title: "Your Brand", desc: "Venues see your agency name" },
    ],
    howItWorks: [
      { step: 1, title: "Sign Up Free", desc: "Create your agency profile, add your staff" },
      { step: 2, title: "Get Matched", desc: "Venues post shifts, you get notified" },
      { step: 3, title: "Accept & Deliver", desc: "Send your staff, get paid fast" },
    ],
    revenue: { shifts: 10, avgValue: 120, monthly: 1080, yearly: 12960 },
    cta: { text: "Partner as an agency", href: "/signup/agency" },
    pdfLink: "/pitch/agency",
  },
};

const innovations = [
  {
    category: "Guest Experience",
    icon: "✨",
    items: [
      { icon: "⚡", title: "Fast-Track Digital Guest List", desc: "Guests upload ID before the event. Zero friction entry." },
      { icon: "🥂", title: "VIP Arrival Protocol", desc: "Automatic alerts when VIPs arrive. Seamless hospitality." },
      { icon: "🚫", title: "Networked Banned List", desc: "Shared blocklist between trusted local venues." },
    ],
  },
  {
    category: "Safety & Response",
    icon: "🛡️",
    items: [
      { icon: "🆘", title: "Digital Panic Button", desc: "QR codes for guests to silently alert security." },
      { icon: "📍", title: "Real-Time Security Heatmap", desc: "Track staff coverage vs crowd density." },
      { icon: "⚡", title: "Flash Teams", desc: "Request extra guards ASAP for unexpected crowds." },
    ],
  },
  {
    category: "Smart Operations",
    icon: "🔧",
    items: [
      { icon: "🔊", title: "Noise Monitoring", desc: "Alerts if volume exceeds license limits." },
      { icon: "🔢", title: "Smart Capacity Counters", desc: "Digital clicker synced across all door staff." },
      { icon: "💬", title: "Promoter Liaison", desc: "Dedicated channel for promoter requests." },
    ],
  },
];

export default function WhyShieldPage() {
  const [activeTab, setActiveTab] = useState<UserType>("venue");
  const data = benefits[activeTab];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-zinc-900 to-[#0a0a0f] border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-8 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Why <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Shield</span>?
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl">
            The first platform built specifically for the security industry. 
            One marketplace, three powerful experiences.
          </p>

          {/* Download PDFs CTA */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/pitch/venue" className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 px-4 py-2 rounded-lg text-sm hover:bg-teal-500/20 transition">
              <span>📄</span> Venue One-Pager
            </Link>
            <Link href="/pitch/security" className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-sm hover:bg-emerald-500/20 transition">
              <span>📄</span> Security One-Pager
            </Link>
            <Link href="/pitch/agency" className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-lg text-sm hover:bg-blue-500/20 transition">
              <span>📄</span> Agency One-Pager
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 py-4">
            {(Object.keys(benefits) as UserType[]).map((key) => {
              const item = benefits[key];
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === key
                      ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden sm:inline">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">{data.subtitle}</h2>
            <p className="text-lg text-zinc-400">{data.description}</p>
          </div>

          {/* Problems Section */}
          {data.problems.length > 0 && (
            <div className="mb-12 bg-red-500/5 border border-red-500/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                <span>😤</span> Sound Familiar?
              </h3>
              <ul className="grid sm:grid-cols-2 gap-3">
                {data.problems.map((problem, i) => (
                  <li key={i} className="flex items-start gap-3 text-red-300/80">
                    <span className="text-red-500 mt-0.5">✗</span>
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Solutions Grid */}
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span>✨</span> How Shield Solves This
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.solutions.map((solution, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition">
                  <div className="text-2xl mb-3">{solution.icon}</div>
                  <h4 className="font-semibold text-white mb-1">{solution.title}</h4>
                  <p className="text-sm text-zinc-400">{solution.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings Comparison (Security Only) */}
          {activeTab === "security" && (
            <div className="mb-12">
              <h3 className="text-lg font-semibold text-white mb-6">💷 The Maths</h3>
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-400">Scenario</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-zinc-400">Agency</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-emerald-400">Shield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="px-4 py-3 text-sm text-zinc-400">Venue pays per hour</td>
                      <td className="px-4 py-3 text-center text-sm text-white">£18</td>
                      <td className="px-4 py-3 text-center text-sm text-emerald-400 font-medium">£18</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-zinc-400">You receive per hour</td>
                      <td className="px-4 py-3 text-center text-sm text-white">£12</td>
                      <td className="px-4 py-3 text-center text-sm text-emerald-400 font-medium">£16.20</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-zinc-400">8-hour shift earnings</td>
                      <td className="px-4 py-3 text-center text-sm text-white">£96</td>
                      <td className="px-4 py-3 text-center text-sm text-emerald-400 font-medium">£129.60</td>
                    </tr>
                    <tr className="bg-emerald-500/10">
                      <td className="px-4 py-3 text-sm font-semibold text-white">Monthly (20 shifts)</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-white">£1,920</td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-400">£2,592</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-center text-zinc-400">
                That's <span className="font-semibold text-emerald-400">£672 extra per month</span> in your pocket
              </p>
            </div>
          )}

          {/* Keep Control (Agency Only) */}
          {activeTab === "agency" && benefits.agency.keepControl && (
            <div className="mb-12">
              <h3 className="text-lg font-semibold text-white mb-6">✅ What You Keep Control Of</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.agency.keepControl.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                    <span className="text-green-500 text-xl">✓</span>
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="text-sm text-zinc-400">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Calculator (Agency Only) */}
          {activeTab === "agency" && benefits.agency.revenue && (
            <div className="mb-12 bg-gradient-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-white mb-4">💰 Potential Extra Revenue</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-white">{benefits.agency.revenue.shifts}</div>
                  <div className="text-sm text-blue-300">Extra shifts/mo</div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-2xl text-zinc-500">×</span>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">£{benefits.agency.revenue.avgValue}</div>
                  <div className="text-sm text-blue-300">Avg shift value</div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-2xl text-zinc-500">=</span>
                </div>
              </div>
              <div className="mt-6 text-center border-t border-blue-500/20 pt-6">
                <div className="text-4xl font-bold text-white">£{benefits.agency.revenue.monthly.toLocaleString()}/month</div>
                <div className="text-blue-300">Extra revenue (you keep 90%)</div>
                <div className="mt-2 text-sm text-blue-400">That's £{benefits.agency.revenue.yearly.toLocaleString()}/year with zero marketing spend</div>
              </div>
            </div>
          )}

          {/* How It Works */}
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-white mb-6">How It Works</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {data.howItWorks.map((step, i) => (
                <div key={i} className="text-center bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className={`w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br ${data.gradient} flex items-center justify-center text-white font-bold`}>
                    {step.step}
                  </div>
                  <h4 className="font-semibold text-white mb-2">{step.title}</h4>
                  <p className="text-sm text-zinc-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center py-8 border-t border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">Ready to Get Started?</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={data.cta.href}
                className={`bg-gradient-to-r ${data.gradient} text-white px-8 py-3 rounded-xl font-medium hover:opacity-90 transition`}
              >
                {data.cta.text}
              </Link>
              <Link
                href={data.pdfLink}
                className="bg-white/10 border border-white/20 text-white px-8 py-3 rounded-xl font-medium hover:bg-white/20 transition"
              >
                📄 Download PDF
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Future Innovations Section */}
      <div className="border-t border-white/5 bg-gradient-to-b from-[#0a0a0f] to-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-12">
            <span className="inline-block bg-purple-500/10 border border-purple-500/30 text-purple-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              🚀 Coming Soon
            </span>
            <h2 className="text-3xl font-bold text-white mb-4">
              Innovation Roadmap
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              We're building features that go beyond booking — tools that make parties safer 
              and operations smoother.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {innovations.map((category, i) => (
              <div key={i}>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>{category.icon}</span>
                  {category.category}
                </h3>
                <div className="space-y-3">
                  {category.items.map((item, j) => (
                    <div key={j} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-purple-500/30 transition">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <h4 className="font-medium text-white text-sm">{item.title}</h4>
                          <p className="text-xs text-zinc-400 mt-1">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Join the Future of Security Staffing
          </h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            Whether you're a venue, security professional, or agency — Shield has the tools you need.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup/venue" className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-xl font-medium transition">
              🏢 I'm a Venue
            </Link>
            <Link href="/signup/personnel" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition">
              🛡️ I'm Security
            </Link>
            <Link href="/signup/agency" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition">
              👥 I'm an Agency
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
