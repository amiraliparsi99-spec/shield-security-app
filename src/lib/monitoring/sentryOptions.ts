/**
 * Shared Sentry configuration for every runtime (browser, node, edge).
 *
 * This app handles data that must not leave our control under UK GDPR: guard
 * home addresses, live GPS coordinates, SIA licence numbers, phone numbers and
 * payment identifiers. Sentry's defaults would happily ship a lot of that in
 * request bodies and breadcrumbs, so collection is locked down here and every
 * event is scrubbed on the way out.
 */

import {
  captureConsoleIntegration,
  dedupeIntegration,
  extraErrorDataIntegration,
} from "@sentry/nextjs";
import type { ErrorEvent, EventHint } from "@sentry/core";

export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

export const SENTRY_ENABLED = Boolean(SENTRY_DSN);

const isProduction = process.env.NODE_ENV === "production";

export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.VERCEL_ENV ||
  process.env.NODE_ENV ||
  "development";

export const SENTRY_RELEASE =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  undefined;

/**
 * Keys whose values are redacted anywhere they appear in an event payload.
 * Matched case-insensitively as a substring, so "check_in_latitude" is caught
 * by "latitude". Every entry here must be long enough to be unambiguous —
 * short ones belong in SENSITIVE_KEY_WORDS.
 */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "session",
  "service_role",
  "email",
  "phone",
  "postcode",
  "post_code",
  "address",
  "latitude",
  "longitude",
  "sia_licence",
  "sia_license",
  "licence_number",
  "license_number",
  "national_insurance",
  "date_of_birth",
  "sort_code",
  "account_number",
  "stripe_secret",
  "client_secret",
];

/**
 * Short names that are only sensitive as a whole word. Substring-matching these
 * would redact the diagnostics we depend on — "lat" appears inside "platform",
 * "latency", "template" and "translate", and "card" inside "discard". Matched
 * against camelCase and snake_case segments, so `gps.lat` and `checkInLat` are
 * still caught.
 */
const SENSITIVE_KEY_WORDS = new Set([
  "lat",
  "lng",
  "lon",
  "dob",
  "bank",
  "iban",
  "card",
  "pan",
  "cvv",
]);

/** Query params stripped from any URL we report. */
const SENSITIVE_QUERY_PARAMS = [
  "token",
  "access_token",
  "refresh_token",
  "code",
  "email",
  "apikey",
];

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

/** Split camelCase, snake_case, kebab-case and dotted keys into lowercase words. */
function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return true;
  }
  return keyWords(key).some((word) => SENSITIVE_KEY_WORDS.has(word));
}

/** Recursively redact sensitive keys, leaving structure intact for debugging. */
function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value == null) return value;

  if (typeof value === "string") return scrubUrlsInString(value);

  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(entry, depth + 1);
    }
    return out;
  }

  return value;
}

/** Strip credential-bearing query params so URLs stay useful but safe. */
export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://placeholder.local");
    let changed = false;
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, REDACTED);
        changed = true;
      }
    }
    if (!changed) return url;
    return url.startsWith("http")
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * Free-text patterns redacted wherever they appear in a message or error string.
 *
 * Key-based scrubbing cannot help here: capturing the console turns
 * `console.error("no guard for", email, err)` into a single interpolated
 * string, and Supabase and Stripe both quote row values back inside error
 * messages. These patterns are deliberately narrow so that identifiers worth
 * debugging with — UUIDs, shift ids, Stripe object ids — survive intact.
 */
const FREE_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // JWTs and bearer tokens, including the Supabase session tokens in headers.
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]"],
  [/\b(bearer|basic)\s+[\w\-._~+/]+=*/gi, "$1 [redacted]"],
  // UK mobile and landline, written locally or internationally.
  [/(?:\+44\s?|\b0)(?:\d\s?){9,10}\b/g, "[phone]"],
  // UK postcode — guard home addresses are the most sensitive field we hold.
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, "[postcode]"],
  // SIA licence (16 digits) and card-length runs. Hyphenated UUIDs are unaffected.
  [/\b\d{15,19}\b/g, "[long-number]"],
  // Sort code and account number.
  [/\b\d{2}-\d{2}-\d{2}\b/g, "[sort-code]"],
  // Bare coordinate pairs, e.g. "51.5074, -0.1278".
  [/-?\b\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g, "[coords]"],
];

/** Redact credentials in URLs and any sensitive pattern in free text. */
function scrubUrlsInString(value: string): string {
  let out = value.includes("?") ? scrubUrl(value) : value;
  for (const [pattern, replacement] of FREE_TEXT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Last line of defence before an event leaves the process. Runs after Sentry's
 * own filtering so anything the SDK collected from a route handler, breadcrumb
 * or manual capture is covered.
 */
export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  // Captured console calls arrive as an interpolated message, and error
  // messages routinely quote the row or payload that caused them.
  if (typeof event.message === "string") {
    event.message = scrubUrlsInString(event.message);
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubUrlsInString(exception.value);
  }

  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data);
    }
    delete event.request.cookies;
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubUrlsInString(crumb.message) : crumb.message,
      data: crumb.data
        ? (scrubValue(crumb.data) as Record<string, unknown>)
        : crumb.data,
    }));
  }

  // Keep the Supabase user id for grouping, drop everything else identifying.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  return event;
}

/**
 * Noise we never want to page on: browser extensions, network blips the user
 * already sees as a failed request, and navigations aborted by the user.
 */
const IGNORED_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "AbortError",
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  /^Loading chunk \d+ failed/,
  /^Failed to fetch$/,
  /extension:\/\//,
];

/**
 * The codebase handles roughly 300 errors in `catch` blocks that end in
 * `console.error("[TAG] ...", err)` and swallow the exception. Sentry never
 * sees those, which includes safety-critical work like zone-breach detection
 * and lone-worker welfare checks failing inside cron jobs.
 *
 * Capturing the console is what makes those visible without rewriting every
 * call site. Only `error` is captured — `warn` is used liberally enough here
 * that including it would swamp the free-tier quota. Everything still passes
 * through `scrubEvent`, so logged objects are redacted like any other event.
 */
function consoleCapture() {
  return captureConsoleIntegration({ levels: ["error"] });
}

export const sharedSentryOptions = {
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  release: SENTRY_RELEASE,
  enabled: SENTRY_ENABLED,
  // Full traces in dev, a 10% sample in production keeps us inside the free tier.
  tracesSampleRate: isProduction ? 0.1 : 1,
  enableLogs: true,
  ignoreErrors: IGNORED_ERRORS,
  integrations: [
    consoleCapture(),
    // Cron handlers report failures as plain objects; without this their fields
    // are dropped and every event reads "Object captured as exception".
    extraErrorDataIntegration({ depth: 4 }),
    dedupeIntegration(),
  ],
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [] as [],
    httpHeaders: {
      request: { allow: ["content-type", "user-agent", "referer"] },
      response: { allow: ["content-type"] },
    },
  },
  beforeSend: scrubEvent,
};
