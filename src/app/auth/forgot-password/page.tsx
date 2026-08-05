"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { AuthBrandLink } from "@/components/brand/ShieldLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 bg-gradient-to-br from-[#080a0f] via-[#0d1117] to-[#080a0f] relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#00d4aa]/10 blur-[120px]" />
        <motion.div className="relative z-10" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <AuthBrandLink size="md" className="mb-16" />
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight">Reset your password</h1>
          <p className="mt-4 text-lg text-zinc-400 max-w-sm">We&apos;ll send you a link to set a new password.</p>
        </motion.div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 bg-[#080a0f]">
        <div className="w-full max-w-md mx-auto">
          <AuthBrandLink size="sm" className="lg:hidden mb-10" />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">Forgot password?</h2>
            <p className="mt-2 text-zinc-400">Enter your email and we&apos;ll send a reset link.</p>
            {sent ? (
              <div className="mt-8 rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-4 text-sm text-[#5eead4]">
                Check your email for a link to reset your password. If you don&apos;t see it, check spam.
              </div>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
                )}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white placeholder-zinc-500 transition focus:border-[#00d4aa]/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#00d4aa] py-4 font-semibold text-[#0c0d10] transition hover:bg-[#00e5b8] hover:shadow-[0_0_30px_rgba(0,212,170,0.4)] focus:outline-none focus:ring-2 focus:ring-[#00d4aa] focus:ring-offset-2 focus:ring-offset-[#080a0f] disabled:opacity-60 disabled:pointer-events-none"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )}
            <p className="mt-8 text-center text-sm text-zinc-500">
              <Link href="/login" className="text-[#00d4aa] font-medium hover:text-[#5eead4] transition">Back to log in</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
