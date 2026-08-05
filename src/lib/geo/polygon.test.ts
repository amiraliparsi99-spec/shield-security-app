import { describe, it, expect } from "vitest";
import {
  outerRing,
  isValidPolygon,
  pointInPolygon,
  polygonCentroid,
  distanceToPolygonMeters,
  isWithinGeofence,
  type GeoJsonPolygon,
} from "./polygon";

// A ~1.1km square around London (coordinates in [lng, lat] GeoJSON order).
const SQUARE: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-0.135, 51.5024],
      [-0.12, 51.5024],
      [-0.12, 51.5124],
      [-0.135, 51.5124],
      [-0.135, 51.5024],
    ],
  ],
};

const CENTER = { lat: 51.5074, lng: -0.1275 };

describe("outerRing / isValidPolygon", () => {
  it("extracts the ring from a GeoJSON Polygon", () => {
    expect(outerRing(SQUARE)).toHaveLength(5);
    expect(isValidPolygon(SQUARE)).toBe(true);
  });

  it("unwraps a GeoJSON Feature", () => {
    const feature = { type: "Feature", properties: {}, geometry: SQUARE };
    expect(isValidPolygon(feature)).toBe(true);
  });

  it("accepts a bare ring of coordinates", () => {
    expect(isValidPolygon(SQUARE.coordinates[0])).toBe(true);
  });

  it("rejects junk and degenerate rings", () => {
    expect(isValidPolygon(null)).toBe(false);
    expect(isValidPolygon({})).toBe(false);
    expect(isValidPolygon({ type: "Polygon", coordinates: [[[0, 0], [1, 1]]] })).toBe(
      false,
    );
  });
});

describe("pointInPolygon", () => {
  it("returns true for a point at the centre", () => {
    expect(pointInPolygon(CENTER.lat, CENTER.lng, SQUARE)).toBe(true);
  });

  it("returns true for a point near a far corner (the kilometre-away-but-on-site case)", () => {
    // Far side of the square, well over a kilometre from the centre pin.
    expect(pointInPolygon(51.5121, -0.1205, SQUARE)).toBe(true);
  });

  it("returns false for a point clearly outside", () => {
    expect(pointInPolygon(51.52, -0.1, SQUARE)).toBe(false);
  });
});

describe("polygonCentroid", () => {
  it("computes the centroid of the square", () => {
    const c = polygonCentroid(SQUARE);
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(51.5074, 3);
    expect(c!.lng).toBeCloseTo(-0.1275, 3);
  });
});

describe("distanceToPolygonMeters", () => {
  it("is 0 inside the polygon", () => {
    expect(distanceToPolygonMeters(CENTER.lat, CENTER.lng, SQUARE)).toBe(0);
  });

  it("grows with distance from the boundary", () => {
    const near = distanceToPolygonMeters(51.5124 + 0.0002, CENTER.lng, SQUARE);
    const far = distanceToPolygonMeters(51.5124 + 0.002, CENTER.lng, SQUARE);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });
});

describe("isWithinGeofence", () => {
  it("uses polygon mode when a polygon is configured", () => {
    const r = isWithinGeofence({
      lat: 51.5121,
      lng: -0.1205,
      polygon: SQUARE,
      center: CENTER,
      radiusMeters: 100,
      toleranceMeters: 25,
    });
    expect(r.mode).toBe("polygon");
    expect(r.inside).toBe(true);
  });

  it("absorbs GPS jitter near the boundary via tolerance", () => {
    // ~15m outside the northern edge, within a 25m tolerance.
    const justOutsideLat = 51.5124 + 15 / 111_320;
    const r = isWithinGeofence({
      lat: justOutsideLat,
      lng: CENTER.lng,
      polygon: SQUARE,
      toleranceMeters: 25,
    });
    expect(r.mode).toBe("polygon");
    expect(r.inside).toBe(true);
  });

  it("rejects a point far outside the polygon", () => {
    const r = isWithinGeofence({
      lat: 51.52,
      lng: -0.1,
      polygon: SQUARE,
      toleranceMeters: 25,
    });
    expect(r.inside).toBe(false);
    expect(r.distanceMeters).toBeGreaterThan(25);
  });

  it("falls back to radius mode when no polygon is configured", () => {
    const inside = isWithinGeofence({
      lat: 51.5076,
      lng: -0.1275,
      center: CENTER,
      radiusMeters: 500,
    });
    expect(inside.mode).toBe("radius");
    expect(inside.inside).toBe(true);

    const outside = isWithinGeofence({
      lat: 51.52,
      lng: -0.1,
      center: CENTER,
      radiusMeters: 500,
    });
    expect(outside.mode).toBe("radius");
    expect(outside.inside).toBe(false);
  });

  it("treats no geofence as inside", () => {
    const r = isWithinGeofence({ lat: 51.5, lng: -0.1 });
    expect(r.mode).toBe("none");
    expect(r.inside).toBe(true);
  });
});
