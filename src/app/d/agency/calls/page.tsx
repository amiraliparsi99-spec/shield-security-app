"use client";

import { CallHistory } from "@/components/calling";
import Link from "next/link";

export default function AgencyCallsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/d/agency"
          className="text-zinc-400 hover:text-white text-sm inline-flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white">Call History</h1>
        <p className="text-zinc-400 mt-1">View your past calls with staff, venues, and personnel</p>
      </div>

      <div className="glass rounded-2xl p-6">
        <CallHistory />
      </div>
    </div>
  );
}
