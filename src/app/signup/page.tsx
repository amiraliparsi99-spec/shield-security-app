"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FadeIn, StaggerContainer, StaggerItem, FloatingOrb, motion } from "@/components/ui/motion";
import { trackPageView, trackSignupStarted } from "@/lib/analytics";

const roles = [
  { 
    id: "venue", 
    label: "Venue", 
    description: "Find security for your events",
    icon: "🏢",
    color: "from-purple-500 to-purple-600",
    href: "/signup/venue",
  },
  { 
    id: "personnel", 
    label: "Security Professional", 
    description: "Get booked for shifts",
    icon: "🛡️",
    color: "from-emerald-500 to-emerald-600",
    href: "/signup/personnel",
  },
  { 
    id: "agency", 
    label: "Security Agency", 
    description: "Manage your team and bookings",
    icon: "🏛️",
    color: "from-blue-500 to-blue-600",
    href: "/signup/agency",
  },
];

export default function SignUp() {
  const router = useRouter();

  useEffect(() => {
    trackPageView("signup_role_selection");
  }, []);

  const handleRoleSelect = (role: { id: string; href: string }) => {
    trackSignupStarted(role.id as "venue" | "personnel" | "agency");
    router.push(role.href);
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
            <h1 className="font-display text-2xl font-semibold text-white">Create an account</h1>
            <p className="mt-2 text-zinc-400">Choose your role to get started with Shield.</p>

            <StaggerContainer className="mt-8 grid gap-4" staggerDelay={0.1}>
              {roles.map((role) => (
                <StaggerItem key={role.id}>
                  <motion.button
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className="w-full glass rounded-xl p-5 text-left transition-all flex items-center gap-4"
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 0 30px rgba(20, 184, 166, 0.2)",
                      borderColor: "rgba(20, 184, 166, 0.3)",
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${role.color} text-2xl flex-shrink-0`}>
                      {role.icon}
                    </div>
                    <div>
                      <span className="block text-base font-semibold text-white">{role.label}</span>
                      <span className="mt-0.5 block text-sm text-zinc-400">{role.description}</span>
                    </div>
                    <svg className="w-5 h-5 text-zinc-500 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </StaggerItem>
              ))}
            </StaggerContainer>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-shield-500 hover:text-shield-400 transition">
                Log in
              </Link>
            </p>
          </motion.div>

          <FadeIn delay={0.5}>
            <p className="mt-8 text-center text-sm text-zinc-500">
              <Link href="/" className="text-zinc-400 transition hover:text-white">
                ← Back to home
              </Link>
            </p>
          </FadeIn>
        </div>
      </FadeIn>
    </div>
  );
}
