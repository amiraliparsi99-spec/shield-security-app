"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getRoleDashboardPath, getRoleLabel } from "@/lib/auth";
import { NotificationsBell } from "@/components/nav/NotificationsBell";
import { HelpMenu } from "@/components/nav/HelpMenu";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { ShieldLogo } from "@/components/brand/ShieldLogo";

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
        <Link
          href={hasRole ? dashboardPath : "/"}
          className="group inline-flex items-center transition-opacity hover:opacity-90"
          prefetch={false}
        >
          <ShieldLogo size={compact ? "sm" : "md"} priority />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {loading ? (
            <span className="px-3 py-2 text-sm text-zinc-500">…</span>
          ) : hasRole && role ? (
            /* Logged-in app shell: account-level tools, not marketing links.
               Operational navigation lives in each dashboard's sidebar. */
            <div className="flex items-center gap-1 sm:gap-1.5">
              {role === "venue" && (
                <>
                  <Link href="/d/venue/bookings/new" prefetch={false} className="hidden sm:block">
                    <span className="inline-block rounded-xl bg-shield-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition-colors hover:bg-shield-600">
                      Book Security
                    </span>
                  </Link>
                  <div className="hidden sm:block w-px h-5 bg-white/10 mx-1" />
                </>
              )}

              <NotificationsBell userId={user!.id} role={role} />
              <HelpMenu role={role} dashboardPath={dashboardPath} />
              <AccountMenu
                email={user?.email ?? null}
                role={role}
                roleLabel={getRoleLabel(role)}
                dashboardPath={dashboardPath}
                onLogout={handleLogout}
              />
            </div>
          ) : (
            /* Logged-out marketing nav */
            <>
              <div className="hidden md:flex items-center gap-0.5">
                <NavLink href="/how-it-works">How it works</NavLink>
                <NavLink href="/why-shield">Why Shield HQ</NavLink>
                <NavLink href="/blog">Shield Weekly</NavLink>
                <NavLink href="/signup/venue">For Venues</NavLink>
                <NavLink href="/signup/personnel">For Security</NavLink>
              </div>

              <div className="hidden md:block w-px h-5 bg-white/10 mx-1" />

              <div className="flex items-center gap-1 sm:gap-2">
                <NavLink href="/login">Log in</NavLink>
                <Link href="/signup" prefetch={false}>
                  <span className="inline-block rounded-xl bg-shield-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition-colors hover:bg-shield-600">
                    Sign up
                  </span>
                </Link>
              </div>
            </>
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
