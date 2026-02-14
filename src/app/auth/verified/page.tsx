"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FadeIn, FloatingOrb, motion } from "@/components/ui/motion";

export default function EmailVerified() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(redirect);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [redirect, router]);

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
            {/* Success Icon */}
            <motion.div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              >
                <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            </motion.div>

            <h1 className="font-display text-2xl font-semibold text-white">Email Verified!</h1>
            
            <p className="mt-4 text-zinc-400">
              Your account has been verified successfully. Welcome to Shield!
            </p>

            <motion.div
              className="mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-sm text-zinc-500">
                Redirecting to your dashboard in {countdown}...
              </p>
              
              <motion.button
                onClick={() => router.push(redirect)}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-shield-500 to-shield-600 px-4 py-3 font-semibold text-white transition hover:from-shield-600 hover:to-shield-700"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Go to Dashboard Now
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </FadeIn>
    </div>
  );
}
