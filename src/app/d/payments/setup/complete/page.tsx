"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PaymentSetupComplete() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "incomplete">("loading");

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/stripe/connect");
      const data = await res.json();
      
      if (data.onboarding_complete) {
        setStatus("success");
        // Auto-redirect after 3 seconds
        setTimeout(() => router.push("/d/payments"), 3000);
      } else {
        setStatus("incomplete");
      }
    } catch (err) {
      setStatus("incomplete");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shield-500" />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Payment Setup Complete!</h1>
          <p className="text-zinc-400 mb-6">
            Your bank account is now connected. You can start receiving payments from bookings.
          </p>
          <Link
            href="/d/payments"
            className="inline-block bg-shield-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-shield-600 transition"
          >
            Go to Payments Dashboard
          </Link>
          <p className="text-xs text-zinc-500 mt-4">
            Redirecting automatically in 3 seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-semibold text-white mb-2">Setup Incomplete</h1>
        <p className="text-zinc-400 mb-6">
          Your payment account setup is not yet complete. Please finish connecting your bank details to receive payments.
        </p>
        <Link
          href="/d/payments"
          className="inline-block bg-shield-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-shield-600 transition"
        >
          Continue Setup
        </Link>
      </div>
    </div>
  );
}
