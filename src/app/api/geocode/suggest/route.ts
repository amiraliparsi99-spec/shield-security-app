import { NextRequest, NextResponse } from "next/server";

type MapboxContextItem = {
  id: string;
  text: string;
  short_code?: string;
};
type MapboxFeature = {
  id: string;
  place_name: string;
  place_type?: string[];
  text?: string;
  address?: string | number;
  center: [number, number];
  context?: MapboxContextItem[];
  /** Present on top-level `country` features — Mapbox puts the ISO code
   *  here rather than in `context`. */
  properties?: { short_code?: string };
};

type SuggestionResult = {
  id: string;
  place_name: string;
  center: [number, number];
  address_line1: string;
  city: string;
  postcode: string;
  place_type: string;
  /** ISO 3166-1 alpha-2 (e.g. "gb", "lu", "us"). Empty when Mapbox couldn't
   *  determine a country, which is rare. */
  country_code: string;
  country_name: string;
};

/**
 * Extract structured address parts from a Mapbox feature. Works for any
 * country — UK-specific concepts (e.g. postcode) are still populated when
 * available but gracefully empty when the country doesn't use them.
 */
function extractParts(f: MapboxFeature): {
  address_line1: string;
  city: string;
  postcode: string;
  country_code: string;
  country_name: string;
} {
  const ctx = f.context ?? [];
  const findCtx = (prefix: string): string => {
    const item = ctx.find((c) => c.id.startsWith(prefix));
    return item?.text?.trim() ?? "";
  };
  const findCtxShortCode = (prefix: string): string => {
    const item = ctx.find((c) => c.id.startsWith(prefix));
    return item?.short_code?.trim().toLowerCase() ?? "";
  };

  const primaryType = f.place_type?.[0] ?? "";
  let address_line1 = "";

  if (primaryType === "address") {
    const num = f.address?.toString().trim() ?? "";
    const street = f.text?.trim() ?? "";
    address_line1 = [num, street].filter(Boolean).join(" ");
  } else if (
    primaryType === "poi" ||
    primaryType === "place" ||
    primaryType === "locality" ||
    primaryType === "neighborhood" ||
    primaryType === "district"
  ) {
    address_line1 = f.text?.trim() ?? "";
  } else if (primaryType === "postcode") {
    address_line1 = "";
  } else {
    address_line1 = (f.place_name.split(",")[0] ?? "").trim();
  }

  const city =
    findCtx("place.") ||
    findCtx("locality.") ||
    findCtx("district.") ||
    "";

  const postcode =
    primaryType === "postcode"
      ? f.text?.trim() ?? ""
      : findCtx("postcode.");

  // Country is sometimes in context (for sub-country features) and sometimes
  // the feature itself (for a country search). Handle both.
  const country_name =
    findCtx("country.") ||
    (primaryType === "country" ? f.text?.trim() ?? "" : "");
  const country_code =
    findCtxShortCode("country.") ||
    (primaryType === "country"
      ? f.properties?.short_code?.trim().toLowerCase() ?? ""
      : "");

  return { address_line1, city, postcode, country_code, country_name };
}

const DEFAULT_TYPES =
  "address,place,postcode,district,locality,neighborhood,poi";
const ALLOWED_TYPES = new Set([
  "address",
  "place",
  "postcode",
  "district",
  "locality",
  "neighborhood",
  "poi",
  "region",
  "country",
]);

/** Sanitise a user-supplied types string against the Mapbox allowlist. */
function sanitiseTypes(raw: string | null): string {
  if (!raw) return DEFAULT_TYPES;
  const cleaned = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => ALLOWED_TYPES.has(t));
  return cleaned.length > 0 ? cleaned.join(",") : DEFAULT_TYPES;
}

/** Accepts "lng,lat" in standard Mapbox format. Returns "" if invalid. */
function sanitiseProximity(raw: string | null): string {
  if (!raw) return "";
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 2) return "";
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return "";
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return "";
  return `${lng},${lat}`;
}

/** Accepts a comma-separated list of ISO 3166-1 alpha-2 codes, e.g.
 *  "gb" or "gb,lu,fr". Empty string means worldwide search. */
function sanitiseCountry(raw: string | null): string {
  if (!raw) return "";
  const codes = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[a-z]{2}$/.test(c));
  return codes.join(",");
}

/**
 * Forward geocode (address → coordinates) for venue booking pins.
 * Returns up to 8 UK-only suggestions with structured address parts so the
 * frontend can populate address_line1 / city / postcode fields automatically.
 *
 * Query params:
 * - q: search text (required, min 3 chars)
 * - types: Mapbox feature types, comma-separated (defaults to a broad set)
 * - proximity: "lng,lat" to bias results near a point (for postcode drill-down)
 * - country: ISO 3166-1 alpha-2 code(s), comma-separated, to restrict search
 *   (e.g. "gb", "gb,lu"). Omit / leave blank for worldwide.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ results: [] as SuggestionResult[] });
  }

  const token =
    process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Geocoding is not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN (or MAPBOX_ACCESS_TOKEN) in .env.local.",
      },
      { status: 503 },
    );
  }

  const types = sanitiseTypes(request.nextUrl.searchParams.get("types"));
  const proximity = sanitiseProximity(
    request.nextUrl.searchParams.get("proximity"),
  );
  const country = sanitiseCountry(request.nextUrl.searchParams.get("country"));

  const path = encodeURIComponent(q);
  const params = new URLSearchParams({
    access_token: token,
    limit: "8",
    types,
    autocomplete: "true",
  });
  // Only constrain to a country (or countries) when explicitly requested.
  // Omitting this param searches worldwide.
  if (country) params.set("country", country);
  if (proximity) params.set("proximity", proximity);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { features?: MapboxFeature[] };

  const results: SuggestionResult[] = (data.features ?? []).map((f) => {
    const parts = extractParts(f);
    return {
      id: f.id,
      place_name: f.place_name,
      center: f.center,
      address_line1: parts.address_line1,
      city: parts.city,
      postcode: parts.postcode,
      place_type: f.place_type?.[0] ?? "",
      country_code: parts.country_code,
      country_name: parts.country_name,
    };
  });

  return NextResponse.json({ results });
}
