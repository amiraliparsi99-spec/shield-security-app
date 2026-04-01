import { describe, it, expect, vi } from "vitest";
import { getVenueByUserId, getVenueById } from "./venues";

describe("getVenueByUserId", () => {
  it("returns null when no venue found", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    };
    const result = await getVenueByUserId(mockSupabase as any, "user-1");
    expect(result).toBeNull();
  });

  it("returns venue when found by user_id", async () => {
    const venue = { id: "v1", user_id: "user-1", name: "Test Venue" };
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: venue, error: null })),
          })),
        })),
      })),
    };
    const result = await getVenueByUserId(mockSupabase as any, "user-1");
    expect(result).toEqual(venue);
  });
});

describe("getVenueById", () => {
  it("returns null on error", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: "Not found" } })),
          })),
        })),
      })),
    };
    const result = await getVenueById(mockSupabase as any, "v1");
    expect(result).toBeNull();
  });

  it("returns venue when found", async () => {
    const venue = { id: "v1", name: "Venue" };
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: venue, error: null })),
          })),
        })),
      })),
    };
    const result = await getVenueById(mockSupabase as any, "v1");
    expect(result).toEqual(venue);
  });
});
