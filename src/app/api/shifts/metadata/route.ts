import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Returns event_name + venue_name for a list of booking IDs that the caller
 * has access to (via shifts they've been offered/assigned, or venues they
 * own/manage). Requires an authenticated user; the service role is only used
 * internally to resolve display strings after the caller's access is proven.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies
            .getAll()
            .map((c) => ({ name: c.name, value: c.value }));
        },
        setAll() {},
      },
    });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { booking_ids } = (await request.json()) as {
      booking_ids?: string[];
    };
    if (!booking_ids || !Array.isArray(booking_ids) || booking_ids.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestedIds = booking_ids.slice(0, 50);

    // Only return metadata for bookings the user can legitimately see:
    //   - venue owner/manager whose venue owns the booking, OR
    //   - personnel assigned to a shift under the booking, OR
    //   - personnel offered a shift under the booking.
    const { data: personnelRow } = await supabase
      .from("personnel")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const personnelId = personnelRow?.id ?? null;

    const allowedBookingIds = new Set<string>();

    const { data: venueBookings } = await supabase
      .from("bookings")
      .select("id, venues!inner(user_id)")
      .in("id", requestedIds);
    if (venueBookings) {
      for (const row of venueBookings as Array<{
        id: string;
        venues?: { user_id?: string } | Array<{ user_id?: string }>;
      }>) {
        const venueRel = Array.isArray(row.venues) ? row.venues[0] : row.venues;
        if (venueRel?.user_id === user.id) allowedBookingIds.add(row.id);
      }
    }

    if (personnelId) {
      const { data: assignedShifts } = await supabase
        .from("shifts")
        .select("booking_id")
        .eq("personnel_id", personnelId)
        .in("booking_id", requestedIds);
      assignedShifts?.forEach((s) => {
        if (s.booking_id) allowedBookingIds.add(s.booking_id);
      });

      const { data: offeredShifts } = await supabase
        .from("shift_offers")
        .select("shift_id, shifts!inner(booking_id)")
        .eq("personnel_id", personnelId);
      offeredShifts?.forEach((row: any) => {
        const b = Array.isArray(row.shifts)
          ? row.shifts[0]?.booking_id
          : row.shifts?.booking_id;
        if (b && requestedIds.includes(b)) allowedBookingIds.add(b);
      });
    }

    if (allowedBookingIds.size === 0) {
      return NextResponse.json({ data: {} });
    }

    const idList = Array.from(allowedBookingIds);

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, event_name, venue_id, site_label, site_address_text, site_latitude, site_longitude",
      )
      .in("id", idList);

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const venueIds = [
      ...new Set(bookings.map((b) => b.venue_id).filter(Boolean)),
    ];
    const venuesMap: Record<
      string,
      { name: string; city: string; address_line1: string | null; postcode: string | null }
    > = {};
    if (venueIds.length > 0) {
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, city, address_line1, postcode")
        .in("id", venueIds);
      venues?.forEach((v) => {
        venuesMap[v.id] = {
          name: v.name,
          city: v.city || "",
          address_line1: v.address_line1 ?? null,
          postcode: v.postcode ?? null,
        };
      });
    }

    const result: Record<
      string,
      {
        event_name: string;
        venue_name: string;
        venue_city: string;
        site_label?: string | null;
        site_address_text?: string | null;
        site_latitude?: number | null;
        site_longitude?: number | null;
        venue_address_line1?: string | null;
        venue_postcode?: string | null;
      }
    > = {};
    for (const b of bookings) {
      const venue = b.venue_id ? venuesMap[b.venue_id] : undefined;
      const siteLabel = (b as { site_label?: string | null }).site_label?.trim();
      const eventName = b.event_name?.trim();
      result[b.id] = {
        event_name: eventName || "Security Shift",
        venue_name: siteLabel || venue?.name || eventName || "Venue",
        venue_city: venue?.city || "",
        site_label: siteLabel ?? null,
        site_address_text:
          (b as { site_address_text?: string | null }).site_address_text ?? null,
        site_latitude:
          (b as { site_latitude?: number | null }).site_latitude ?? null,
        site_longitude:
          (b as { site_longitude?: number | null }).site_longitude ?? null,
        venue_address_line1: venue?.address_line1 ?? null,
        venue_postcode: venue?.postcode ?? null,
      };
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[shifts/metadata] Error:", err);
    return NextResponse.json({ data: {} });
  }
}
