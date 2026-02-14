"use client";

import { useEffect } from "react";

export default function VenuePitchPage() {
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
      <header className="bg-gradient-to-r from-teal-600 to-teal-500 text-white p-8 print:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold print:text-2xl">Shield</h1>
              <p className="text-teal-100 mt-1">Security Staffing Platform</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-teal-100">Birmingham, UK</p>
              <p className="text-sm text-teal-100">contact@shieldapp.co.uk</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-8 print:p-6">
        {/* Hero Statement */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl">
            Find Verified Security Staff in Minutes, Not Days
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed print:text-base">
            Shield connects your venue with SIA-licensed security professionals instantly. 
            No more phone tag with agencies, no more last-minute scrambles.
          </p>
        </section>

        {/* The Problem */}
        <section className="mb-10 bg-red-50 rounded-xl p-6 border border-red-100 print:bg-red-50">
          <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
            <span className="text-xl">😤</span> Sound Familiar?
          </h3>
          <ul className="space-y-2 text-red-700">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>Door staff calls in sick 2 hours before doors open</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>Spending hours calling agencies to fill weekend shifts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>No idea if the staff showing up are actually SIA licensed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>Agency markup makes security your biggest cost</span>
            </li>
          </ul>
        </section>

        {/* The Solution */}
        <section className="mb-10 bg-teal-50 rounded-xl p-6 border border-teal-100 print:bg-teal-50">
          <h3 className="text-lg font-semibold text-teal-800 mb-3 flex items-center gap-2">
            <span className="text-xl">✨</span> How Shield Solves This
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-semibold text-gray-900">Instant Booking</h4>
              <p className="text-sm text-gray-600">Post a shift, get matched with available staff in minutes</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">✅</div>
              <h4 className="font-semibold text-gray-900">Verified Staff</h4>
              <p className="text-sm text-gray-600">Every professional has verified SIA license on file</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">💰</div>
              <h4 className="font-semibold text-gray-900">Transparent Pricing</h4>
              <p className="text-sm text-gray-600">See rates upfront. 10% platform fee only when you book</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">⭐</div>
              <h4 className="font-semibold text-gray-900">Reviews & Ratings</h4>
              <p className="text-sm text-gray-600">Book with confidence based on real venue feedback</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">1</div>
              <h4 className="font-semibold mb-1">Post Your Shift</h4>
              <p className="text-sm text-gray-600">Date, time, number of staff, requirements</p>
            </div>
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">2</div>
              <h4 className="font-semibold mb-1">Get Matched</h4>
              <p className="text-sm text-gray-600">See available staff with ratings, experience</p>
            </div>
            <div className="flex-1 text-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">3</div>
              <h4 className="font-semibold mb-1">Confirm & Pay</h4>
              <p className="text-sm text-gray-600">One-click booking, secure payment</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-10 bg-gray-50 rounded-xl p-6 print:bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Simple Pricing</h3>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-4xl font-bold text-teal-600">£0</div>
              <p className="text-sm text-gray-500">to sign up</p>
            </div>
            <div className="text-gray-300 text-3xl">+</div>
            <div>
              <div className="text-4xl font-bold text-teal-600">10%</div>
              <p className="text-sm text-gray-500">per booking</p>
            </div>
            <div className="text-gray-300 text-3xl">=</div>
            <div>
              <div className="text-lg font-semibold text-gray-900">Only pay when you book</div>
              <p className="text-sm text-gray-500">No monthly fees, no contracts</p>
            </div>
          </div>
        </section>

        {/* Early Adopter Offer */}
        <section className="mb-10 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2">🎁 Early Adopter Offer</h3>
          <p className="mb-4">Sign up this month and get:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span>✓</span> First 3 bookings with 0% platform fee
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Priority support during launch
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Input on features we build next
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center py-8 border-t border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Try Shield?</h3>
          <p className="text-gray-600 mb-4">5-minute signup. No commitment.</p>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-teal-600">shieldapp.co.uk/signup/venue</p>
            <p className="text-gray-500">or scan the QR code below</p>
          </div>
        </section>

        {/* Contact */}
        <section className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
          <p>Questions? Contact us:</p>
          <p className="font-medium">contact@shieldapp.co.uk | 0121 XXX XXXX</p>
        </section>
      </main>

      {/* Print Button (hidden in print) */}
      <div className="no-print fixed bottom-6 right-6 flex gap-3">
        <button
          onClick={() => window.print()}
          className="bg-teal-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-teal-700 transition font-medium"
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
