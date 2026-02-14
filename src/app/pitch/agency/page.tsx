"use client";

import { useEffect } from "react";

export default function AgencyPitchPage() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("print=true")) {
      setTimeout(() => window.print(), 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        @page { margin: 0.5in; size: A4; }
      `}</style>

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-8 print:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold print:text-2xl">Shield</h1>
              <p className="text-blue-100 mt-1">Agency Partnership Program</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">Birmingham, UK</p>
              <p className="text-sm text-blue-100">partners@shieldapp.co.uk</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-8 print:p-6">
        {/* Hero Statement */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">
            We're Not Your Competition. We're Your Sales Team.
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed print:text-base">
            Shield brings you extra bookings from venues you've never worked with — without any marketing spend. 
            Keep your existing clients. Keep your staff. Just add extra revenue.
          </p>
        </section>

        {/* The Value Prop */}
        <section className="mb-10 bg-blue-50 rounded-xl p-6 border border-blue-100 print:bg-blue-50">
          <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <span className="text-xl">💡</span> Why Partner with Shield?
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">📈</div>
              <h4 className="font-semibold text-gray-900">Extra Revenue</h4>
              <p className="text-sm text-gray-600">New clients find you through Shield. Zero marketing cost.</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold text-gray-900">Fast Payment</h4>
              <p className="text-sm text-gray-600">Get paid in 2-3 days, guaranteed. No more chasing invoices.</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">🛠️</div>
              <h4 className="font-semibold text-gray-900">Free Tools</h4>
              <p className="text-sm text-gray-600">Staff management, compliance tracking, analytics — free.</p>
            </div>
          </div>
        </section>

        {/* What You Keep */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ What You Keep Control Of</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <span className="text-green-500 text-xl">✓</span>
              <div>
                <span className="font-medium text-gray-900">Your Existing Clients</span>
                <p className="text-sm text-gray-600">Shield only brings new business</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <span className="text-green-500 text-xl">✓</span>
              <div>
                <span className="font-medium text-gray-900">Your Staff</span>
                <p className="text-sm text-gray-600">They work for you, not us</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <span className="text-green-500 text-xl">✓</span>
              <div>
                <span className="font-medium text-gray-900">Your Rates</span>
                <p className="text-sm text-gray-600">You set the price, we don't interfere</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <span className="text-green-500 text-xl">✓</span>
              <div>
                <span className="font-medium text-gray-900">Your Brand</span>
                <p className="text-sm text-gray-600">Venues see your agency name</p>
              </div>
            </div>
          </div>
        </section>

        {/* Revenue Calculator */}
        <section className="mb-10 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">💰 Potential Extra Revenue</h3>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold">10</div>
                <div className="text-sm text-blue-100">Extra shifts/month</div>
              </div>
              <div>
                <div className="text-3xl font-bold">×</div>
              </div>
              <div>
                <div className="text-3xl font-bold">£120</div>
                <div className="text-sm text-blue-100">Avg shift value</div>
              </div>
              <div>
                <div className="text-3xl font-bold">=</div>
              </div>
            </div>
            <div className="mt-4 text-center border-t border-white/20 pt-4">
              <div className="text-4xl font-bold">£1,080/month</div>
              <div className="text-blue-100">Extra revenue (you keep 90%)</div>
              <div className="mt-2 text-sm text-blue-200">That's £12,960/year with zero marketing spend</div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">1</div>
              <h4 className="font-semibold mb-1">Sign Up Free</h4>
              <p className="text-sm text-gray-600">Create your agency profile, add your staff</p>
            </div>
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">2</div>
              <h4 className="font-semibold mb-1">Get Matched</h4>
              <p className="text-sm text-gray-600">Venues post shifts, you get notified</p>
            </div>
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">3</div>
              <h4 className="font-semibold mb-1">Accept & Deliver</h4>
              <p className="text-sm text-gray-600">Send your staff, get paid fast</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-10 bg-gray-50 rounded-xl p-6 print:bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Simple Pricing</h3>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-4xl font-bold text-blue-600">£0</div>
              <p className="text-sm text-gray-500">to join</p>
            </div>
            <div className="text-gray-300 text-3xl">+</div>
            <div>
              <div className="text-4xl font-bold text-blue-600">10%</div>
              <p className="text-sm text-gray-500">of Shield bookings only</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            <strong>Important:</strong> We only take a cut of bookings that come through Shield. 
            Your existing clients = 0% fee. Your direct relationships stay 100% yours.
          </p>
        </section>

        {/* Bonus Features */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎁 Free Tools Included</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span>Staff management dashboard</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span>Compliance & document tracking</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span>SIA license expiry alerts</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span>Revenue analytics</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span>Instant Fill (backup staff access)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-500">✓</span>
              <span>Staff performance reports</span>
            </div>
          </div>
        </section>

        {/* Early Partner Offer */}
        <section className="mb-10 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2">🚀 Founding Partner Benefits</h3>
          <p className="mb-4">Join in our launch month and get:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span>✓</span> First 10 bookings at 5% fee (half price)
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> "Founding Partner" badge on your profile
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Direct line to our team
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Input on features we build next
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center py-8 border-t border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Grow Your Agency?</h3>
          <p className="text-gray-600 mb-4">Free to join. 5 minutes to set up.</p>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-blue-600">shieldapp.co.uk/signup/agency</p>
            <p className="text-gray-500">or call us: 0121 XXX XXXX</p>
          </div>
        </section>

        {/* Contact */}
        <section className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
          <p>Questions about partnership?</p>
          <p className="font-medium">partners@shieldapp.co.uk</p>
        </section>
      </main>

      {/* Print Button */}
      <div className="no-print fixed bottom-6 right-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-blue-700 transition font-medium"
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
