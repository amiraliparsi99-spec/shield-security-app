import { describe, it, expect } from "vitest";
import {
  formatLocation,
  formatExperience,
  formatRating,
  formatRequestDate,
  formatTimeRange,
} from "./format";
import type { Personnel } from "@/types/database";

const minimalPersonnel = (
  overrides: Partial<Personnel> = {}
): Personnel =>
  ({
    id: "1",
    user_id: "u1",
    display_name: "Test",
    bio: null,
    certs: [],
    experience_years: null,
    experience_since_year: null,
    rate_per_hour: null,
    currency: "GBP",
    city: null,
    region: null,
    country: "UK",
    location_name: null,
    lat: null,
    lng: null,
    status: "available",
    insurance_verified: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as Personnel;

describe("formatLocation", () => {
  it("uses location_name when set", () => {
    const p = minimalPersonnel({ location_name: "Central London, UK" });
    expect(formatLocation(p)).toBe("Central London, UK");
  });

  it("builds from city, region, country", () => {
    const p = minimalPersonnel({ city: "London", region: "Greater London", country: "UK" });
    expect(formatLocation(p)).toBe("London, Greater London, UK");
  });

  it("returns country only when no city/region", () => {
    const p = minimalPersonnel({ country: "UK" });
    expect(formatLocation(p)).toBe("UK");
  });

  it("returns — when empty", () => {
    const p = minimalPersonnel({ country: "" });
    expect(formatLocation(p)).toBe("—");
  });
});

describe("formatExperience", () => {
  it("returns years and since when both set", () => {
    const p = minimalPersonnel({ experience_years: 5, experience_since_year: 2019 });
    expect(formatExperience(p)).toBe("5 years in security · Since 2019");
  });

  it("returns only years when set", () => {
    const p = minimalPersonnel({ experience_years: 1 });
    expect(formatExperience(p)).toBe("1 year in security");
    const p2 = minimalPersonnel({ experience_years: 3 });
    expect(formatExperience(p2)).toBe("3 years in security");
  });

  it("returns only since when set", () => {
    const p = minimalPersonnel({ experience_since_year: 2018 });
    expect(formatExperience(p)).toBe("In security since 2018");
  });

  it("returns — when neither set", () => {
    const p = minimalPersonnel({});
    expect(formatExperience(p)).toBe("—");
  });
});

describe("formatRating", () => {
  it("formats whole number without decimal", () => {
    expect(formatRating(5)).toBe("5");
  });

  it("formats decimal to one place", () => {
    expect(formatRating(4.8)).toBe("4.8");
  });
});

describe("formatRequestDate", () => {
  it("formats ISO date for en-GB", () => {
    const out = formatRequestDate("2026-01-24T19:00:00Z");
    expect(out).toMatch(/\d/);
    expect(out.length).toBeGreaterThan(5);
  });

  it("returns Invalid Date string for unparseable input", () => {
    expect(formatRequestDate("not-a-date")).toBe("Invalid Date");
  });
});

describe("formatTimeRange", () => {
  it("formats start and end time", () => {
    const out = formatTimeRange("2026-01-24T19:00:00Z", "2026-01-25T02:00:00Z");
    expect(out).toMatch(/\d/);
    expect(out).toContain("–");
  });

  it("formats start only when no end", () => {
    const out = formatTimeRange("2026-01-24T19:00:00Z");
    expect(out).toMatch(/\d/);
  });

  it("returns Invalid Date for unparseable input", () => {
    expect(formatTimeRange("invalid")).toBe("Invalid Date");
  });
});
