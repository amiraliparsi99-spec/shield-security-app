import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Password recovery: send to the set-new-password form
      if (type === "recovery") {
        return NextResponse.redirect(
          new URL("/auth/reset-password", requestUrl.origin)
        );
      }

      // Email verification / signup: send to success page then dashboard
      const role = data.user.user_metadata?.role || "personnel";
      let redirectPath = "/d/personnel";
      if (role === "venue") redirectPath = "/d/venue";
      else if (role === "agency") redirectPath = "/d/agency";

      return NextResponse.redirect(
        new URL(`/auth/verified?redirect=${encodeURIComponent(redirectPath)}`, requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(
    new URL("/auth/error?message=verification_failed", requestUrl.origin)
  );
}
