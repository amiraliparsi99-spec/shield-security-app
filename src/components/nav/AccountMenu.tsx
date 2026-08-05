"use client";

import Link from "next/link";
import { useDropdown } from "./useDropdown";

type Role = "venue" | "personnel" | "agency" | "admin";

type AccountLink = { href: string; label: string };

function roleLinks(role: Role, dashboardPath: string): AccountLink[] {
  const links: AccountLink[] = [{ href: dashboardPath, label: "Dashboard" }];
  switch (role) {
    case "venue":
      links.push(
        { href: "/d/venue/spend", label: "Billing & spend" },
        { href: "/d/venue/settings", label: "Settings" }
      );
      break;
    case "personnel":
      links.push(
        { href: "/verification", label: "Verification" },
        { href: "/d/personnel/settings", label: "Settings" }
      );
      break;
    case "agency":
      links.push(
        { href: "/verification", label: "Verification" },
        { href: "/d/agency/settings", label: "Settings" }
      );
      break;
    case "admin":
      links.push({ href: "/admin", label: "Admin panel" });
      break;
  }
  return links;
}

export function AccountMenu({
  email,
  role,
  roleLabel,
  dashboardPath,
  onLogout,
}: {
  email: string | null;
  role: Role;
  roleLabel: string;
  dashboardPath: string;
  onLogout: () => void;
}) {
  const { open, setOpen, ref } = useDropdown();
  const initial = (email?.[0] ?? roleLabel[0] ?? "?").toUpperCase();
  const links = roleLinks(role, dashboardPath);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-shield-500 to-shield-600 text-sm font-bold text-white ring-1 ring-white/15 transition hover:ring-white/30"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="border-b border-white/[0.06] px-4 pb-3 pt-2">
            <div className="text-sm font-semibold text-white">{roleLabel} account</div>
            {email && <div className="mt-0.5 truncate text-xs text-zinc-500">{email}</div>}
          </div>

          <div className="py-1">
            {links.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-white/[0.06] pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
