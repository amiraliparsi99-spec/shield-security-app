/**
 * Agency shift update — edit times, role, and rate for a shift slot.
 * PATCH /api/agency/shifts/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAgencyShiftContext } from "@/lib/agency/bookingAccess";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const EDITABLE_SHIFT_STATUSES = new Set(["pending", "accepted", "offered"]);

type PatchBody = {
  scheduled_start?: string;
  scheduled_end?: string;
  role?: string;
  hourly_rate?: number;
  brief_notes?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shiftId } = await params;
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

    const body = (await request.json()) as PatchBody;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ctx = await resolveAgencyShiftContext(supabase, user.id, shiftId);
    if (!ctx) {
      return NextResponse.json({ error: "Shift not found or access denied" }, { status: 403 });
    }

    if (ctx.access === "assigned" && ctx.shift.agency_id !== ctx.agency.id) {
      return NextResponse.json({ error: "You can only edit shifts your agency is providing." }, { status: 403 });
    }

    if (!EDITABLE_SHIFT_STATUSES.has(ctx.shift.status)) {
      return NextResponse.json(
        { error: `Cannot edit a shift with status "${ctx.shift.status}".` },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.scheduled_start !== undefined) updates.scheduled_start = body.scheduled_start;
    if (body.scheduled_end !== undefined) updates.scheduled_end = body.scheduled_end;
    if (body.role !== undefined) updates.role = body.role;
    if (body.hourly_rate !== undefined) updates.hourly_rate = body.hourly_rate;

    if (body.scheduled_end) {
      if (new Date(body.scheduled_end).getTime() <= Date.now()) {
        return NextResponse.json({ error: "Shift end must be in the future." }, { status: 400 });
      }
    }

    const { data: shift, error: updErr } = await supabase
      .from("shifts")
      .update(updates)
      .eq("id", shiftId)
      .select("*")
      .single();

    if (updErr || !shift) {
      return NextResponse.json({ error: updErr?.message ?? "Update failed" }, { status: 500 });
    }

    if (body.brief_notes !== undefined && ctx.access === "owner") {
      await supabase
        .from("bookings")
        .update({ brief_notes: body.brief_notes, updated_at: new Date().toISOString() })
        .eq("id", ctx.booking.id);
    }

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error("[agency/shifts PATCH]", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}
