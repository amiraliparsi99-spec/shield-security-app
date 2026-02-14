"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FadeIn, FloatingOrb, motion } from "@/components/ui/motion";

const errorMessages: Record<string, { title: string; description: string }> = {
  verification_failed: {
    title: "Verification Failed",
    description: "The verification link is invalid or has expired. Please try signing up again or request a new verification email.",
  },
  access_denied: {
    title: "Access Denied",
    description: "You don't have permission to access this resource.",
  },
  default: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again.",
  },
};

export default function AuthError() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "default";
  const error = errorMessages[message] || errorMessages.default;

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
            {/* Error Icon */}
            <motion.div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 text-5xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              ⚠️
            </motion.div>

            <h1 className="font-display text-2xl font-semibold text-white">{error.title}</h1>
            
            <p className="mt-4 text-zinc-400">
              {error.description}
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/signup"
                className="w-full rounded-lg bg-gradient-to-r from-shield-500 to-shield-600 px-4 py-3 font-semibold text-white transition hover:from-shield-600 hover:to-shield-700 text-center"
              >
                Try Again
              </Link>
              
              <Link
                href="/login"
                className="text-sm text-zinc-400 hover:text-white transition"
              >
                Already have an account? <span className="text-shield-500">Log in</span>
              </Link>
              
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-zinc-300 transition"
              >
                ← Back to home
              </Link>
            </div>
          </motion.div>
        </div>
      </FadeIn>
    </div>
  );
}
