"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { motion } from "framer-motion";
import { AuthBrandLink } from "@/components/brand/ShieldLogo";

export default function Login() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#080a0f] via-[#0d1117] to-[#080a0f] items-center justify-center p-12">
        <div className="h-12 w-48 rounded-xl bg-white/10 animate-pulse" />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="h-10 w-24 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-8 w-32 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-48 rounded bg-white/10 animate-pulse" />
          <div className="h-14 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-14 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-14 rounded-2xl bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) return;
    setResending(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowResend(false);
    setResent(false);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      const msg = signInError.message.toLowerCase();

      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setError("Your email has not been confirmed yet. Check your inbox for a verification link.");
        setShowResend(true);
      } else if (msg.includes("invalid login") || msg.includes("invalid email or password")) {
        setError("Invalid email or password.");
      } else if (msg.includes("rate") || msg.includes("too many")) {
        setError("Too many login attempts. Please wait a minute and try again.");
      } else if (msg.includes("disabled") || msg.includes("banned")) {
        setError("This account has been disabled. Please contact support.");
      } else {
        setError(signInError.message);
      }

      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const role = await getProfileRole(supabase, userId);
    if (role && ["venue", "personnel", "agency", "admin"].includes(role)) {
      localStorage.setItem("shield_guest_role", role);
      document.cookie = `shield_guest_role=${role}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }

    // Honour the redirect param from middleware, otherwise go to role dashboard
    if (redirectTo && redirectTo.startsWith("/")) {
      router.push(redirectTo);
    } else {
      const path = role ? getRoleDashboardPath(role) : "/dashboard";
      router.push(path);
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: Branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 bg-gradient-to-br from-[#080a0f] via-[#0d1117] to-[#080a0f] relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#00d4aa]/10 blur-[120px]" />
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AuthBrandLink size="md" className="mb-16" />
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight">
            Welcome back
          </h1>
          <p className="mt-4 text-lg text-zinc-400 max-w-sm">
            Sign in to manage your venue, shifts, and security team in one place.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-sm">Venues & security</span>
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-sm">Verified staff</span>
          </div>
        </motion.div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 bg-[#080a0f]">
        <div className="w-full max-w-md mx-auto">
          {/* Logo (mobile) */}
          <AuthBrandLink size="sm" className="lg:hidden mb-10" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">Log in</h2>
            <p className="mt-2 text-zinc-400">Use your Shield HQ account to continue.</p>

            {message === "confirm" && (
              <div className="mt-6 rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-3 text-sm text-[#5eead4]">
                Check your email to confirm your account, then log in.
              </div>
            )}

            {message === "password_updated" && (
              <div className="mt-6 rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-4 py-3 text-sm text-[#5eead4]">
                Your password has been updated. Log in with your new password.
              </div>
            )}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                  {showResend && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      {resent ? (
                        <span className="text-[#5eead4]">Verification email sent! Check your inbox.</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={resending}
                          className="text-[#00d4aa] hover:text-[#5eead4] font-medium transition disabled:opacity-50"
                        >
                          {resending ? "Sending..." : "Resend verification email"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">
                  Email
                </label>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-400">
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className="text-sm text-[#00d4aa] hover:text-[#5eead4] transition">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-white placeholder-zinc-500 transition focus:border-[#00d4aa]/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#00d4aa] py-4 font-semibold text-[#0c0d10] transition hover:bg-[#00e5b8] hover:shadow-[0_0_30px_rgba(0,212,170,0.4)] focus:outline-none focus:ring-2 focus:ring-[#00d4aa] focus:ring-offset-2 focus:ring-offset-[#080a0f] disabled:opacity-60 disabled:pointer-events-none"
              >
                {loading ? "Signing in…" : "Log in"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#00d4aa] font-medium hover:text-[#5eead4] transition">
                Sign up
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
