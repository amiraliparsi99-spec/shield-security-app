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
    const { shift_id } = body as { shift_id?: string };

    if (!shift_id || typeof shift_id !== "string") {
      return NextResponse.json(
        { error: "shift_id is required" },
        { status: 400 }
      );
    }

    // --- Look up the guard's personnel record ---
    const { data: personnel, error: personnelErr } = await supabase
      .from("personnel")
      .select("id, is_standby, is_active, is_available")
      .eq("user_id", user.id)
      .single();

    if (personnelErr || !personnel) {
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
    });
  } catch (error) {
    console.error("[ACCEPT-SHIFT] Error:", error);
    return NextResponse.json(
      { error: "Failed to accept urgent shift" },
      { status: 500 }
    );
  }
}
