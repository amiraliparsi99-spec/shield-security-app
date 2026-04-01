import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Returns event_name + venue_name for a list of booking IDs.
 * Uses service role so RLS doesn't block personnel from seeing booking details.
 */
export async function POST(request: NextRequest) {
  try {
    const { booking_ids } = (await request.json()) as { booking_ids?: string[] };
    if (!booking_ids || !Array.isArray(booking_ids) || booking_ids.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, event_name, venue_id")
      .in("id", booking_ids.slice(0, 50));

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const venueIds = [...new Set(bookings.map((b) => b.venue_id).filter(Boolean))];
    let venuesMap: Record<string, { name: string; city: string }> = {};

    if (venueIds.length > 0) {
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, city")
        .in("id", venueIds);
      if (venues) {
        venues.forEach((v) => {
          venuesMap[v.id] = { name: v.name, city: v.city || "" };
        });
      }
    }

    const result: Record<string, { event_name: string; venue_name: string; venue_city: string }> = {};
    for (const b of bookings) {
      const venue = venuesMap[b.venue_id] || { name: "Venue", city: "" };
      result[b.id] = {
        event_name: b.event_name || "Security Shift",
        venue_name: venue.name,
        venue_city: venue.city,
      };
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[shifts/metadata] Error:", err);
    return NextResponse.json({ data: {} });
  }
}
