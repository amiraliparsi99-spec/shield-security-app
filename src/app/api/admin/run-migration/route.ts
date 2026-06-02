import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminApiSecret = process.env.ADMIN_API_SECRET;

/**
 * Auth gate for this admin/debug route. Requires either:
 *   - ADMIN_API_SECRET bearer token (server-to-server), OR
 *   - a logged-in user whose `profiles.role` is "admin".
 * Returns null on success, NextResponse on failure.
 */
async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get("authorization");
  if (
    adminApiSecret &&
    authHeader &&
    authHeader === `Bearer ${adminApiSecret}`
  ) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Creates shift_offers for all verified guards for a given booking.
 * Uses the service role so RLS is bypassed.
 */
async function createOffersForBooking(bookingId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, event_name, venue_id, start_time, end_time, event_date")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found" };

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, address_line1, city, postcode, latitude, longitude")
    .eq("id", booking.venue_id)
    .single();
  if (!venue) return { error: "Venue not found" };

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, role, hourly_rate, scheduled_start, scheduled_end")
    .eq("booking_id", bookingId)
    .is("personnel_id", null)
    .eq("status", "pending");
  if (!shifts || shifts.length === 0) return { error: "No unassigned shifts" };

  const representativeShift = shifts[0];

  const { data: verifiedGuards } = await supabase
    .from("verifications")
    .select("owner_id")
    .eq("owner_type", "personnel")
    .eq("status", "verified");
  if (!verifiedGuards || verifiedGuards.length === 0) return { error: "No verified guards" };

  const guardIds = verifiedGuards.map((v) => v.owner_id);
  const { data: guards } = await supabase
    .from("personnel")
    .select("id, user_id, latitude, longitude")
    .in("id", guardIds)
    .eq("is_active", true);
  if (!guards || guards.length === 0) return { error: "No active verified guards" };

  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const label = `${booking.event_name || "Security Shift"} @ ${venue.name || "Venue"}`;
  const address = [venue.address_line1, venue.city, venue.postcode].filter(Boolean).join(", ");

  const shiftDate = new Date(representativeShift.scheduled_start).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
  const startTime = new Date(representativeShift.scheduled_start).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
  const endTime = new Date(representativeShift.scheduled_end).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });

  const offerRows = guards.map((g) => ({
    shift_id: representativeShift.id,
    personnel_id: g.id,
    status: "pending",
    hourly_rate: representativeShift.hourly_rate,
    venue_name: label,
    venue_address: address || null,
    venue_latitude: venue.latitude,
    venue_longitude: venue.longitude,
    shift_date: shiftDate,
    start_time: startTime,
    end_time: endTime,
    expires_at: expiresAt,
  }));

  await supabase
    .from("shift_offers")
    .delete()
    .eq("shift_id", representativeShift.id)
    .in("personnel_id", guards.map((g) => g.id))
    .neq("status", "accepted");

  const { data: inserted, error: insertErr } = await supabase
    .from("shift_offers")
    .insert(offerRows)
    .select("id");

  return {
    success: true,
    guards_notified: inserted?.length || 0,
    event_name: booking.event_name,
    venue_name: venue.name,
    label,
    error: insertErr?.message || null,
  };
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  if (body.action === "create_offers" && body.booking_id) {
    const result = await createOffersForBooking(body.booking_id);
    return NextResponse.json(result);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results: string[] = [];

  const { data: bookings } = await supabase.from("bookings").select("id, event_name, venue_id").limit(5);
  results.push(`bookings: ${bookings?.length || 0}`);

  const { data: verified } = await supabase
    .from("verifications")
    .select("owner_id")
    .eq("owner_type", "personnel")
    .eq("status", "verified");
  results.push(`verified guards: ${verified?.length || 0}`);

  const { data: offers } = await supabase
    .from("shift_offers")
    .select("id, personnel_id, venue_name, status, expires_at")
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .limit(10);
  results.push(`active pending offers: ${offers?.length || 0}`);

  const { data: openShifts } = await supabase
    .from("shifts")
    .select("id, booking_id")
    .is("personnel_id", null)
    .eq("status", "pending")
    .limit(10);
  results.push(`open shifts: ${openShifts?.length || 0}`);

  return NextResponse.json({ results, bookings, verified, offers, openShifts });
}
