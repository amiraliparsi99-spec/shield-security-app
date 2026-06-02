import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/d/venue", "/d/personnel", "/d/agency", "/admin"];

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

/**
 * The `shield_guest_role` cookie lets unauthenticated visitors preview the
 * dashboards in demo mode. This is NOT an authorization boundary — actual data
 * access is governed by Supabase RLS. It is disabled in production by default
 * so a hand-set cookie can't reach dashboard shells; set
 * `ALLOW_GUEST_DASHBOARDS=true` to opt back in (e.g. for a public demo build).
 */
function isGuestDashboardAccessAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_GUEST_DASHBOARDS === "true"
  );
}

export async function middleware(request: NextRequest) {
  const gateRedirect = siteGateResponse(request);
  if (gateRedirect) return gateRedirect;

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const guestRole = request.cookies.get("shield_guest_role")?.value;
  const guestAllowed = isGuestDashboardAccessAllowed();

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
      const { data: profileByUser } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: profileById } = profileByUser?.role
        ? { data: null }
        : await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      role = (profileByUser?.role || profileById?.role || user.user_metadata?.role) as
        | AppRole
        | undefined;
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

  // Guest demo preview (gated; not an auth boundary — RLS still governs data).
  if (guestAllowed && guestRole) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run middleware on all paths except:
     * - api (gate API, webhooks, cron)
     * - Next.js internals and favicon
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
