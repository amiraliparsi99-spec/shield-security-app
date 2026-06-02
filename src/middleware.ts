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

export async function middleware(request: NextRequest) {
  const gateRedirect = siteGateResponse(request);
  if (gateRedirect) return gateRedirect;

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const guestRole = request.cookies.get("shield_guest_role")?.value;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If /signup is opened while role is already known, send user straight to dashboard.
  if (pathname === "/signup") {
    let role:
      | "venue"
      | "personnel"
      | "agency"
      | "admin"
      | undefined;

    if (session?.user?.id) {
      const userId = session.user.id;
      const { data: profileByUser } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: profileById } = profileByUser?.role
        ? { data: null }
        : await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      role = (profileByUser?.role || profileById?.role || session.user.user_metadata?.role) as
        | "venue"
        | "personnel"
        | "agency"
        | "admin"
        | undefined;
    } else if (guestRole && ["venue", "personnel", "agency", "admin"].includes(guestRole)) {
      role = guestRole as "venue" | "personnel" | "agency" | "admin";
    }

    const dashboardPath =
      role === "venue"
        ? "/d/venue"
        : role === "personnel"
          ? "/d/personnel"
          : role === "agency"
            ? "/d/agency"
            : role === "admin"
              ? "/admin"
              : null;
    if (dashboardPath) {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
  }

  // If a signed-in user hits /signup, send them straight to their dashboard.
  if (pathname === "/signup" && session?.user?.id) {
    const userId = session.user.id;
    const { data: profileByUser } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: profileById } = profileByUser?.role
      ? { data: null }
      : await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const role = (profileByUser?.role || profileById?.role || session.user.user_metadata?.role) as
      | "venue"
      | "personnel"
      | "agency"
      | "admin"
      | undefined;
    const dashboardPath =
      role === "venue"
        ? "/d/venue"
        : role === "personnel"
          ? "/d/personnel"
          : role === "agency"
            ? "/d/agency"
            : role === "admin"
              ? "/admin"
              : null;
    if (dashboardPath) {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
    // If signed-in but role unresolved, prefer dashboard over signup loop.
    if (session?.user?.id) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (!isProtected) return NextResponse.next();

  // Allow guest demo via cookie
  if (guestRole) return NextResponse.next();

  if (!session) {
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
