/**
 * The one logging entry point for the app. Works in every runtime (browser,
 * node, edge) and forwards to Sentry when a DSN is configured.
 *
 * Prefer this over bare `console.*` so failures are visible in production
 * rather than only in a terminal nobody is watching.
 *
 *   logger.error("Failed to finalise shift", err, { shiftId });
 *   logger.warn("Geofence lookup fell back to booking radius", { bookingId });
 */

import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

export type LogMeta = Record<string, unknown>;

/** Severity mapped onto Sentry levels so alerts can be filtered by importance. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function report(level: LogLevel, message: string, error?: unknown, meta?: LogMeta) {
  if (level === "error" || level === "fatal") {
    Sentry.captureException(toError(error ?? message), {
      level,
      tags: { logger: "app" },
      extra: { message, ...meta },
    });
    return;
  }

  if (level === "warn") {
    Sentry.captureMessage(message, { level: "warning", extra: meta });
    return;
  }

  Sentry.addBreadcrumb({
    category: "app",
    level: level === "debug" ? "debug" : "info",
    message,
    data: meta,
  });
}

export const logger = {
  debug(message: string, meta?: LogMeta) {
    if (isDev) console.debug(`[debug] ${message}`, meta ?? "");
    report("debug", message, undefined, meta);
  },

  info(message: string, meta?: LogMeta) {
    if (isDev) console.log(`[info] ${message}`, meta ?? "");
    report("info", message, undefined, meta);
  },

  warn(message: string, meta?: LogMeta) {
    console.warn(`[warn] ${message}`, meta ?? "");
    report("warn", message, undefined, meta);
  },

  error(message: string, error?: unknown, meta?: LogMeta) {
    console.error(`[error] ${message}`, error, meta ?? "");
    report("error", message, error, meta);
  },

  /** Something that breaks money, safety or data integrity — page on these. */
  fatal(message: string, error?: unknown, meta?: LogMeta) {
    console.error(`[fatal] ${message}`, error, meta ?? "");
    report("fatal", message, error, meta);
  },
};

/**
 * Attach the signed-in user to every subsequent event. Only the Supabase user
 * id and role are sent — never name, email or phone.
 */
export function setLogUser(user: { id: string; role?: string | null } | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id });
  Sentry.setTag("user_role", user.role ?? "unknown");
}
