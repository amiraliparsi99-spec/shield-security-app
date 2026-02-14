"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FadeIn, FloatingOrb, motion } from "@/components/ui/motion";

export default function ConfirmEmail() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) return;
    
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) throw error;
      setResendSuccess(true);
    } catch (err: any) {
      setResendError(err.message || "Failed to resend email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={350} color="teal" className="absolute -left-20 top-20" delay={0} />
        <FloatingOrb size={250} color="cyan" className="absolute right-10 bottom-20" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>

      <FadeIn direction="up" delay={0.1}>
        <div className="w-full max-w-md text-center">
          <motion.div
            className="glass rounded-2xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {/* Email Icon */}
            <motion.div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-shield-500/20 to-shield-600/20 text-5xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              ✉️
            </motion.div>

            <h1 className="font-display text-2xl font-semibold text-white">Check your email</h1>
            
            <p className="mt-4 text-zinc-400">
              We've sent a verification link to
            </p>
            
            {email && (
              <p className="mt-2 font-medium text-white">{email}</p>
            )}

            <div className="mt-6 rounded-lg bg-zinc-800/50 border border-zinc-700 p-4">
              <p className="text-sm text-zinc-400">
                Click the link in the email to verify your account and get started. The link will expire in 24 hours.
              </p>
            </div>

            {/* Resend Section */}
            <div className="mt-8 pt-6 border-t border-zinc-700">
              <p className="text-sm text-zinc-500 mb-4">
                Didn't receive the email? Check your spam folder or
              </p>
              
              {resendSuccess && (
                <motion.p
                  className="text-sm text-emerald-400 mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  ✓ Verification email sent!
                </motion.p>
              )}

              {resendError && (
                <motion.p
                  className="text-sm text-red-400 mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {resendError}
                </motion.p>
              )}

              <motion.button
                onClick={handleResend}
                disabled={isResending || !email}
                className="text-shield-500 hover:text-shield-400 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isResending ? "Sending..." : "Resend verification email"}
              </motion.button>
            </div>

            {/* Alternative Actions */}
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/login"
                className="text-sm text-zinc-400 hover:text-white transition"
              >
                Already verified? <span className="text-shield-500">Log in</span>
              </Link>
              
              <Link
                href="/signup"
                className="text-sm text-zinc-500 hover:text-zinc-300 transition"
              >
                ← Back to sign up
              </Link>
            </div>
          </motion.div>

          {/* Help Text */}
          <FadeIn delay={0.5}>
            <p className="mt-8 text-center text-xs text-zinc-600">
              Having trouble? Contact{" "}
              <a href="mailto:support@shield.app" className="text-zinc-500 hover:text-zinc-400">
                support@shield.app
              </a>
            </p>
          </FadeIn>
        </div>
      </FadeIn>
    </div>
  );
}
