import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  guestPreviewRole,
  isGuestDashboardAccessAllowed,
  requiredRoleForPath,
} from "@/lib/auth/dashboardAccess";

const SITE_ACCESS_COOKIE = "shield_site_access";
const SITE_ACCESS_VALUE = "1";

function isSiteGateEnabled(): boolean {
  return Boolean(process.env.SITE_PASSWORD?.trim());
}

function hasSiteAccess(request: NextRequest): boolean {
  return request.cookies.get(SITE_ACCESS_COOKIE)?.value === SITE_ACCESS_VALUE;
}

/**
 * When SITE_PASSWORD is set, block the whole site until the access cookie is present.
 * API routes are excluded so webhooks, cron, and /api/gate keep working.
 */
function siteGateResponse(request: NextRequest): NextResponse | null {
  if (!isSiteGateEnabled()) return null;

  const { pathname } = request.nextUrl;

  if (pathname === "/gate" || pathname.startsWith("/gate/")) {
    return null;
  }

  if (hasSiteAccess(request)) {
    return null;
  }

  const gateUrl = new URL("/gate", request.url);
  const returnPath = pathname + request.nextUrl.search;
  if (returnPath !== "/gate") {
    gateUrl.searchParams.set("return", returnPath);
  }
  return NextResponse.redirect(gateUrl);
}

type AppRole = "venue" | "personnel" | "agency" | "admin";

function dashboardPathForRole(role: AppRole | undefined): string | null {
  switch (role) {
    case "venue":
      return "/d/venue";
    case "personnel":
      return "/d/personnel";
    case "agency":
      return "/d/agency";
    case "admin":
      return "/admin";
    default:
      return null;
  }
}

/** The caller's role, checked against both profile shapes then user metadata. */
async function resolveRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  metadataRole: unknown,
): Promise<AppRole | undefined> {
  const { data: byUserId } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: byId } = byUserId?.role
    ? { data: null }
    : await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  return (byUserId?.role || byId?.role || metadataRole) as AppRole | undefined;
}

export async function middleware(request: NextRequest) {
  const gateRedirect = siteGateResponse(request);
  if (gateRedirect) return gateRedirect;

  const { pathname } = request.nextUrl;

  // Derived from the same map that decides which role a path needs, so a new
  // dashboard can never be protected by one and ignored by the other.
  const requiredRole = requiredRoleForPath(pathname);
  const isProtected = requiredRole !== null;
  const guestRole = request.cookies.get("shield_guest_role")?.value;
  const guestAllowed = isGuestDashboardAccessAllowed();

  // Public marketing/auth pages don't need a Supabase round-trip.
  if (!isProtected && pathname !== "/signup") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate the user against the Supabase auth server. Do NOT use getSession()
  // for auth decisions in server code — it only decodes the cookie locally and
  // can be stale or spoofed. getUser() verifies the token with Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If /signup is opened while the role is already known, route to the dashboard.
  if (pathname === "/signup") {
    let role: AppRole | undefined;

    if (user?.id) {
      role = await resolveRole(supabase, user.id, user.user_metadata?.role);
    } else if (
      guestAllowed &&
      guestRole &&
      ["venue", "personnel", "agency", "admin"].includes(guestRole)
    ) {
      role = guestRole as AppRole;
    }

    const dashboardPath = dashboardPathForRole(role);
    if (dashboardPath) {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
    // Signed in but role unresolved — prefer the dashboard over a signup loop.
    if (user?.id) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Always return the cookie-bearing `response` (not a fresh NextResponse.next())
  // so refreshed Supabase auth cookies are persisted to the browser.
  if (!isProtected) return response;

  if (!user) {
    // Guest demo preview (gated; not an auth boundary — RLS still governs data).
    // The cookie must name the role this path actually needs: previously any
    // value let the request through and the layout had to catch it.
    if (guestPreviewRole(guestRole, false) === requiredRole) return response;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authentication alone used to be enough here, so any signed-in account could
  // open /d/agency or /admin. RLS kept the data out, but the shell, its nav and
  // anything served by a service-role route were reachable.
  const role = await resolveRole(supabase, user.id, user.user_metadata?.role);

  // Role unresolved (profile row still being created, or a failed lookup) is
  // treated as a mismatch: send them somewhere harmless rather than guessing in
  // their favour.
  if (role !== requiredRole) {
    const fallback = role ? dashboardPathForRole(role) : null;
    return NextResponse.redirect(new URL(fallback ?? "/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run middleware on all paths except:
     * - api (gate API, webhooks, cron)
     * - monitoring (Sentry's tunnel — browser error reports POST here, and the
     *   site gate would otherwise redirect them to /gate and lose every
     *   client-side crash the moment SITE_PASSWORD is set)
     * - Next.js internals and favicon
     */
    "/((?!api|monitoring|_next/static|_next/image|favicon.ico).*)",
  ],
};
