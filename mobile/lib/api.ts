import Constants from "expo-constants";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Resolve API base URL for Expo Go/dev devices.
 * - Uses EXPO_PUBLIC_API_URL when it is a non-localhost URL.
 * - If EXPO_PUBLIC_API_URL is localhost, rewrites it to the LAN host from Expo metadata.
 */
export function getApiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL || "").trim();

  if (configured && !isLocalhostUrl(configured)) {
    return trimTrailingSlash(configured);
  }

  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    null;

  if (hostUri) {
    const host = String(hostUri).split(":")[0];
    if (host) {
      return `http://${host}:3000`;
    }
  }

  return trimTrailingSlash(configured || "http://localhost:3000");
}

function uniqueNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const trimmed = trimTrailingSlash((v || "").trim());
    if (!trimmed) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

export function getApiBaseUrlCandidates(): string[] {
  const primary = getApiBaseUrl();
  return uniqueNonEmpty([
    primary,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
}

/** Max time we'll wait on each candidate host before falling back to the next
 *  one. Without this, a bad EXPO_PUBLIC_API_URL can hang React Native's fetch
 *  for ~60s (the platform default) before it ever retries localhost. */
const PER_CANDIDATE_TIMEOUT_MS = 6000;

/**
 * Fetch API with host fallback for dev instability.
 * Returns first successful network response (even if HTTP status is non-2xx).
 *
 * - Honours a caller-supplied AbortSignal (so callers can add their own
 *   overall deadline).
 * - Adds a short per-candidate timeout so we fall through unreachable hosts
 *   quickly rather than hanging tens of seconds on the first one.
 */
export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getApiBaseUrlCandidates();
  const callerSignal = init?.signal;
  let lastErr: unknown = null;

  for (const base of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("candidate_timeout")),
      PER_CANDIDATE_TIMEOUT_MS,
    );

    // Forward any caller cancellation onto this attempt too.
    const forwardAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) forwardAbort();
      else callerSignal.addEventListener("abort", forwardAbort);
    }

    try {
      return await fetch(`${base}${normalizedPath}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (err) {
      lastErr = err;
      // If the caller cancelled, stop retrying — otherwise try the next host.
      if (callerSignal?.aborted) throw err;
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", forwardAbort);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("Network request failed for all API hosts");
}
