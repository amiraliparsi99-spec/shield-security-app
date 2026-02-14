"use client";

import { useEffect } from "react";

export default function SecurityPitchPage() {
  useEffect(() => {
    // Auto-trigger print dialog for PDF generation
    if (typeof window !== "undefined" && window.location.search.includes("print=true")) {
      setTimeout(() => window.print(), 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      {/* Print-optimized styles */}
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        @page { margin: 0.5in; size: A4; }
      `}</style>

      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-8 print:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold print:text-2xl">Shield</h1>
              <p className="text-emerald-100 mt-1">For Security Professionals</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-emerald-100">Birmingham, UK</p>
              <p className="text-sm text-emerald-100">join@shieldapp.co.uk</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-8 print:p-6">
        {/* Hero Statement */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">
            Get More Shifts. Get Paid Faster. Work on Your Terms.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed print:text-base">
            Shield connects SIA-licensed security professionals directly with Birmingham venues. 
            No middleman fees eating your pay. Set your own rates. Choose your own shifts.
          </p>
        </section>

        {/* The Problem */}
        <section className="mb-10 bg-red-50 rounded-xl p-6 border border-red-100 print:bg-red-50">
          <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
            <span className="text-xl">😤</span> Tired Of This?
          </h3>
          <ul className="space-y-2 text-red-700">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>Agencies taking 30-40% of what venues pay for you</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>Waiting weeks to get paid for shifts you've already worked</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>Getting called at random times for shifts you don't want</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>No control over where or when you work</span>
            </li>
          </ul>
        </section>

        {/* The Solution */}
        <section className="mb-10 bg-emerald-50 rounded-xl p-6 border border-emerald-100 print:bg-emerald-50">
          <h3 className="text-lg font-semibold text-emerald-800 mb-3 flex items-center gap-2">
            <span className="text-xl">✨</span> How Shield Is Different
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">💰</div>
              <h4 className="font-semibold text-gray-900">Keep More Money</h4>
              <p className="text-sm text-gray-600">Venues pay you directly. Only 10% platform fee vs 30-40% agency cut</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold text-gray-900">Get Paid Fast</h4>
              <p className="text-sm text-gray-600">Instant payouts available. Money in your account within minutes</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">📅</div>
              <h4 className="font-semibold text-gray-900">You Choose</h4>
              <p className="text-sm text-gray-600">Set your availability. Accept only shifts that work for you</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">⭐</div>
              <h4 className="font-semibold text-gray-900">Build Your Rep</h4>
              <p className="text-sm text-gray-600">Good reviews = more bookings. Your reputation works for you</p>
            </div>
          </div>
        </section>

        {/* Earnings Comparison */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💷 The Maths</h3>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Scenario</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Agency</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-emerald-600">Shield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">Venue pays per hour</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900">£18</td>
                  <td className="px-4 py-3 text-center text-sm text-emerald-600 font-medium">£18</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">You receive per hour</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900">£12</td>
                  <td className="px-4 py-3 text-center text-sm text-emerald-600 font-medium">£16.20</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600">8-hour shift earnings</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900">£96</td>
                  <td className="px-4 py-3 text-center text-sm text-emerald-600 font-medium">£129.60</td>
                </tr>
                <tr className="bg-emerald-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Monthly (20 shifts)</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">£1,920</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-600">£2,592</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gray-500 text-center">
            That's <span className="font-semibold text-emerald-600">£672 extra per month</span> in your pocket
          </p>
        </section>

        {/* How It Works */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">1</div>
              <h4 className="font-semibold mb-1">Create Profile</h4>
              <p className="text-sm text-gray-600">Add your SIA license, experience, and set your hourly rate</p>
            </div>
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">2</div>
              <h4 className="font-semibold mb-1">Set Availability</h4>
              <p className="text-sm text-gray-600">Mark when you're free to work. Update anytime</p>
            </div>
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">3</div>
              <h4 className="font-semibold mb-1">Accept & Work</h4>
              <p className="text-sm text-gray-600">Get notified of shifts, accept ones you want, get paid</p>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="mb-10 bg-gray-50 rounded-xl p-6 print:bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ What You Need</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-emerald-500 text-lg">✓</span>
              <span className="text-gray-700">Valid SIA Door Supervisor or Security Guard license</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-500 text-lg">✓</span>
              <span className="text-gray-700">Right to work in the UK</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-500 text-lg">✓</span>
              <span className="text-gray-700">Smartphone with the Shield app</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-500 text-lg">✓</span>
              <span className="text-gray-700">Bank account for payments</span>
            </div>
          </div>
        </section>

        {/* Early Adopter Offer */}
        <section className="mb-10 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2">🎁 Early Adopter Bonus</h3>
          <p className="mb-4">Join Shield this month and get:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span>✓</span> First 5 shifts with 0% platform fee (you keep 100%)
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Priority listing in venue searches
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Direct line to support team
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center py-8 border-t border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Earn More?</h3>
          <p className="text-gray-600 mb-4">Free to join. Takes 5 minutes.</p>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-emerald-600">shieldapp.co.uk/signup/personnel</p>
            <p className="text-gray-500">or download the Shield app</p>
          </div>
        </section>

        {/* Contact */}
        <section className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
          <p>Questions? Contact us:</p>
          <p className="font-medium">join@shieldapp.co.uk | 0121 XXX XXXX</p>
        </section>
      </main>

      {/* Print Button (hidden in print) */}
      <div className="no-print fixed bottom-6 right-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-emerald-700 transition font-medium"
        >
          📄 Download PDF
        </button>
        <a
          href="/why-shield"
          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg shadow-lg hover:bg-gray-200 transition font-medium"
        >
          Why Shield
        </a>
        <a
          href="/"
          className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg shadow-lg hover:bg-gray-300 transition font-medium"
        >
          ← Home
        </a>
      </div>
    </div>
  );
}
