import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Email verification callback handler
 * 
 * This route handles the redirect from Supabase email verification links.
 * When a user clicks the verification link in their email, they're redirected here.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const type = requestUrl.searchParams.get("type"); // signup, recovery, invite, etc.

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Get the user's role from their profile or metadata
      const role = data.user.user_metadata?.role || "personnel";
      
      // Redirect to the appropriate dashboard based on role
      let redirectPath = "/d/personnel";
      if (role === "venue") redirectPath = "/d/venue";
      else if (role === "agency") redirectPath = "/d/agency";

      // Redirect to success page first, then to dashboard
      return NextResponse.redirect(
        new URL(`/auth/verified?redirect=${encodeURIComponent(redirectPath)}`, requestUrl.origin)
      );
    }
  }

  // If there's an error or no code, redirect to an error page
  return NextResponse.redirect(
    new URL("/auth/error?message=verification_failed", requestUrl.origin)
  );
}
