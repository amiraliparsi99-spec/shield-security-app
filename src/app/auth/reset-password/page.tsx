"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { AuthBrandLink } from "@/components/brand/ShieldLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionReady(!!session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      if (updateError.message.includes("same")) {
        setError("New password must be different from your current password.");
      } else {
        setError(updateError.message);
      }
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00d4aa] border-t-transparent" />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0f] px-4">
        <div className="w-full max-w-md text-center">
          <div className="glass rounded-2xl p-8">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="font-display text-xl font-semibold text-white">Invalid or expired link</h1>
            <p className="mt-3 text-sm text-zinc-400">
              This password reset link has expired or is invalid. Please request a new one.
            </p>
            <Link
              href="/auth/forgot-password"
              className="mt-6 inline-block rounded-2xl bg-[#00d4aa] px-6 py-3 font-semibold text-[#0c0d10] transition hover:bg-[#00e5b8]"
            >
              Request new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 bg-gradient-to-br from-[#080a0f] via-[#0d1117] to-[#080a0f] relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#00d4aa]/10 blur-[120px]" />
        <motion.div className="relative z-10" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <AuthBrandLink size="md" className="mb-16" />
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight">
            Set a new password
          </h1>
          <p className="mt-4 text-lg text-zinc-400 max-w-sm">
            Choose a strong password to keep your account secure.
          </p>
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 bg-[#080a0f]">
        <div className="w-full max-w-md mx-auto">
          <AuthBrandLink size="sm" className="lg:hidden mb-10" />

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">New password</h2>
            <p className="mt-2 text-zinc-400">Enter your new password below.</p>

            {success ? (
              <div className="mt-8">
                <div className="rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-4 text-sm text-[#5eead4]">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold">Password updated</span>
                  </div>
                  Redirecting you to log in...
                </div>
              </div>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-2">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white placeholder-zinc-500 transition focus:border-[#00d4aa]/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-400 mb-2">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white placeholder-zinc-500 transition focus:border-[#00d4aa]/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#00d4aa] py-4 font-semibold text-[#0c0d10] transition hover:bg-[#00e5b8] hover:shadow-[0_0_30px_rgba(0,212,170,0.4)] focus:outline-none focus:ring-2 focus:ring-[#00d4aa] focus:ring-offset-2 focus:ring-offset-[#080a0f] disabled:opacity-60 disabled:pointer-events-none"
                >
                  {loading ? "Updating..." : "Set new password"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
