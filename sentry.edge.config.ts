import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions, SENTRY_ENABLED } from "@/lib/monitoring/sentryOptions";

if (SENTRY_ENABLED) {
  Sentry.init({
    ...sharedSentryOptions,
    sendDefaultPii: false,
  });
}
