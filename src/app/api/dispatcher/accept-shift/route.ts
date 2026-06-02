/**
 * Accept Urgent Shift — API Route
 *
 * Called when a standby guard taps "Accept" on an urgent shift notification.
 * Delegates to the dispatcher's assignReplacement() which handles:
 *   - Race condition (first-come-first-served)
 *   - No-show penalty on original guard
 *   - Venue manager notification
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assignReplacement } from "@/lib/dispatcher";
import { validateClaimProximity } from "@/lib/shifts/claimProximity";
import { resolvePersonnelByAuthUser } from "@/lib/auth/resolvePersonnel";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  try {
    // --- Authenticate the requesting user ---
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const key =
      supabaseServiceKey && supabaseServiceKey !== "YOUR_SERVICE_ROLE_KEY_HERE"
        ? supabaseServiceKey
        : supabaseAnonKey;
    const supabase = createClient(supabaseUrl, key);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // --- Parse request body ---
    const body = await request.json();
    const { shift_id, latitude, longitude } = body as {
      shift_id?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!shift_id || typeof shift_id !== "string") {
      return NextResponse.json(
        { error: "shift_id is required" },
        { status: 400 }
      );
    }
    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "latitude and longitude are required to accept this shift" },
        { status: 400 }
      );
    }

    // --- Look up the guard's personnel record ---
    const personnel = (await resolvePersonnelByAuthUser(
      supabase as any,
      user.id,
      "id, is_standby, is_active, is_available",
    )) as {
      id: string;
      is_standby?: boolean | null;
      is_active?: boolean | null;
      is_available?: boolean | null;
    } | null;

    if (!personnel) {
      return NextResponse.json(
        { error: "Personnel profile not found for this user" },
        { status: 404 }
      );
    }

    if (!personnel.is_active || !personnel.is_available) {
      return NextResponse.json(
        { error: "Your account is not currently active/available" },
        { status: 403 }
      );
    }

    const { data: verificationRow } = await supabase
      .from("verifications")
      .select("status")
      .eq("owner_type", "personnel")
      .eq("owner_id", personnel.id)
      .maybeSingle();
    if (verificationRow && (verificationRow as any).status !== "verified") {
      return NextResponse.json(
        { error: "You must complete verification before accepting shifts." },
        { status: 403 }
      );
    }

    const { data: shift } = await supabase
      .from("shifts")
      .select("id, booking_id, status")
      .eq("id", shift_id)
      .single();

    if (!shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    const proximity = await validateClaimProximity({
      supabase: supabase as any,
      bookingId: shift.booking_id,
      personnelId: personnel.id,
      guardLatitude: Number(latitude),
      guardLongitude: Number(longitude),
    });
    if (!proximity.ok) {
      return NextResponse.json(
        {
          error: proximity.error,
          distance_meters: proximity.distance_meters ?? null,
          max_distance_meters: proximity.max_distance_meters ?? null,
          location_restricted: true,
        },
        { status: 422 }
      );
    }

    // --- Assign the replacement (race-condition safe) ---
    const result = await assignReplacement(shift_id, personnel.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 409 } // Conflict — someone else accepted first
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      shift_id: result.shiftId,
      guard_id: result.newGuardId,
      distance_meters: proximity.distance_meters,
      max_distance_meters: proximity.max_distance_meters,
    });
  } catch (error) {
    console.error("[ACCEPT-SHIFT] Error:", error);
    return NextResponse.json(
      { error: "Failed to accept urgent shift" },
      { status: 500 }
    );
  }
}
