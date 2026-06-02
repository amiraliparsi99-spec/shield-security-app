import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertMissionControlSystemMessage } from "@/lib/mission-control/shiftReminders";
import { isMissingColumnError } from "@/lib/postgresErrors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type ConfirmLocation = {
  lat?: number;
  lng?: number;
  accuracy_m?: number;
  recorded_at?: string;
};

/**
 * Coerce a freeform location payload into a tight jsonb shape, dropping
 * anything we don't recognise. Returns null if there's nothing usable.
 */
function sanitiseLocation(raw: unknown): ConfirmLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lat = typeof r.lat === "number" ? r.lat : typeof r.latitude === "number" ? r.latitude : null;
  const lng = typeof r.lng === "number" ? r.lng : typeof r.longitude === "number" ? r.longitude : null;
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracy =
    typeof r.accuracy_m === "number"
      ? r.accuracy_m
      : typeof r.accuracy === "number"
        ? r.accuracy
        : undefined;
  const recordedAt =
    typeof r.recorded_at === "string"
      ? r.recorded_at
      : typeof r.timestamp === "string"
        ? r.timestamp
        : new Date().toISOString();
  return { lat, lng, accuracy_m: accuracy, recorded_at: recordedAt };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shift_id, response, location } = body as {
      shift_id?: string;
      response?: "can_make_it";
      location?: unknown;
    };

    if (!shift_id) {
      return NextResponse.json({ error: "shift_id is required" }, { status: 400 });
    }
    if (response !== "can_make_it") {
      return NextResponse.json({ error: "Invalid response type" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select(
        "id, booking_id, personnel_id, status, scheduled_start, role, attendance_confirmed_at",
      )
      .eq("id", shift_id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    if (shift.status !== "accepted") {
      return NextResponse.json(
        { error: `Cannot confirm attendance for status '${shift.status}'` },
        { status: 400 },
      );
    }
    if (!shift.personnel_id) {
      return NextResponse.json({ error: "Shift has no assigned guard" }, { status: 400 });
    }

    const [personnelRes, bookingRes, groupChatRes] = await Promise.all([
      supabase
        .from("personnel")
        .select("id, user_id, display_name, first_name, last_name")
        .eq("id", shift.personnel_id)
        .single(),
      supabase
        .from("bookings")
        .select("id, venue_id, event_name, venues(id, user_id)")
        .eq("id", shift.booking_id)
        .single(),
      supabase
        .from("group_chats")
        .select("id")
        .eq("booking_id", shift.booking_id)
        .eq("chat_type", "mission_control")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    const personnel = personnelRes.data;
    if (!personnel || personnel.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to confirm this shift" },
        { status: 403 },
      );
    }

    const booking = bookingRes.data;
    if (!booking?.venue_id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const venue: any = Array.isArray((booking as any).venues)
      ? (booking as any).venues[0]
      : (booking as any).venues;
    if (!venue?.user_id) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // --- Persist the confirm to the shift row (the accountability anchor) ---
    // If the column doesn't exist yet (migration 0054 not applied), fall back
    // gracefully so we don't break the user-facing flow during rollout.
    const wasAlreadyConfirmed = !!(shift as any).attendance_confirmed_at;
    const sanitisedLocation = sanitiseLocation(location);
    const nowIso = new Date().toISOString();

    if (!wasAlreadyConfirmed) {
      const updatePayload: Record<string, unknown> = {
        attendance_confirmed_at: nowIso,
      };
      if (sanitisedLocation) {
        updatePayload.attendance_confirm_location = sanitisedLocation;
      }
      const { error: updateError } = await supabase
        .from("shifts")
        .update(updatePayload)
        .eq("id", shift.id);
      if (updateError && !isMissingColumnError(updateError)) {
        console.error("[attendance-confirm] DB persist failed:", updateError);
        // Non-fatal: still post the MC message so the venue sees the confirm.
      }
    }

    const groupChat = groupChatRes.data;
    if (!groupChat?.id) {
      return NextResponse.json({
        success: true,
        message: "Confirmed (no mission control chat found)",
      });
    }

    // If we already posted the confirm message before, don't double-post on
    // a re-tap (e.g. after reinstall before the local DB read takes over).
    if (wasAlreadyConfirmed) {
      return NextResponse.json({ success: true, message: "Already confirmed" });
    }

    const guardName =
      personnel.display_name?.trim() ||
      `${personnel.first_name ?? ""} ${personnel.last_name ?? ""}`.trim() ||
      "The guard";

    const scheduledTime = new Date(shift.scheduled_start).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const inserted = await insertMissionControlSystemMessage({
      supabase: supabase as any,
      groupChatId: groupChat.id,
      senderId: venue.user_id,
      content:
        `✅ **Guard confirmed attendance**\n\n` +
        `${guardName} confirmed within 2 hours that they can make the shift ` +
        `(${shift.role || "Security"} at ${scheduledTime}).`,
      metadata: {
        type: "shift_attendance_confirmed_2h",
        shift_id: shift.id,
        booking_id: shift.booking_id,
        personnel_id: shift.personnel_id,
        attendance_response: "can_make_it",
        confirmed_with_location: !!sanitisedLocation,
      },
    });

    if (!inserted) {
      return NextResponse.json({ error: "Failed to post Mission Control update" }, { status: 500 });
    }

    return NextResponse.json({ success: true, confirmed_at: nowIso });
  } catch (error: any) {
    console.error("[attendance-confirm] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
