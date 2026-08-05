/**
 * Extra diagnostic detail for API error responses, visible in development
 * only. Raw database errors name tables, columns and constraints — useful
 * while building, but in production they hand schema details to whoever
 * triggered the error. Production diagnostics belong in Sentry (every
 * console.error is captured), not in the response body.
 *
 * Usage: NextResponse.json({ error: "...", debug: devDebug({ db_error: msg }) })
 * JSON serialisation drops the key entirely when this returns undefined.
 */
export function devDebug<T>(payload: T): T | undefined {
  return process.env.NODE_ENV === "production" ? undefined : payload;
}
