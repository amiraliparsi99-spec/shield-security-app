"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getRoleDashboardPath, getRoleLabel } from "@/lib/auth";

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

  // Only treat as "signed in dashboard user" when an auth session exists.
  // This avoids showing "Your Venue" from stale guest-role localStorage.
  const hasRole = !!user && !!role;
  const dashboardPath = role ? getRoleDashboardPath(role) : "/dashboard";
  const dashboardLabel = role ? `Your ${getRoleLabel(role)}` : "Your dashboard";

  return (
    <nav
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
        <Link href="/" className="group flex items-center gap-2" prefetch={false}>
          <span
            className={`font-display font-bold tracking-tight text-white transition-colors group-hover:text-shield-400 ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            Shield HQ
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1dd8c6] to-[#109e9a] shadow-[0_8px_20px_rgba(0,212,170,0.35)] ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-105">
            <svg
              className="h-[18px] w-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#ffffff"
              strokeWidth={2.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden md:flex items-center gap-0.5">
            <NavLink href="/how-it-works">How it works</NavLink>
            <NavLink href="/why-shield">Why Shield HQ</NavLink>
            <NavLink href="/blog">Shield Weekly</NavLink>
            <NavLink href="/signup/venue">For Venues</NavLink>
            <NavLink href="/signup/personnel">For Security</NavLink>
          </div>

          <div className="hidden md:block w-px h-5 bg-white/10 mx-1" />

          {loading ? (
            <span className="px-3 py-2 text-sm text-zinc-500">…</span>
          ) : hasRole ? (
            <div className="flex items-center gap-1 sm:gap-2">
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
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <NavLink href="/login">Log in</NavLink>
              <Link href="/signup" prefetch={false}>
                <span className="inline-block rounded-xl bg-shield-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition-colors hover:bg-shield-600">
                  Sign up
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
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
      <span
        className={`inline-block rounded-lg px-3 py-2 text-sm transition ${
          highlight
            ? "font-medium text-shield-400 hover:bg-white/5 hover:text-shield-300"
            : "text-zinc-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        {children}
      </span>
    </Link>
  );
}
