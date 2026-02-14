import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { partnership_id, accept, custom_commission_rate } = body;

    if (!partnership_id || typeof accept !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: partnership_id, accept (boolean)" },
        { status: 400 }
      );
    }

    const { data: partnership } = await supabase
      .from("venue_agency_partnerships")
      .select("id, agency_id, status, initiated_by")
      .eq("id", partnership_id)
      .single();

    if (!partnership) {
      return NextResponse.json({ error: "Partnership not found" }, { status: 404 });
    }

    if (partnership.status !== "pending") {
      return NextResponse.json({ error: "Partnership is not pending" }, { status: 400 });
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("id", partnership.agency_id)
      .eq("user_id", user.id)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Only the agency can respond to this request" }, { status: 403 });
    }

    const updates: { status: string; responded_at: string; custom_commission_rate?: number } = {
      status: accept ? "active" : "declined",
      responded_at: new Date().toISOString(),
    };
    if (accept && custom_commission_rate != null) {
      updates.custom_commission_rate = Number(custom_commission_rate);
    }

    const { data: updated, error } = await supabase
      .from("venue_agency_partnerships")
      .update(updates)
      .eq("id", partnership_id)
      .select()
      .single();

    if (error) {
      console.error("Partnership respond error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ partnership: updated });
  } catch (err) {
    console.error("Partnership respond:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
