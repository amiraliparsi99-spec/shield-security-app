import { NextRequest, NextResponse } from "next/server";

/**
 * Require a valid `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Fails closed: if `CRON_SECRET` is not set in the environment, every request
 * is rejected. This prevents an unset env var from leaving the endpoint open.
 * Vercel's built-in cron requests automatically include this header when the
 * `CRON_SECRET` env var is configured in the project.
 *
 * Returns null when the caller is authorized, otherwise a 401 NextResponse.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Cron endpoint disabled: CRON_SECRET is not configured on this deployment.",
      },
      { status: 401 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
