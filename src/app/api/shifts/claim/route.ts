import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateClaimProximity } from "@/lib/shifts/claimProximity";
import { resolvePersonnelByAuthOrProvidedId } from "@/lib/auth/resolvePersonnel";
import { isClaimableOnMarketplace } from "@/lib/shifts/marketplace";
import { withRateLimit } from "@/lib/ratelimit/limiter";

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

    // Claiming races other guards for the same shift, so it is worth scripting.
    // Cap it per user before any lookup work happens.
    const limited = await withRateLimit(request, "booking", user.id);
    if (!limited.success && limited.response) return limited.response;

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
        .select(
          "id, booking_id, personnel_id, status, scheduled_start, scheduled_end, is_urgent, dispatcher_status, cover_search_wave",
        )
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

    const { data: bookingMeta } = await supabase
      .from("bookings")
      .select("status, self_managed")
      .eq("id", shift.booking_id)
      .maybeSingle();

    if (
      !isClaimableOnMarketplace(shift as any, {
        bookingStatus: (bookingMeta as { status?: string } | null)?.status,
        selfManaged: !!(bookingMeta as { self_managed?: boolean } | null)?.self_managed,
      })
    ) {
      const urgent = (shift as any).is_urgent && (shift as any).dispatcher_status === "searching";
      return NextResponse.json(
        {
          error: urgent
            ? "This urgent cover slot is no longer available."
            : "This shift is no longer available to claim. It may have started, been cancelled, or already been filled.",
          code: "shift_not_claimable",
        },
        { status: 409 },
      );
    }

    if (shift.status !== "pending" || shift.personnel_id) {
      return NextResponse.json(
        { error: "This shift has already been claimed by another guard." },
        { status: 409 },
      );
    }

    // Self-managed agency roster shifts are assigned directly by the agency and
    // are NOT open for claiming from the public job board.
    if (bookingMeta && (bookingMeta as any).self_managed) {
        return NextResponse.json(
          {
            error:
              "This shift is scheduled directly by an agency and isn't available to claim from the job board.",
            code: "self_managed_shift",
          },
          { status: 403 },
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
        is_urgent: false,
        dispatcher_status: "none",
        cover_search_wave: 0,
        cover_search_started_at: null,
        cover_search_last_wave_at: null,
      })
      .eq("id", shift_id)
      .eq("status", "pending")
      .is("personnel_id", null)
      .select("id")
      .single();

    // A DB-level error here is NOT a race — it's an unexpected failure (e.g. a
    // trigger raising an exception). Surfacing it as "already claimed" hides
    // real bugs, so distinguish the two cases.
    if (claimErr) {
      console.error("[SHIFT-CLAIM] Update failed:", claimErr.message, "shift:", shift_id);
      return NextResponse.json(
        {
          error: "Couldn't claim this shift due to a server error. Please try again or contact support.",
          code: "claim_update_failed",
          debug: { db_error: claimErr.message, db_code: (claimErr as any).code ?? null },
        },
        { status: 500 },
      );
    }
    if (!updatedShift) {
      // No row matched the pending/unclaimed filter → genuinely taken already.
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
