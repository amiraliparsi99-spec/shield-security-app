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
    const {
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
    } = body;

    if (!title || !event_date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Missing required fields: title, event_date, start_time, end_time" },
        { status: 400 }
      );
    }

    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 403 });
    }

    const { data: securityRequest, error } = await supabase
      .from("security_requests")
      .insert({
        venue_id: venue.id,
        title,
        description: description || null,
        event_date,
        start_time,
        end_time,
        staff_requirements: staff_requirements || null,
        budget_min: budget_min != null ? Math.round(Number(budget_min) * 100) : null,
        budget_max: budget_max != null ? Math.round(Number(budget_max) * 100) : null,
        partners_only: Boolean(partners_only),
        expires_at: expires_at || null,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("Create security request error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: securityRequest });
  } catch (err) {
    console.error("Create request:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
