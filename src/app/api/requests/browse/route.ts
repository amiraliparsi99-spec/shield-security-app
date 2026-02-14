import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const partners_only = searchParams.get("partners_only");
    const city = searchParams.get("city");
    const from_date = searchParams.get("from_date");
    const to_date = searchParams.get("to_date");
    const min_budget = searchParams.get("min_budget");
    const max_budget = searchParams.get("max_budget");

    let query = supabase
      .from("security_requests")
      .select(`
        id,
        venue_id,
        title,
        description,
        event_date,
        start_time,
        end_time,
        staff_requirements,
        budget_min,
        budget_max,
        partners_only,
        expires_at,
        created_at,
        status,
        venues:venue_id(id, name, city, address_line1)
      `)
      .eq("status", "open")
      .order("event_date", { ascending: true });

    if (partners_only === "true") {
      const { data: partnerVenueIds } = await supabase
        .from("venue_agency_partnerships")
        .select("venue_id")
        .eq("agency_id", agency.id)
        .eq("status", "active");
      const ids = (partnerVenueIds || []).map((p: { venue_id: string }) => p.venue_id);
      if (ids.length > 0) {
        query = query.in("venue_id", ids);
      } else {
        return NextResponse.json({ requests: [] });
      }
    } else {
      query = query.eq("partners_only", false);
    }

    if (from_date) {
      query = query.gte("event_date", from_date);
    }
    if (to_date) {
      query = query.lte("event_date", to_date);
    }
    if (min_budget != null && min_budget !== "") {
      query = query.or(`budget_max.gte.${min_budget},budget_max.is.null`);
    }
    if (max_budget != null && max_budget !== "") {
      query = query.or(`budget_min.lte.${max_budget},budget_min.is.null`);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error("Browse requests error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let list = requests || [];
    if (city) {
      list = list.filter((r: { venues?: { city?: string } }) => r.venues?.city?.toLowerCase().includes(city.toLowerCase()));
    }

    return NextResponse.json({ requests: list });
  } catch (err) {
    console.error("Browse requests:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
