import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as Sentry from "@sentry/nextjs";
import type { Envelope, Event } from "@sentry/core";

import { scrubEvent } from "./sentryOptions";

/**
 * Most errors in this codebase are handled in a `catch` block that ends in
 * `console.error(...)`, so console capture is what makes them visible at all.
 * These tests boot a real client against a stub transport and assert both
 * halves hold together: the console call produces an event, and personal data
 * interpolated into it is redacted before the envelope leaves the process.
 *
 * Asserting on the transport rather than on `scrubEvent` directly is the point
 * — it catches the case where scrubbing works but is never wired into `init`.
 */
const sent: Event[] = [];

function stubTransport() {
  return {
    send(envelope: Envelope) {
      for (const item of envelope[1] as Array<[{ type: string }, unknown]>) {
        if (item[0].type === "event") sent.push(item[1] as Event);
      }
      return Promise.resolve({});
    },
    flush: () => Promise.resolve(true),
  };
}

let client: Sentry.NodeClient | undefined;

beforeAll(() => {
  const scope = new Sentry.Scope();
  client = new Sentry.NodeClient({
    dsn: "https://abc123@o1.ingest.de.sentry.io/1",
    enabled: true,
    environment: "test",
    transport: stubTransport,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
      Sentry.dedupeIntegration(),
    ],
    stackParser: Sentry.defaultStackParser,
    beforeSend: scrubEvent,
  });
  scope.setClient(client);
  client.init();
});

afterAll(async () => {
  await client?.close();
});

async function captureViaConsole(...args: unknown[]): Promise<Event> {
  sent.length = 0;
  Sentry.withScope((scope) => {
    scope.setClient(client!);
    console.error(...args);
  });
  await client!.flush(2000);
  expect(sent.length).toBeGreaterThan(0);
  return sent[0];
}

describe("console capture reaches Sentry", () => {
  it("turns a swallowed catch-block console.error into an event", async () => {
    const event = await captureViaConsole(
      "[WATCHDOG] Zone-breach detection failed:",
      new Error("supabase timeout"),
    );

    const text = JSON.stringify(event);
    expect(text).toContain("WATCHDOG");
    expect(text).toContain("supabase timeout");
  });

  it("redacts personal data interpolated into the console call", async () => {
    const event = await captureViaConsole(
      "[NOTIFY-GUARDS] failed for",
      "guard@example.com",
      "07700900123",
      "SW1A 1AA",
    );

    const text = JSON.stringify(event);
    expect(text).not.toContain("guard@example.com");
    expect(text).not.toContain("07700900123");
    expect(text).not.toContain("SW1A 1AA");
    // The operational half still has to survive, or the report is useless.
    expect(text).toContain("NOTIFY-GUARDS");
  });

  it("keeps the identifiers we debug with", async () => {
    const event = await captureViaConsole(
      "[SHIFT-CLAIM] failed for shift 3f2504e0-4f89-11d3-9a0c-0305e82c3301 with PGRST116",
    );

    const text = JSON.stringify(event);
    expect(text).toContain("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    expect(text).toContain("PGRST116");
  });
});
