/**
 * Agency booking update — edit event details, brief, site location, and times.
 * PATCH /api/agency/bookings/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  resolveAgencyBookingContext,
  scheduledRangeFromBooking,
} from "@/lib/agency/bookingAccess";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const EDITABLE_STATUSES = new Set(["pending", "confirmed"]);

type PatchBody = {
  event_name?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  brief_notes?: string | null;
  site_label?: string | null;
  site_address_text?: string | null;
  site_latitude?: number | null;
  site_longitude?: number | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ctx = await resolveAgencyBookingContext(supabase, user.id, bookingId);
    if (!ctx) {
      return NextResponse.json({ error: "Booking not found or access denied" }, { status: 403 });
    }

    if (ctx.access !== "owner") {
      return NextResponse.json(
        { error: "Only the agency that created this booking can edit its details." },
        { status: 403 },
      );
    }

    if (!EDITABLE_STATUSES.has(ctx.booking.status)) {
      return NextResponse.json(
        { error: `Cannot edit a booking with status "${ctx.booking.status}".` },
        { status: 400 },
      );
    }

    const body = (await request.json()) as PatchBody;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.event_name !== undefined) updates.event_name = body.event_name.trim();
    if (body.event_date !== undefined) updates.event_date = body.event_date;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    if (body.end_time !== undefined) updates.end_time = body.end_time;
    if (body.brief_notes !== undefined) updates.brief_notes = body.brief_notes;
    if (body.site_label !== undefined) updates.site_label = body.site_label;
    if (body.site_address_text !== undefined) updates.site_address_text = body.site_address_text;
    if (body.site_latitude !== undefined) updates.site_latitude = body.site_latitude;
    if (body.site_longitude !== undefined) updates.site_longitude = body.site_longitude;

    const eventDate = (body.event_date ?? ctx.booking.event_date) as string;
    const startTime = (body.start_time ?? ctx.booking.start_time) as string;
    const endTime = (body.end_time ?? ctx.booking.end_time) as string;
    const timesChanged =
      body.event_date !== undefined ||
      body.start_time !== undefined ||
      body.end_time !== undefined;

    if (timesChanged) {
      const { scheduledEnd } = scheduledRangeFromBooking(eventDate, startTime, endTime);
      if (scheduledEnd.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Shift end time must be in the future." },
          { status: 400 },
        );
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", bookingId)
      .select("*")
      .single();

    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message ?? "Update failed" }, { status: 500 });
    }

    if (timesChanged) {
      const { scheduledStart, scheduledEnd } = scheduledRangeFromBooking(
        eventDate,
        startTime,
        endTime,
      );
      await supabase
        .from("shifts")
        .update({
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("booking_id", bookingId)
        .in("status", ["pending", "accepted", "offered"]);
    }

    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    console.error("[agency/bookings PATCH]", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
