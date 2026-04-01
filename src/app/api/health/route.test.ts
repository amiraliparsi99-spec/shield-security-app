import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ratelimit", () => ({
  withRateLimit: vi.fn(() =>
    Promise.resolve({
      success: true,
      response: null,
      result: { remaining: 10, limit: 10, reset: Date.now() + 60000 },
    })
  ),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 200 with health data when rate limit allows", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/health", { method: "GET" });
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("status", "healthy");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("environment");
  });
});
