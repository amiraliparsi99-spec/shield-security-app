import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateClaimProximity } from "@/lib/shifts/claimProximity";
import { resolvePersonnelByAuthOrProvidedId } from "@/lib/auth/resolvePersonnel";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
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
    const { shift_id, latitude, longitude, personnel_id } = body as {
      shift_id?: string;
      latitude?: number;
      longitude?: number;
      personnel_id?: string;
    };

    if (!shift_id || typeof shift_id !== "string") {
      return NextResponse.json({ error: "shift_id is required" }, { status: 400 });
    }
    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "latitude and longitude are required to claim shifts" },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const personnel = await resolvePersonnelByAuthOrProvidedId(
      supabase as any,
      user.id,
      "id",
      personnel_id ?? null,
    );
    if (!personnel) {
      // Gather diagnostic state so the mobile app / logs can surface a useful hint.
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, role")
        .or(`id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle();

      const role = (profileRow as any)?.role ?? null;
      const hint = !profileRow
        ? "No profile row exists for this auth user. Please sign up again or contact support."
        : role && role !== "personnel"
          ? `This account is registered as '${role}'. Only personnel accounts can claim shifts.`
          : "Personnel record could not be created automatically. Please contact support.";

      return NextResponse.json(
        {
          error: hint,
          code: "personnel_not_found",
          debug: {
            auth_user_id: user.id,
            profile_found: !!profileRow,
            profile_id: (profileRow as any)?.id ?? null,
            profile_role: role,
            provided_personnel_id: personnel_id ?? null,
            resolver_state:
              (globalThis as any).__lastResolvePersonnelState ?? null,
            insert_error: (globalThis as any).__lastResolvePersonnelError ?? null,
            insert_error_fallback:
              (globalThis as any).__lastResolvePersonnelError2 ?? null,
          },
        },
        { status: 404 },
      );
    }
    // Verification lookup and shift lookup are independent — fire in parallel
    // to shave one round-trip off the hot path.
    const [verifRes, shiftRes] = await Promise.all([
      supabase
        .from("verifications")
        .select("status")
        .eq("owner_type", "personnel")
        .eq("owner_id", personnel.id)
        .maybeSingle(),
      supabase
        .from("shifts")
        .select("id, booking_id, personnel_id, status")
        .eq("id", shift_id)
        .single(),
    ]);

    const verificationRow = verifRes.data;
    if (verificationRow && (verificationRow as any).status !== "verified") {
      return NextResponse.json(
        { error: "You must complete verification before accepting shifts." },
        { status: 403 },
      );
    }

    const shift = shiftRes.data;
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    if (shift.status !== "pending" || shift.personnel_id) {
      return NextResponse.json(
        { error: "This shift has already been claimed by another guard." },
        { status: 409 },
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
          debug: {
            guard_coords: proximity.guard_coords ?? null,
            venue_coords: proximity.venue_coords ?? null,
          },
        },
        { status: 422 },
      );
    }

    const nowIso = new Date().toISOString();
    const { data: updatedShift, error: claimErr } = await supabase
      .from("shifts")
      .update({
        personnel_id: personnel.id,
        status: "accepted",
        accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", shift_id)
      .eq("status", "pending")
      .is("personnel_id", null)
      .select("id")
      .single();

    if (claimErr || !updatedShift) {
      return NextResponse.json(
        { error: "This shift has already been claimed by another guard." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Shift claimed successfully",
      shift_id,
      distance_meters: proximity.distance_meters,
      max_distance_meters: proximity.max_distance_meters,
    });
  } catch (error) {
    console.error("[SHIFT-CLAIM] Error:", error);
    return NextResponse.json({ error: "Failed to claim shift" }, { status: 500 });
  }
}
