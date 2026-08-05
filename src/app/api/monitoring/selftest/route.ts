import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_ENABLED,
  SENTRY_ENVIRONMENT,
  SENTRY_RELEASE,
} from "@/lib/monitoring/sentryOptions";

export const dynamic = "force-dynamic";

/**
 * Proves the error pipeline is alive end to end.
 *
 * GET  — reports what the deployment thinks its monitoring config is.
 * POST — deliberately throws a tagged error so you can watch it land in Sentry.
 *
 * Locked behind ADMIN_API_SECRET and fails closed, so it is inert on any
 * deployment where the secret is not configured.
 */
function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Self-test disabled: ADMIN_API_SECRET is not configured." },
      { status: 401 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;

  const client = Sentry.getClient();

  return NextResponse.json({
    sentry_enabled: SENTRY_ENABLED,
    client_initialised: Boolean(client),
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE ?? null,
    // Confirms the DSN is present without exposing it.
    dsn_configured: SENTRY_ENABLED,
    traces_sample_rate: client?.getOptions().tracesSampleRate ?? null,
    hint: SENTRY_ENABLED
      ? "POST to this route to send a test error to Sentry."
      : "Set NEXT_PUBLIC_SENTRY_DSN and redeploy — nothing is being reported yet.",
  });
}

export async function POST(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;

  if (!SENTRY_ENABLED) {
    return NextResponse.json(
      {
        sent: false,
        reason: "No DSN configured — the SDK is disabled on this deployment.",
      },
      { status: 503 },
    );
  }

  const stamp = new Date().toISOString();

  // Mirrors how ~300 catch blocks in this codebase report failure. If this does
  // not reach Sentry, console capture is not wired and most handled errors are
  // invisible. The personal data is canary material for the scrubber.
  console.error(
    `[SELFTEST] console capture check ${stamp} —`,
    "guard@example.com 07700900123 SW1A 1AA",
    new Error("console-captured self-test"),
  );

  // Sentry groups by stack trace, so repeat self-tests land in the existing
  // issue. `?newIssue=1` forces a distinct group, which is the only way to
  // exercise an alert rule that fires on "a new issue is created".
  const forceNewIssue = request.nextUrl.searchParams.get("newIssue") === "1";
  const nonce = Math.random().toString(36).slice(2, 8);

  const eventId = Sentry.captureException(
    new Error(`Shield monitoring self-test — ${stamp}`),
    {
      level: "info",
      tags: { selftest: "true" },
      fingerprint: forceNewIssue ? ["selftest", nonce] : undefined,
      extra: {
        note: "Deliberate test error. Safe to resolve.",
        // Present purely to verify the scrubber redacts it in Sentry.
        scrubber_canary_email: "should-be-redacted@example.com",
      },
    },
  );

  await Sentry.flush(4000);

  return NextResponse.json({
    sent: true,
    event_id: eventId,
    sent_at: stamp,
    console_capture: Boolean(
      Sentry.getClient()?.getIntegrationByName("CaptureConsole"),
    ),
    next_step:
      "Open Sentry → Issues. Expect TWO events: the captured exception and a " +
      "[SELFTEST] console capture check. Neither should contain the canary " +
      "email, phone or postcode.",
  });
}
