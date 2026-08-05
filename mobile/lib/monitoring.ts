/**
 * Crash and error reporting for the guard app.
 *
 * Mirrors the web app's privacy stance: this app continuously handles live GPS
 * coordinates, site addresses and SIA licence details, none of which may leave
 * our control under UK GDPR. Collection is disabled by default and every event
 * is scrubbed before it is sent.
 */

import * as Sentry from "@sentry/react-native";
// Not re-exported by the React Native SDK, but resolves to the same hoisted
// @sentry/core instance the SDK itself depends on.
import { captureConsoleIntegration } from "@sentry/core";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";

export const MONITORING_ENABLED = Boolean(DSN);

/** Long enough to be unambiguous as a substring. Keep short names out of here. */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "session",
  "email",
  "phone",
  "postcode",
  "address",
  "latitude",
  "longitude",
  "coords",
  "sia_licence",
  "sia_license",
  "licence_number",
  "national_insurance",
  "date_of_birth",
  "sort_code",
  "account_number",
];

/**
 * Sensitive only as whole words. Substring-matching "lat" would redact
 * "platform", "latency" and "template" — exactly the fields worth having when
 * a crash only reproduces on one OS.
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

/** Personal data that arrives as free text rather than as a named field. */
const FREE_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]"],
  [/\b(bearer|basic)\s+[\w\-._~+/]+=*/gi, "$1 [redacted]"],
  [/(?:\+44\s?|\b0)(?:\d\s?){9,10}\b/g, "[phone]"],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, "[postcode]"],
  [/\b\d{15,19}\b/g, "[long-number]"],
  [/\b\d{2}-\d{2}-\d{2}\b/g, "[sort-code]"],
  [/-?\b\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g, "[coords]"],
];

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

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

export function scrubText(value: string): string {
  let out = value;
  for (const [pattern, replacement] of FREE_TEXT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value == null) return value;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : scrub(entry, depth + 1);
    }
    return out;
  }
  return value;
}

export function initMonitoring() {
  if (!MONITORING_ENABLED) return;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1 : 0.1,
    // Location tasks run in the background for hours; breadcrumb noise there
    // is not worth the payload size.
    maxBreadcrumbs: 50,
    integrations: [
      // The app handles ~190 errors in catch blocks that end in console.error
      // and swallow the exception; without this none of them are ever reported.
      // "warn" is excluded to keep the free-tier quota for real failures.
      captureConsoleIntegration({ levels: ["error"] }),
      Sentry.dedupeIntegration(),
      Sentry.extraErrorDataIntegration({ depth: 4 }),
    ],
    beforeSend(event) {
      // Captured console calls arrive as one interpolated string, and error
      // messages routinely quote the payload that caused them.
      if (typeof event.message === "string") {
        event.message = scrubText(event.message);
      }
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubText(exception.value);
      }
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts)
        event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
          ...crumb,
          message: crumb.message ? scrubText(crumb.message) : crumb.message,
          data: crumb.data
            ? (scrub(crumb.data) as Record<string, unknown>)
            : crumb.data,
        }));
      }
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

/** Attach the signed-in guard by id only — never name, email or phone. */
export function setMonitoringUser(
  user: { id: string; role?: string | null } | null,
) {
  if (!MONITORING_ENABLED) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id });
  Sentry.setTag("user_role", user.role ?? "unknown");
}

export function reportError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) {
  // Deliberately not console.error: the console integration would capture that
  // as its own event and report this failure twice.
  console.log(`[error] ${message}`, error, meta ?? "");
  if (!MONITORING_ENABLED) return;
  const err =
    error instanceof Error ? error : new Error(`${message}: ${String(error)}`);
  Sentry.captureException(err, { extra: { message, ...meta } });
}
