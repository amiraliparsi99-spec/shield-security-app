/**
 * Structured logger for production.
 * Use instead of console.log; can be wired to Sentry or log aggregation later.
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    if (isDev) {
      if (meta) console.log(`[info] ${message}`, meta);
      else console.log(`[info] ${message}`);
    }
    // In production: send to Sentry breadcrumb or logging service
  },

  warn(message: string, meta?: Record<string, unknown>) {
    if (meta) console.warn(`[warn] ${message}`, meta);
    else console.warn(`[warn] ${message}`);
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (error instanceof Error) {
      console.error(`[error] ${message}`, error.message, meta ?? error);
    } else {
      console.error(`[error] ${message}`, error, meta);
    }
    // In production: Sentry.captureException(error)
  },

  debug(message: string, meta?: Record<string, unknown>) {
    if (isDev && meta) console.debug(`[debug] ${message}`, meta);
    else if (isDev) console.debug(`[debug] ${message}`);
  },
};
