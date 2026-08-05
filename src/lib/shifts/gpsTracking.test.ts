import { describe, expect, it } from "vitest";
import { isGpsPointLiveForShift, isShiftLiveTrackable } from "./gpsTracking";

const baseShift = {
  personnel_id: "p1",
  status: "checked_in",
  scheduled_start: "2026-07-26T18:00:00.000Z",
  scheduled_end: "2026-07-26T22:00:00.000Z",
};

describe("gpsTracking", () => {
  it("allows tracking during an active checked-in shift", () => {
    const now = new Date("2026-07-26T20:00:00.000Z").getTime();
    expect(isShiftLiveTrackable(baseShift, now)).toBe(true);
  });

  it("blocks tracking more than 60 minutes before start", () => {
    const now = new Date("2026-07-26T16:50:00.000Z").getTime(); // 70 min before 18:00
    expect(isShiftLiveTrackable(baseShift, now)).toBe(false);
  });

  it("blocks tracking a day before start", () => {
    const now = new Date("2026-07-25T18:00:00.000Z").getTime();
    expect(isShiftLiveTrackable(baseShift, now)).toBe(false);
  });

  it("allows tracking within 60 minutes of start", () => {
    const now = new Date("2026-07-26T17:15:00.000Z").getTime(); // 45 min before 18:00
    expect(isShiftLiveTrackable(baseShift, now)).toBe(true);
  });

  it("allows tracking for assigned pending shifts before check-in", () => {
    const now = new Date("2026-07-26T20:00:00.000Z").getTime();
    expect(
      isShiftLiveTrackable({ ...baseShift, status: "pending" }, now),
    ).toBe(true);
  });

  it("blocks tracking for unassigned pending shifts", () => {
    const now = new Date("2026-07-26T20:00:00.000Z").getTime();
    expect(
      isShiftLiveTrackable(
        { ...baseShift, status: "pending", personnel_id: null },
        now,
      ),
    ).toBe(false);
  });

  it("blocks tracking after checkout", () => {
    const now = new Date("2026-07-26T20:00:00.000Z").getTime();
    expect(
      isShiftLiveTrackable({ ...baseShift, status: "checked_out" }, now),
    ).toBe(false);
  });

  it("blocks tracking after scheduled end even if status lagged", () => {
    const now = new Date("2026-07-26T22:30:00.000Z").getTime();
    expect(isShiftLiveTrackable(baseShift, now)).toBe(false);
  });

  it("rejects GPS points recorded after shift end", () => {
    const now = new Date("2026-07-26T21:00:00.000Z").getTime();
    expect(
      isGpsPointLiveForShift(baseShift, "2026-07-26T22:05:00.000Z", now),
    ).toBe(false);
  });
});
