import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions, SENTRY_ENABLED } from "@/lib/monitoring/sentryOptions";

if (SENTRY_ENABLED) {
  Sentry.init({
    ...sharedSentryOptions,
    // Request bodies on this server carry GPS pings and personal data.
    sendDefaultPii: false,
  });
}
