import { describe, it, expect } from "vitest";
import {
  evaluateTravelRisk,
  defaultThresholds,
  adjustThresholdsForShiftType,
  ringSeverity,
  resolveThresholdsFromEnv,
  ruralMultiplierFromEnv,
} from "./travelRisk";

const SITE = { lat: 51.5074, lng: -0.1278 }; // London

const mins = (n: number) => n * 60_000;

/** Build a `now` value relative to a shift starting at `startIso`. */
function nowAt(startIso: string, offsetMs: number): Date {
  return new Date(Date.parse(startIso) + offsetMs);
}

const baseShift = {
  scheduledStartIso: "2025-04-26T10:00:00.000Z",
  status: "accepted",
  site: SITE,
};

describe("evaluateTravelRisk", () => {
  it("returns 'none' outside the eval window", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(120)), // T-2h
      ...baseShift,
      latestGps: null,
    });
    expect(out.ring).toBe("none");
  });

  it("returns 'none' when status is not accepted", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(15)),
      ...baseShift,
      status: "checked_in",
      latestGps: null,
    });
    expect(out.ring).toBe("none");
  });

  it("R6: still accepted past start grace fires regardless of GPS/distance", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, mins(11)),
      ...baseShift,
      latestGps: {
        lat: SITE.lat,
        lng: SITE.lng, // even if standing on the venue
        recorded_at: new Date(Date.parse(baseShift.scheduledStartIso) + mins(11)).toISOString(),
      },
    });
    expect(out.ring).toBe("R6");
  });

  it("R3: at T-30m with no GPS, status unclear", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(30)),
      ...baseShift,
      latestGps: null,
    });
    expect(out.ring).toBe("R3");
    expect(out.reason).toContain("no GPS");
  });

  it("R3: at T-30m, far away (>5km)", () => {
    const farLat = SITE.lat + 0.1; // ~11 km north
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(30)),
      ...baseShift,
      latestGps: {
        lat: farLat,
        lng: SITE.lng,
        recorded_at: new Date(Date.parse(baseShift.scheduledStartIso) - mins(30)).toISOString(),
      },
    });
    expect(out.ring).toBe("R3");
    expect(out.distanceM).toBeGreaterThan(5_000);
  });

  it("R3: clears when guard is within 5km + recent GPS", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(30)),
      ...baseShift,
      latestGps: {
        lat: SITE.lat + 0.01, // ~1.1 km — well inside the 5km R3 threshold
        lng: SITE.lng,
        recorded_at: new Date(Date.parse(baseShift.scheduledStartIso) - mins(30)).toISOString(),
      },
    });
    expect(out.ring).toBe("none");
  });

  it("R4: at T-15m with stale GPS (>10m old)", () => {
    const startIso = baseShift.scheduledStartIso;
    const out = evaluateTravelRisk({
      now: nowAt(startIso, -mins(15)),
      ...baseShift,
      latestGps: {
        lat: SITE.lat + 0.001, // very close
        lng: SITE.lng,
        recorded_at: new Date(Date.parse(startIso) - mins(40)).toISOString(),
      },
    });
    expect(out.ring).toBe("R4");
    expect(out.reason).toContain("last GPS");
  });

  it("R5: at T-5m, >500m away", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(5)),
      ...baseShift,
      latestGps: {
        lat: SITE.lat + 0.01, // ~1.1 km — past the 500m R5 threshold
        lng: SITE.lng,
        recorded_at: new Date(Date.parse(baseShift.scheduledStartIso) - mins(5)).toISOString(),
      },
    });
    expect(out.ring).toBe("R5");
    expect(out.distanceM).toBeGreaterThan(500);
  });

  it("returns the most severe applicable ring (R5 over R3) when multiple apply", () => {
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(5)),
      ...baseShift,
      latestGps: null,
    });
    expect(out.ring).toBe("R5");
  });

  it("ignores low-accuracy GPS for distance, but treats it as a heartbeat", () => {
    // 2 km accuracy => the fix doesn't tell us where the guard actually is.
    // It still proves the guard's phone reported recently though, so the
    // staleness condition is satisfied. With a recent heartbeat AND no usable
    // distance, the engine should not trip a ring on distance grounds.
    const out = evaluateTravelRisk({
      now: nowAt(baseShift.scheduledStartIso, -mins(15)),
      ...baseShift,
      latestGps: {
        lat: SITE.lat + 0.5,
        lng: SITE.lng,
        accuracy_m: 2_000,
        recorded_at: new Date(Date.parse(baseShift.scheduledStartIso) - mins(13)).toISOString(),
      },
    });
    expect(out.ring).toBe("none");
    expect(out.distanceM).toBeNull();
  });

  it("urgent flag shifts every ring 15 min earlier", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, { urgent: true });
    expect(t.r3MinutesBefore).toBe(45);
    expect(t.r4MinutesBefore).toBe(30);
    expect(t.r5MinutesBefore).toBe(20);
  });

  it("multiGuardEvent moves R5 to T+5m (after start)", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, { multiGuardEvent: true });
    expect(t.r5MinutesBefore).toBe(-5);
  });

  it("singleGuardDoor moves R5 to T-15m", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, { singleGuardDoor: true });
    expect(t.r5MinutesBefore).toBe(15);
  });

  it("ringSeverity orders rings monotonically", () => {
    expect(ringSeverity("none")).toBeLessThan(ringSeverity("R3"));
    expect(ringSeverity("R3")).toBeLessThan(ringSeverity("R4"));
    expect(ringSeverity("R4")).toBeLessThan(ringSeverity("R5"));
    expect(ringSeverity("R5")).toBeLessThan(ringSeverity("R6"));
  });

  it("default distance cascade is 5/2/0.5 km", () => {
    expect(defaultThresholds.r3DistanceM).toBe(5_000);
    expect(defaultThresholds.r4DistanceM).toBe(2_000);
    expect(defaultThresholds.r5DistanceM).toBe(500);
  });

  it("rural flag multiplies distance thresholds by default 2.5x", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, { rural: true });
    expect(t.r3DistanceM).toBe(12_500);
    expect(t.r4DistanceM).toBe(5_000);
    expect(t.r5DistanceM).toBe(1_250);
    // Timing thresholds remain unchanged.
    expect(t.r3MinutesBefore).toBe(defaultThresholds.r3MinutesBefore);
    expect(t.r6MinutesAfter).toBe(defaultThresholds.r6MinutesAfter);
  });

  it("rural flag with custom multiplier applies that multiplier", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, {
      rural: true,
      ruralMultiplier: 4,
    });
    expect(t.r3DistanceM).toBe(20_000);
    expect(t.r4DistanceM).toBe(8_000);
    expect(t.r5DistanceM).toBe(2_000);
  });

  it("criticalVenue tier moves R5 to T-20m and R6 to T+5m", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, { criticalVenue: true });
    expect(t.r5MinutesBefore).toBe(20);
    expect(t.r6MinutesAfter).toBe(5);
  });

  it("multiGuardEvent moves R6 from T+10m → T+15m", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, { multiGuardEvent: true });
    expect(t.r6MinutesAfter).toBe(15);
  });

  it("urgent stacks on top of singleGuardDoor", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, {
      singleGuardDoor: true,
      urgent: true,
    });
    expect(t.r5MinutesBefore).toBe(30); // 15 (single-guard) + 15 (urgent)
  });

  it("rural multiplier still applies when other flags are set", () => {
    const t = adjustThresholdsForShiftType(defaultThresholds, {
      singleGuardDoor: true,
      rural: true,
    });
    expect(t.r5MinutesBefore).toBe(15);
    expect(t.r5DistanceM).toBe(1_250);
  });

  describe("resolveThresholdsFromEnv", () => {
    it("falls back to defaults when env is empty", () => {
      const t = resolveThresholdsFromEnv({});
      expect(t).toEqual(defaultThresholds);
    });

    it("applies env distance overrides", () => {
      const t = resolveThresholdsFromEnv({
        TRAVEL_RISK_R3_DISTANCE_M: "10000",
        TRAVEL_RISK_R4_DISTANCE_M: "3000",
        TRAVEL_RISK_R5_DISTANCE_M: "750",
      });
      expect(t.r3DistanceM).toBe(10_000);
      expect(t.r4DistanceM).toBe(3_000);
      expect(t.r5DistanceM).toBe(750);
    });

    it("applies env timing overrides", () => {
      const t = resolveThresholdsFromEnv({
        TRAVEL_RISK_R6_MINUTES_AFTER: "5",
      });
      expect(t.r6MinutesAfter).toBe(5);
    });

    it("ignores invalid env values", () => {
      const t = resolveThresholdsFromEnv({
        TRAVEL_RISK_R3_DISTANCE_M: "not-a-number",
        TRAVEL_RISK_R4_DISTANCE_M: "-100",
      });
      expect(t.r3DistanceM).toBe(defaultThresholds.r3DistanceM);
      expect(t.r4DistanceM).toBe(defaultThresholds.r4DistanceM);
    });
  });

  describe("ruralMultiplierFromEnv", () => {
    it("defaults to 2.5", () => {
      expect(ruralMultiplierFromEnv({})).toBe(2.5);
    });

    it("reads override from env", () => {
      expect(ruralMultiplierFromEnv({ TRAVEL_RISK_RURAL_MULTIPLIER: "3" })).toBe(3);
    });

    it("ignores invalid values", () => {
      expect(ruralMultiplierFromEnv({ TRAVEL_RISK_RURAL_MULTIPLIER: "0" })).toBe(2.5);
      expect(ruralMultiplierFromEnv({ TRAVEL_RISK_RURAL_MULTIPLIER: "abc" })).toBe(2.5);
    });
  });
});
