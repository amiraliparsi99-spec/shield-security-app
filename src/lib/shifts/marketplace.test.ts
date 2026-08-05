import { describe, expect, it } from "vitest";
import {
  isActiveUrgentCover,
  isClaimableOnMarketplace,
  isShiftInProgress,
  remainingMinutes,
} from "./marketplace";

const now = new Date("2026-07-26T19:40:00.000Z").getTime();

describe("marketplace", () => {
  it("hides in-progress shifts that are not urgent cover", () => {
    expect(
      isClaimableOnMarketplace(
        {
          status: "pending",
          personnel_id: null,
          scheduled_start: "2026-07-26T18:00:00.000Z",
          scheduled_end: "2026-07-26T20:00:00.000Z",
        },
        { nowMs: now },
      ),
    ).toBe(false);
  });

  it("shows future unassigned pending shifts", () => {
    expect(
      isClaimableOnMarketplace(
        {
          status: "pending",
          personnel_id: null,
          scheduled_start: "2026-07-27T18:00:00.000Z",
          scheduled_end: "2026-07-27T20:00:00.000Z",
        },
        { nowMs: now },
      ),
    ).toBe(true);
  });

  it("shows active urgent cover during an in-progress window", () => {
    expect(
      isActiveUrgentCover(
        {
          status: "pending",
          personnel_id: null,
          scheduled_start: "2026-07-26T18:00:00.000Z",
          scheduled_end: "2026-07-26T20:00:00.000Z",
          is_urgent: true,
          dispatcher_status: "searching",
          cover_search_wave: 1,
        },
        now,
      ),
    ).toBe(true);

    expect(
      isClaimableOnMarketplace(
        {
          status: "pending",
          personnel_id: null,
          scheduled_start: "2026-07-26T18:00:00.000Z",
          scheduled_end: "2026-07-26T20:00:00.000Z",
          is_urgent: true,
          dispatcher_status: "searching",
          cover_search_wave: 1,
        },
        { nowMs: now },
      ),
    ).toBe(true);
  });

  it("hides cancelled bookings and cancelled shifts", () => {
    expect(
      isClaimableOnMarketplace(
        {
          status: "cancelled",
          personnel_id: null,
          scheduled_start: "2026-07-27T18:00:00.000Z",
          scheduled_end: "2026-07-27T20:00:00.000Z",
        },
        { nowMs: now },
      ),
    ).toBe(false);

    expect(
      isClaimableOnMarketplace(
        {
          status: "pending",
          personnel_id: null,
          scheduled_start: "2026-07-27T18:00:00.000Z",
          scheduled_end: "2026-07-27T20:00:00.000Z",
        },
        { bookingStatus: "cancelled", nowMs: now },
      ),
    ).toBe(false);
  });

  it("detects in-progress window", () => {
    expect(
      isShiftInProgress(
        {
          scheduled_start: "2026-07-26T18:00:00.000Z",
          scheduled_end: "2026-07-26T20:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
    expect(remainingMinutes("2026-07-26T20:00:00.000Z", now)).toBe(20);
  });
});
