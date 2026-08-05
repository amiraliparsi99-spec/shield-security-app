/**
 * Update a booking's on-site geofence boundary.
 *
 * Authorizes by relationship rather than broad table RLS: the caller must be
 * either the venue that owns the booking or the agency assigned to provide it.
 * Writes happen with the service-role client after that check passes, so we can
 * let agencies edit `bookings.site_geofence_polygon` without granting them a
 * blanket UPDATE policy on bookings.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isValidPolygon, polygonCentroid } from "@/lib/geo/polygon";
import { userOwnsBooking, type BookingOwner } from "@/lib/booking/ownership";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) return user;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function userCanEditBookingGeofence(
  userId: string,
  booking: BookingOwner,
): Promise<boolean> {
  return userOwnsBooking(supabaseAdmin, userId, booking);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params;

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { polygon?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const polygon = body.polygon ?? null;
  if (polygon !== null && !isValidPolygon(polygon)) {
    return NextResponse.json(
      { error: "polygon must be a valid GeoJSON Polygon or null" },
      { status: 400 },
    );
  }

  const { data: booking, error: bookingErr } = await supabaseAdmin
    .from("bookings")
    .select("id, venue_id, agency_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const allowed = await userCanEditBookingGeofence(
    user.id,
    booking as { venue_id: string | null; agency_id?: string | null },
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have access to this booking" },
      { status: 403 },
    );
  }

  const { error: updErr } = await supabaseAdmin
    .from("bookings")
    .update({ site_geofence_polygon: polygon })
    .eq("id", bookingId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    polygon,
    centroid: polygon ? polygonCentroid(polygon) : null,
  });
}
