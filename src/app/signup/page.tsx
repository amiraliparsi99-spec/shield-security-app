"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { AuthBrandLink } from "@/components/brand/ShieldLogo";
import { trackPageView, trackSignupStarted } from "@/lib/analytics";

const roles = [
  { id: "venue", label: "Venue", description: "Find security for your events", icon: "🏢", color: "from-violet-500 to-purple-600", href: "/signup/venue", comingSoon: false },
  { id: "personnel", label: "Security Professional", description: "Get booked for shifts", icon: "🛡️", color: "from-emerald-500 to-teal-600", href: "/signup/personnel", comingSoon: false },
  { id: "agency", label: "Security Agency", description: "Manage your team and bookings", icon: "🏛️", color: "from-blue-500 to-indigo-600", href: "/signup/agency", comingSoon: true },
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
    <div className="flex min-h-screen">
      {/* Left: Branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 bg-gradient-to-br from-[#080a0f] via-[#0d1117] to-[#080a0f] relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#00d4aa]/10 blur-[120px]" />
        <motion.div className="relative z-10" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <AuthBrandLink size="md" className="mb-16" />
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight">Join Shield HQ</h1>
          <p className="mt-4 text-lg text-zinc-400 max-w-sm">
            Create an account and get started—whether you run a venue or work in security.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-sm">Venues & security</span>
            <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-sm">Verified staff</span>
          </div>
        </motion.div>
      </div>

      {/* Right: Role selection */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 bg-[#080a0f]">
        <div className="w-full max-w-md mx-auto">
          <AuthBrandLink size="sm" className="lg:hidden mb-10" />

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">Create an account</h2>
            <p className="mt-2 text-zinc-400">Choose your role to get started.</p>

            <div className="mt-8 space-y-4">
              {roles.map((role, i) => (
                <motion.button
                  key={role.id}
                  type="button"
                  onClick={() => !role.comingSoon && handleRoleSelect(role)}
                  disabled={role.comingSoon}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`w-full rounded-2xl border p-5 text-left flex items-center gap-4 transition focus:outline-none ${
                    role.comingSoon
                      ? "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed"
                      : "border-white/10 bg-white/[0.06] hover:border-[#00d4aa]/30 hover:bg-white/[0.08] focus:ring-2 focus:ring-[#00d4aa]/30 focus:ring-offset-2 focus:ring-offset-[#080a0f]"
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${role.color} text-2xl flex-shrink-0 ${role.comingSoon ? "grayscale" : ""}`}>
                    {role.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-base font-semibold text-white">{role.label}</span>
                    <span className="mt-0.5 block text-sm text-zinc-400">
                      {role.comingSoon ? "Coming Soon" : role.description}
                    </span>
                  </div>
                  {role.comingSoon ? (
                    <span className="flex-shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-zinc-400">Soon</span>
                  ) : (
                    <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </motion.button>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="text-[#00d4aa] font-medium hover:text-[#5eead4] transition">Log in</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
