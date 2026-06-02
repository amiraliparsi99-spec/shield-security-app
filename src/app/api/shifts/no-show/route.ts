import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { markNoShow } from "@/lib/db/shifts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getAuthUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await admin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  try {
    const sb = await createServerClient();
    const {
      data: { session },
    } = await sb.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { shift_id, notes } = body as { shift_id?: string; notes?: string };

    if (!shift_id) {
      return NextResponse.json({ error: "shift_id is required" }, { status: 400 });
    }

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .select("id, booking_id, status, venue_confirmed")
      .eq("id", shift_id)
      .single();

    if (shiftErr || !shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, venue_id")
      .eq("id", shift.booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { data: venue, error: venueErr } = await supabase
      .from("venues")
      .select("id, user_id, owner_id")
      .eq("id", booking.venue_id)
      .single();

    if (venueErr || !venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    const venueOwnerId = (venue as { user_id?: string | null; owner_id?: string | null }).owner_id
      ?? (venue as { user_id?: string | null }).user_id
      ?? null;

    if (!venueOwnerId || venueOwnerId !== userId) {
      return NextResponse.json(
        { error: "Only the venue owner can mark this shift as no-show" },
        { status: 403 },
      );
    }

    if (shift.venue_confirmed) {
      return NextResponse.json(
        { error: "Cannot mark a confirmed shift as no-show" },
        { status: 400 },
      );
    }

    const result = await markNoShow(supabase as any, shift_id, notes?.trim() || undefined);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to mark no-show" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      shift_id,
      status: result.shift?.status ?? "no_show",
      message: "Shift marked as no-show and Shield Score penalty applied.",
    });
  } catch (error) {
    console.error("[SHIFT-NO-SHOW] Error:", error);
    return NextResponse.json({ error: "Failed to mark no-show" }, { status: 500 });
  }
}

