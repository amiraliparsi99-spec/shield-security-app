import { describe, it, expect, afterEach, vi } from "vitest";

import {
  guestPreviewRole,
  isGuestDashboardAccessAllowed,
  requiredRoleForPath,
} from "./dashboardAccess";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requiredRoleForPath", () => {
  it("maps each dashboard root to its role", () => {
    expect(requiredRoleForPath("/d/venue")).toBe("venue");
    expect(requiredRoleForPath("/d/personnel")).toBe("personnel");
    expect(requiredRoleForPath("/d/agency")).toBe("agency");
    expect(requiredRoleForPath("/admin")).toBe("admin");
  });

  it("covers nested pages, not just the root", () => {
    expect(requiredRoleForPath("/d/agency/bookings/123/pay")).toBe("agency");
    expect(requiredRoleForPath("/admin/verifications")).toBe("admin");
  });

  it("leaves public pages unprotected", () => {
    expect(requiredRoleForPath("/")).toBeNull();
    expect(requiredRoleForPath("/login")).toBeNull();
    expect(requiredRoleForPath("/dashboard")).toBeNull();
  });

  it("does not match on a shared prefix that is a different path", () => {
    // "/administrator" must not be treated as the admin dashboard.
    expect(requiredRoleForPath("/administrator")).toBeNull();
    expect(requiredRoleForPath("/d/venues-public")).toBeNull();
  });
});

describe("isGuestDashboardAccessAllowed", () => {
  it("is off in production unless explicitly opted in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_GUEST_DASHBOARDS", "");
    expect(isGuestDashboardAccessAllowed()).toBe(false);

    vi.stubEnv("ALLOW_GUEST_DASHBOARDS", "true");
    expect(isGuestDashboardAccessAllowed()).toBe(true);
  });

  it("is on outside production so local demos keep working", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isGuestDashboardAccessAllowed()).toBe(true);
  });
});

describe("guestPreviewRole", () => {
  it("previews the requested dashboard for a signed-out visitor in dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(guestPreviewRole("agency", false)).toBe("agency");
  });

  it("ignores the cookie entirely once a user is signed in", () => {
    // The escalation this guards against: a signed-in guard sets
    // shield_guest_role=agency and walks into the agency dashboard.
    vi.stubEnv("NODE_ENV", "development");
    expect(guestPreviewRole("agency", true)).toBeNull();
    expect(guestPreviewRole("admin", true)).toBeNull();
  });

  it("ignores the cookie in production even when signed out", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_GUEST_DASHBOARDS", "");
    expect(guestPreviewRole("agency", false)).toBeNull();
  });

  it("rejects a cookie value that is not a real role", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(guestPreviewRole("superuser", false)).toBeNull();
    expect(guestPreviewRole("", false)).toBeNull();
    expect(guestPreviewRole(undefined, false)).toBeNull();
  });
});
