import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disabled to fix react-leaflet double initialization issue with React 19
  // Repo has many legacy ESLint issues; CI can lint separately. Unblocks Vercel builds.
  eslint: { ignoreDuringBuilds: true },
  // Type errors now fail the build (tsc is clean as of the type-safety cleanup).
  typescript: { ignoreBuildErrors: false },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps are uploaded then deleted, so stack traces are readable in
  // Sentry without shipping originals to the browser.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Proxy Sentry traffic through our own domain so ad-blockers don't drop reports.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  bundleSizeOptimizations: {
    // Also drops the SDK's own logger statements.
    excludeDebugStatements: true,
    // Replay is loaded from the CDN at runtime, so its shadow-DOM and iframe
    // recorders never need to be in our bundle.
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
