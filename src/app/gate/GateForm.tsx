"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldLogo } from "@/components/brand/ShieldLogo";

function GateFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong");
        setLoading(false);
        return;
      }
      const safePath =
        returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
      router.push(safePath);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-8 sm:p-10 max-w-md w-full">
      <div className="flex items-center gap-3 mb-6">
        <ShieldLogo size="md" />
        <div>
          <p className="text-sm text-zinc-400">Private preview · Coming soon</p>
        </div>
      </div>

      <p className="text-zinc-300 text-sm mb-6 leading-relaxed">
        This site isn&apos;t public yet. Enter the access password to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="gate-password" className="block text-sm font-medium text-zinc-300 mb-1.5">
            Access password
          </label>
          <input
            id="gate-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-shield-500 focus:outline-none focus:ring-1 focus:ring-shield-500 transition"
            placeholder="Enter password"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-shield-500 to-shield-600 px-4 py-3.5 font-semibold text-white transition hover:from-shield-600 hover:to-shield-700 focus:outline-none focus:ring-2 focus:ring-shield-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Need help?{" "}
        <a href="mailto:hello@shieldsecurity.app" className="text-shield-400 hover:text-shield-300">
          Contact us
        </a>
      </p>
    </div>
  );
}

function GateSkeleton() {
  return (
    <div className="glass rounded-2xl p-8 sm:p-10 max-w-md w-full animate-pulse">
      <div className="h-12 w-12 rounded-xl bg-white/10 mb-6" />
      <div className="h-4 w-full bg-white/10 rounded mb-4" />
      <div className="h-10 w-full bg-white/10 rounded" />
    </div>
  );
}

export default function GateForm() {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <GateFormInner />
    </Suspense>
  );
}
