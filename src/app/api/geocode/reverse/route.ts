import { NextRequest, NextResponse } from "next/server";

type MapboxFeature = {
  place_name: string;
  text?: string;
  place_type?: string[];
};

/**
 * Reverse geocode coordinates → readable place name (Mapbox).
 * GET /api/geocode/reverse?lat=52.01&lng=-0.81
 */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const token =
    process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { place_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, fallback: true },
    );
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${new URLSearchParams(
    {
      access_token: token,
      limit: "1",
      types: "address,poi,place,locality,neighborhood,district,postcode",
    },
  ).toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { place_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, fallback: true },
      );
    }
    const data = (await res.json()) as { features?: MapboxFeature[] };
    const feature = data.features?.[0];
    if (!feature?.place_name) {
      return NextResponse.json(
        { place_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, fallback: true },
      );
    }

    return NextResponse.json({
      place_name: feature.place_name,
      label: feature.text ?? feature.place_name.split(",")[0] ?? "",
      fallback: false,
    });
  } catch {
    return NextResponse.json(
      { place_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, fallback: true },
    );
  }
}
