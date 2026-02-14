import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const as = searchParams.get("as"); // "venue" | "agency"

    if (!as || !["venue", "agency"].includes(as)) {
      return NextResponse.json(
        { error: "Query param 'as' required: venue or agency" },
        { status: 400 }
      );
    }

    if (as === "venue") {
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!venue) {
        return NextResponse.json({ partnerships: [] });
      }

      const { data: partnerships, error } = await supabase
        .from("venue_agency_partnerships")
        .select(`
          id,
          venue_id,
          agency_id,
          status,
          initiated_by,
          custom_commission_rate,
          notes,
          created_at,
          responded_at,
          agencies:agency_id(id, name, city, average_rating)
        `)
        .eq("venue_id", venue.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("List partnerships (venue):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ partnerships: partnerships || [] });
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agency) {
      return NextResponse.json({ partnerships: [] });
    }

    const { data: partnerships, error } = await supabase
      .from("venue_agency_partnerships")
      .select(`
        id,
        venue_id,
        agency_id,
        status,
        initiated_by,
        custom_commission_rate,
        notes,
        created_at,
        responded_at,
        venues:venue_id(id, name, city, address_line1)
      `)
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List partnerships (agency):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ partnerships: partnerships || [] });
  } catch (err) {
    console.error("Partnerships list:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
