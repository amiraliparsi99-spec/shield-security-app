"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { FadeIn, FloatingOrb, PulseButton, motion } from "@/components/ui/motion";

export default function Login() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
      </div>
      <div className="w-full max-w-md">
        <div className="glass animate-pulse rounded-2xl p-8">
          <div className="h-8 w-20 rounded bg-white/10" />
          <div className="mt-8 h-8 w-32 rounded bg-white/10" />
          <div className="mt-2 h-4 w-48 rounded bg-white/10" />
          <div className="mt-8 space-y-4">
            <div className="h-12 rounded-xl bg-white/10" />
            <div className="h-12 rounded-xl bg-white/10" />
            <div className="h-12 rounded-xl bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Invalid email or password.");
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
    const path = role ? getRoleDashboardPath(role) : "/dashboard";
    router.push(path);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={350} color="teal" className="absolute -right-20 top-10" delay={0} />
        <FloatingOrb size={250} color="cyan" className="absolute left-10 bottom-32" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <FadeIn direction="up" delay={0.1}>
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2">
            <motion.div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-shield-500 to-shield-600 shadow-lg shadow-shield-500/20"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </motion.div>
            <span className="font-display text-xl font-semibold text-white">Shield</span>
          </Link>

          <motion.div
            className="mt-8 glass rounded-2xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="font-display text-2xl font-semibold text-white">Log in</h1>
            <p className="mt-2 text-zinc-400">Use your Shield account to continue.</p>

            {message === "confirm" && (
              <motion.div
                className="mt-6 rounded-xl border border-shield-500/30 bg-shield-500/10 px-4 py-3 text-sm text-shield-200"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Check your email to confirm your account, then log in.
              </motion.div>
            )}

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <motion.div
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder-zinc-500 transition focus:border-shield-500/40 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-shield-500/30"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder-zinc-500 transition focus:border-shield-500/40 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-shield-500/30"
                />
              </div>
              <PulseButton
                type="submit"
                disabled={loading}
                variant="primary"
                className="w-full py-3.5 disabled:opacity-70 disabled:pointer-events-none"
              >
                {loading ? "Signing in…" : "Log in"}
              </PulseButton>
            </form>
          </motion.div>

          <FadeIn delay={0.5}>
            <p className="mt-6 text-center text-sm text-zinc-500">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-shield-400 transition hover:text-shield-300 hover:underline">
                Sign up
              </Link>
            </p>
          </FadeIn>
        </div>
      </FadeIn>
    </div>
  );
}
