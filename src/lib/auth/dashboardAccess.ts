/**
 * Which role may open which dashboard.
 *
 * Middleware and the per-dashboard layouts both enforce this. They used to
 * decide independently and disagreed: middleware refused a hand-set guest
 * cookie in production while the layouts still honoured it, so the stricter
 * check was doing nothing. One module, one answer.
 */

import type { Role } from "@/lib/auth";

/** Dashboard roots and the role each one belongs to. Longest prefix wins. */
const DASHBOARD_PREFIXES: ReadonlyArray<readonly [string, Role]> = [
  ["/d/venue", "venue"],
  ["/d/personnel", "personnel"],
  ["/d/agency", "agency"],
  ["/admin", "admin"],
];

/** The role required to open `pathname`, or null if it is not a dashboard. */
export function requiredRoleForPath(pathname: string): Role | null {
  for (const [prefix, role] of DASHBOARD_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

/**
 * The `shield_guest_role` cookie lets unauthenticated visitors preview the
 * dashboards in demo mode. It is NOT an authorization boundary — data access is
 * governed by RLS — and it is off in production by default so a hand-set cookie
 * cannot reach a dashboard shell. Set `ALLOW_GUEST_DASHBOARDS=true` to opt back
 * in for a public demo build.
 */
export function isGuestDashboardAccessAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_GUEST_DASHBOARDS === "true"
  );
}

/**
 * Resolve the guest preview role for a request that has no session.
 *
 * Returns null whenever a real user is signed in: their actual role decides
 * what they may open, and letting the cookie win would be a free upgrade from
 * guard to agency.
 */
export function guestPreviewRole(
  cookieValue: string | undefined,
  hasSession: boolean,
): Role | null {
  if (hasSession) return null;
  if (!isGuestDashboardAccessAllowed()) return null;
  if (!cookieValue) return null;

  const valid: Role[] = ["venue", "personnel", "agency", "admin"];
  return valid.includes(cookieValue as Role) ? (cookieValue as Role) : null;
}
