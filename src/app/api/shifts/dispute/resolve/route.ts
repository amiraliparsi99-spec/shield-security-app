import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { applyDisputeResolvedForVenuePenalty } from "@/lib/shifts/shieldScoreEvents";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      shift_id,
      resolution,
      note,
    }: {
      shift_id?: string;
      resolution?: "resolved_for_venue" | "resolved_for_guard";
      note?: string;
    } = body;

    if (!shift_id || !resolution) {
      return NextResponse.json(
        { error: "shift_id and resolution are required" },
        { status: 400 },
      );
    }

    const { data: shift } = await supabase
      .from("shifts")
      .select("id, personnel_id, dispute_status")
      .eq("id", shift_id)
      .single();

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    await supabase
      .from("shifts")
      .update({
        dispute_status: resolution,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", shift_id);

    if (resolution === "resolved_for_venue" && shift.personnel_id) {
      await applyDisputeResolvedForVenuePenalty({
        supabase: supabase as any,
        shiftId: shift_id,
        personnelId: shift.personnel_id,
      });
    }

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "system",
      title: "Dispute resolved",
      body: `Shift ${shift_id} marked as ${resolution}.${note ? ` Note: ${note}` : ""}`,
      data: { shift_id, resolution, note: note ?? null },
      is_read: false,
    } as any);

    return NextResponse.json({ success: true, shift_id, resolution });
  } catch (error) {
    console.error("[DISPUTE-RESOLVE] Error:", error);
    return NextResponse.json({ error: "Failed to resolve dispute" }, { status: 500 });
  }
}

