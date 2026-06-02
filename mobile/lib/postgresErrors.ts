/** True when Supabase/PostgREST reports a missing column (migration not applied yet). */
export function isMissingColumnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  if (!e) return false;
  if (String(e.code) === "42703") return true;
  const m = (e.message || "").toLowerCase();
  return m.includes("does not exist") && m.includes("column");
}
