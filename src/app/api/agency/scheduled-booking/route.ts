/**
 * Agency Shift Scheduler — create a self-managed (no-escrow) booking + shifts.
 *
 * An agency schedules its own roster work here. There is NO Stripe payment:
 * the agency pays its own staff, so the booking is marked `self_managed` and
 * its shifts start unassigned (`personnel_id = null`, status `pending`) ready
 * to be assigned to roster guards via /api/agency/assign-shift.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Build an ISO timestamp from a yyyy-mm-dd date + HH:mm time. */
function toIso(date: string, time: string): string {
  // Times are wall-clock; construct a local Date then serialise to ISO.
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const {
      event_name,
      date,
      start_time,
      end_time,
      location_text,
      site_label,
      site_latitude,
      site_longitude,
      role,
      hourly_rate,
      count,
      notes,
    } = body as {
      event_name?: string;
      date?: string;
      start_time?: string;
      end_time?: string;
      location_text?: string;
      site_label?: string;
      site_latitude?: number;
      site_longitude?: number;
      role?: string;
      hourly_rate?: number;
      count?: number;
      notes?: string;
    };

    if (!event_name || !date || !start_time || !end_time || !role) {
      return NextResponse.json(
        { error: "event_name, date, start_time, end_time and role are required" },
        { status: 400 },
      );
    }
    const rate = Number(hourly_rate);
    const slots = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: "A valid hourly_rate is required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve the caller's agency.
    const { data: agency } = await supabase
      .from("agencies")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!agency) {
      return NextResponse.json(
        { error: "Only agency accounts can schedule shifts." },
        { status: 403 },
      );
    }

    // Derive shift window; roll the end past midnight for overnight shifts.
    const scheduledStart = toIso(date, start_time);
    let scheduledEnd = toIso(date, end_time);
    if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
      scheduledEnd = new Date(new Date(scheduledEnd).getTime() + 24 * 3600 * 1000).toISOString();
    }
    const hours = Math.max(
      0,
      (new Date(scheduledEnd).getTime() - new Date(scheduledStart).getTime()) / 3_600_000,
    );
    const estimatedTotal = Math.round(rate * hours * slots * 100) / 100;
    const siteLabel = site_label || location_text || null;
    const siteLat =
      site_latitude != null && Number.isFinite(Number(site_latitude))
        ? Number(site_latitude)
        : null;
    const siteLng =
      site_longitude != null && Number.isFinite(Number(site_longitude))
        ? Number(site_longitude)
        : null;

    // 1) Booking (self-managed, no escrow).
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .insert({
        agency_id: agency.id,
        self_managed: true,
        status: "confirmed",
        payment_status: "unpaid",
        event_name,
        event_date: date,
        start_time,
        end_time,
        site_label: siteLabel,
        site_address_text: location_text || siteLabel,
        site_latitude: siteLat,
        site_longitude: siteLng,
        brief_notes: notes || null,
        staff_requirements: [{ role, count: slots, rate_pence: Math.round(rate * 100) }],
        estimated_total: estimatedTotal,
        auto_assign: false,
      })
      .select("id")
      .single();

    if (bookingErr || !booking) {
      console.error("[scheduled-booking] booking insert failed:", bookingErr?.message);
      return NextResponse.json(
        { error: "Could not create the scheduled booking.", debug: { db_error: bookingErr?.message } },
        { status: 500 },
      );
    }

    // 2) One unassigned shift per slot.
    const shiftRows = Array.from({ length: slots }, () => ({
      booking_id: booking.id,
      agency_id: agency.id,
      personnel_id: null,
      role,
      hourly_rate: rate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: "pending" as const,
    }));

    const { data: shifts, error: shiftErr } = await supabase
      .from("shifts")
      .insert(shiftRows)
      .select("id, role, hourly_rate, scheduled_start, scheduled_end, status, personnel_id, booking_id");

    if (shiftErr) {
      console.error("[scheduled-booking] shift insert failed:", shiftErr.message);
      // Roll back the booking so we don't leave an empty shell.
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json(
        { error: "Could not create the shifts for this booking.", debug: { db_error: shiftErr.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      shifts: shifts ?? [],
    });
  } catch (error) {
    console.error("[scheduled-booking] Error:", error);
    return NextResponse.json({ error: "Failed to create scheduled booking" }, { status: 500 });
  }
}
