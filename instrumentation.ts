import * as Sentry from "@sentry/nextjs";

import { SENTRY_ENABLED, SENTRY_ENVIRONMENT } from "@/lib/monitoring/sentryOptions";

/**
 * A production deploy with no DSN reports nothing and looks identical to a
 * healthy one, so say so loudly at boot rather than discovering it during an
 * incident.
 */
function warnIfUnmonitored() {
  if (SENTRY_ENABLED) return;
  if (process.env.NODE_ENV !== "production") return;

  console.error(
    `[monitoring] NEXT_PUBLIC_SENTRY_DSN is not set on this ${SENTRY_ENVIRONMENT} ` +
      `deployment — crashes and errors are NOT being reported anywhere.`,
  );
}

export async function register() {
  warnIfUnmonitored();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Reports errors thrown inside server components, route handlers and actions. */
export const onRequestError = Sentry.captureRequestError;
