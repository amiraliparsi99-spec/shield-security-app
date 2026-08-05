import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { scrubEvent, scrubUrl } from "./sentryOptions";

const REDACTED = "[redacted]";

function event(partial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent;
}

describe("scrubUrl", () => {
  it("redacts credential-bearing query params", () => {
    const out = scrubUrl(
      "https://app.shield.hq/auth/callback?code=abc123&access_token=xyz&next=/d/agency",
    );
    expect(out).toContain(`code=${encodeURIComponent(REDACTED)}`);
    expect(out).toContain(`access_token=${encodeURIComponent(REDACTED)}`);
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("xyz");
  });

  it("leaves harmless URLs untouched", () => {
    const url = "https://app.shield.hq/d/agency/bookings?status=confirmed";
    expect(scrubUrl(url)).toBe(url);
  });

  it("does not throw on a malformed URL", () => {
    expect(() => scrubUrl("not a url ??? &&&")).not.toThrow();
  });
});

describe("scrubEvent — personal data never leaves the process", () => {
  it("redacts guard location, address and contact details from extra", () => {
    const out = scrubEvent(
      event({
        extra: {
          shiftId: "shift-1",
          check_in_latitude: 51.5072,
          check_in_longitude: -0.1276,
          site_address_text: "12 Example Street, London",
          phone: "+447700900000",
          email: "guard@example.com",
          postcode: "SW1A 1AA",
        },
      }),
    );

    expect(out.extra).toMatchObject({
      shiftId: "shift-1",
      check_in_latitude: REDACTED,
      check_in_longitude: REDACTED,
      site_address_text: REDACTED,
      phone: REDACTED,
      email: REDACTED,
      postcode: REDACTED,
    });
  });

  it("redacts compliance and payment identifiers", () => {
    const out = scrubEvent(
      event({
        extra: {
          sia_licence_number: "1010120000000000",
          national_insurance: "QQ123456C",
          date_of_birth: "1990-01-01",
          sort_code: "00-00-00",
          account_number: "12345678",
          bookingId: "booking-9",
        },
      }),
    );

    expect(out.extra).toMatchObject({
      sia_licence_number: REDACTED,
      national_insurance: REDACTED,
      date_of_birth: REDACTED,
      sort_code: REDACTED,
      account_number: REDACTED,
      bookingId: "booking-9",
    });
  });

  it("reaches sensitive keys nested inside objects and arrays", () => {
    const out = scrubEvent(
      event({
        extra: {
          shifts: [
            { id: "s1", guard: { display_name: "Ali", phone: "+447700900000" } },
          ],
        },
      }),
    );

    const shifts = (out.extra as { shifts: Array<Record<string, any>> }).shifts;
    expect(shifts[0].id).toBe("s1");
    expect(shifts[0].guard.phone).toBe(REDACTED);
  });

  it("strips cookies and auth tokens from the request", () => {
    const out = scrubEvent(
      event({
        request: {
          url: "https://app.shield.hq/api/shifts?token=supersecret",
          cookies: { "sb-access-token": "secret" },
          data: { password: "hunter2", shift_id: "s1" },
        },
      }),
    );

    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.url).not.toContain("supersecret");
    expect(out.request?.data).toMatchObject({
      password: REDACTED,
      shift_id: "s1",
    });
  });

  it("reduces the user down to an id, dropping name and email", () => {
    const out = scrubEvent(
      event({
        user: {
          id: "user-1",
          email: "owner@agency.com",
          username: "ali",
          ip_address: "203.0.113.4",
        },
      }),
    );

    expect(out.user).toEqual({ id: "user-1" });
  });

  it("scrubs breadcrumb data as well as the event body", () => {
    const out = scrubEvent(
      event({
        breadcrumbs: [
          {
            category: "fetch",
            message: "GET /api/x?access_token=leaky",
            data: { latitude: 51.5, status: 500 },
          },
        ],
      }),
    );

    const crumb = out.breadcrumbs![0];
    expect(crumb.message).not.toContain("leaky");
    expect(crumb.data).toMatchObject({ latitude: REDACTED, status: 500 });
  });

  it("keeps the diagnostic detail we actually need", () => {
    const out = scrubEvent(
      event({
        extra: {
          shiftId: "shift-1",
          bookingId: "booking-2",
          statusCode: 500,
          route: "/d/agency/bookings",
          errorCode: "PGRST116",
        },
      }),
    );

    expect(out.extra).toEqual({
      shiftId: "shift-1",
      bookingId: "booking-2",
      statusCode: 500,
      route: "/d/agency/bookings",
      errorCode: "PGRST116",
    });
  });

  it("survives null, undefined and circular-free odd shapes", () => {
    expect(() =>
      scrubEvent(
        event({ extra: { a: null, b: undefined, c: 0, d: false, e: [] } }),
      ),
    ).not.toThrow();
  });
});

/**
 * Short key names like "lat" are only sensitive as whole words. Substring
 * matching them silently redacts the diagnostics we most need on a crash.
 */
describe("scrubEvent — short key names match as words, not substrings", () => {
  it("still redacts coordinates however the key is cased", () => {
    const out = scrubEvent(
      event({
        extra: {
          lat: 51.5072,
          lng: -0.1276,
          checkInLat: 51.5072,
          "gps.lng": -0.1276,
          check_in_lat: 51.5072,
        },
      }),
    );

    for (const value of Object.values(out.extra ?? {})) {
      expect(value).toBe(REDACTED);
    }
  });

  it("keeps fields that merely contain a sensitive word", () => {
    const out = scrubEvent(
      event({
        extra: {
          platform: "ios",
          latency: 240,
          template: "night-shift",
          translated: true,
          related: "booking-1",
          discard: false,
          cardinality: 12,
        },
      }),
    );

    expect(out.extra).toEqual({
      platform: "ios",
      latency: 240,
      template: "night-shift",
      translated: true,
      related: "booking-1",
      discard: false,
      cardinality: 12,
    });
  });

  it("still redacts the long unambiguous keys by substring", () => {
    const out = scrubEvent(
      event({ extra: { check_in_latitude: 51.5, venue_email: "a@b.com" } }),
    );

    expect(out.extra?.check_in_latitude).toBe(REDACTED);
    expect(out.extra?.venue_email).toBe(REDACTED);
  });
});

/**
 * Capturing the console flattens arguments into a single string, so personal
 * data that key-based scrubbing would catch arrives as free text instead.
 */
describe("scrubEvent — free text in messages and exceptions", () => {
  it("redacts contact details interpolated into a captured console message", () => {
    const out = scrubEvent(
      event({
        message:
          "[NOTIFY-GUARDS] push failed for guard@example.com on 07700900123",
      }),
    );

    expect(out.message).not.toContain("guard@example.com");
    expect(out.message).not.toContain("07700900123");
    expect(out.message).toContain("[NOTIFY-GUARDS]");
  });

  it("redacts a home postcode and coordinate pair", () => {
    const out = scrubEvent(
      event({ message: "no guard near SW1A 1AA at 51.50720, -0.12760" }),
    );

    expect(out.message).not.toContain("SW1A 1AA");
    expect(out.message).not.toContain("51.50720");
    expect(out.message).toContain("[postcode]");
    expect(out.message).toContain("[coords]");
  });

  it("redacts SIA licence numbers and bank details", () => {
    const out = scrubEvent(
      event({ message: "licence 1234567890123456 sort 60-16-13" }),
    );

    expect(out.message).not.toContain("1234567890123456");
    expect(out.message).not.toContain("60-16-13");
  });

  it("redacts session tokens quoted inside an exception message", () => {
    const out = scrubEvent(
      event({
        exception: {
          values: [
            {
              type: "AuthApiError",
              value:
                "rejected Bearer sk_live_abc123 / eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
            },
          ],
        },
      }),
    );

    const value = out.exception?.values?.[0]?.value ?? "";
    expect(value).not.toContain("sk_live_abc123");
    expect(value).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(value).toContain("rejected");
  });

  it("leaves identifiers we debug with intact", () => {
    const message =
      "shift 3f2504e0-4f89-11d3-9a0c-0305e82c3301 failed with PGRST116 on /d/agency/bookings";
    const out = scrubEvent(event({ message }));

    expect(out.message).toBe(message);
  });
});
