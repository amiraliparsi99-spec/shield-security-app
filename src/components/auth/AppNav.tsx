"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getRoleDashboardPath, getRoleLabel } from "@/lib/auth";
import { ThemeQuickToggle } from "@/components/settings/ThemeToggle";

type AppNavProps = {
  /** Slightly smaller nav for dashboard/detail pages */
  compact?: boolean;
};

export function AppNav({ compact }: AppNavProps) {
  const { user, role, loading, refetchRole } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position for glass effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleLogout() {
    if (user) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem("shield_guest_role");
      document.cookie = "shield_guest_role=; path=/; max-age=0";
      await refetchRole();
    }
    router.push("/");
    router.refresh();
  }

  const hasRole = !!role;
  const dashboardPath = role ? getRoleDashboardPath(role) : "/dashboard";
  const dashboardLabel = role ? `Your ${getRoleLabel(role)}` : "Your dashboard";

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className={
        compact
          ? "shrink-0 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl"
          : `fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
              scrolled
                ? "border-b border-white/[0.08] bg-ink-950/80 backdrop-blur-xl shadow-lg shadow-black/10"
                : "border-b border-transparent bg-transparent"
            }`
      }
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 ${
          compact ? "h-14" : "h-16"
        }`}
      >
        <Link href="/" className="group flex items-center gap-2">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-shield-500 to-shield-600 shadow-lg shadow-shield-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </motion.div>
          <span
            className={`font-display font-semibold tracking-tight text-white transition-colors group-hover:text-shield-400 ${
              compact ? "text-lg" : "text-xl"
            }`}
          >
            Shield
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/how-it-works">How it works</NavLink>

          {user && <NavLink href="/chat">Messages</NavLink>}
          
          {/* Theme toggle */}
          <ThemeQuickToggle />

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 text-sm text-zinc-500"
              >
                …
              </motion.span>
            ) : hasRole ? (
              <motion.div
                key="logged-in"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1 sm:gap-2"
              >
                {role === "admin" && (
                  <NavLink href="/admin" highlight>
                    Admin
                  </NavLink>
                )}
                {(role === "personnel" || role === "agency") && (
                  <NavLink href="/verification">Verification</NavLink>
                )}
                <NavLink href={dashboardPath} highlight>
                  {dashboardLabel}
                </NavLink>
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Log out
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="logged-out"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1 sm:gap-2"
              >
                <NavLink href="/login">Log in</NavLink>
                <Link href="/signup">
                  <motion.span
                    className="inline-block rounded-xl bg-shield-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition-colors hover:bg-shield-600"
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 0 25px rgba(20, 184, 166, 0.4)",
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign up
                  </motion.span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.nav>
  );
}

// NavLink component with hover animation
function NavLink({
  href,
  children,
  highlight = false,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <motion.span
        className={`inline-block rounded-lg px-3 py-2 text-sm transition ${
          highlight
            ? "font-medium text-shield-400 hover:bg-white/5 hover:text-shield-300"
            : "text-zinc-400 hover:bg-white/5 hover:text-white"
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {children}
      </motion.span>
    </Link>
  );
}
