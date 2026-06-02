/** True when Supabase/PostgREST reports a missing column (migration not applied yet). */
export function isMissingColumnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  if (!e) return false;
  if (String(e.code) === "42703") return true;
  const m = (e.message || "").toLowerCase();
  return m.includes("does not exist") && m.includes("column");
}

/** Shape we see from Supabase PostgREST / supabase-js errors. */
type PostgrestLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

/**
 * Turn any thrown value into a readable, loggable object.
 *
 * Supabase `PostgrestError` objects print as `{}` via `console.error(err)` in
 * Next.js dev overlay because none of their properties are enumerable via
 * the default stringifier. This gathers `message / code / details / hint`
 * explicitly so logs are actually useful.
 */
export function describeError(err: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  raw?: unknown;
} {
  if (err == null) return { message: "Unknown error" };
  if (err instanceof Error) {
    return { message: err.message || err.name || "Error", raw: err };
  }
  if (typeof err === "string") return { message: err };
  const e = err as PostgrestLike;
  return {
    message:
      e.message ||
      (typeof err === "object" ? JSON.stringify(err) : String(err)) ||
      "Unknown error",
    code: e.code ?? undefined,
    details: e.details ?? undefined,
    hint: e.hint ?? undefined,
    raw: err,
  };
}

/** Single-string human-readable form, handy for `alert()` / toasts. */
export function errorMessage(err: unknown): string {
  const d = describeError(err);
  const parts = [d.message];
  if (d.code) parts.push(`(code ${d.code})`);
  if (d.hint) parts.push(`— ${d.hint}`);
  return parts.join(" ");
}
