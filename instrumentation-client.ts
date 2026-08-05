import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions, SENTRY_ENABLED } from "@/lib/monitoring/sentryOptions";

if (SENTRY_ENABLED) {
  Sentry.init({
    ...sharedSentryOptions,
    sendDefaultPii: false,
    // Replay every session that errors; sample the rest lightly.
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  });

  // Session Replay is ~40 kB, so it is fetched from Sentry's CDN after the page
  // is interactive rather than shipped in the main bundle. If the request is
  // blocked we simply lose replays, not error reporting.
  void loadSessionReplay();
}

async function loadSessionReplay() {
  try {
    const replayIntegration = await Sentry.lazyLoadIntegration("replayIntegration");
    Sentry.addIntegration(
      replayIntegration({
        // Guard names, addresses and live locations render as plain text all
        // over the dashboards, so nothing in a replay is un-masked.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    );
  } catch {
    // Replay unavailable (offline, CDN blocked) — errors still report.
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
