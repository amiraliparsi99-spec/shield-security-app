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
    const { venue_id, agency_id, initiated_by, notes } = body;

    if (!venue_id || !agency_id || !initiated_by) {
      return NextResponse.json(
        { error: "Missing required fields: venue_id, agency_id, initiated_by" },
        { status: 400 }
      );
    }

    if (!["venue", "agency"].includes(initiated_by)) {
      return NextResponse.json(
        { error: "initiated_by must be 'venue' or 'agency'" },
        { status: 400 }
      );
    }

    if (initiated_by === "venue") {
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("id", venue_id)
        .eq("user_id", user.id)
        .single();
      if (!venue) {
        return NextResponse.json({ error: "Venue not found or access denied" }, { status: 403 });
      }
    } else {
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("id", agency_id)
        .eq("user_id", user.id)
        .single();
      if (!agency) {
        return NextResponse.json({ error: "Agency not found or access denied" }, { status: 403 });
      }
    }

    const { data: existing } = await supabase
      .from("venue_agency_partnerships")
      .select("id, status")
      .eq("venue_id", venue_id)
      .eq("agency_id", agency_id)
      .maybeSingle();

    if (existing) {
      if (existing.status === "active") {
        return NextResponse.json({ error: "Partnership already active" }, { status: 400 });
      }
      if (existing.status === "pending") {
        return NextResponse.json({ error: "Partnership request already pending" }, { status: 400 });
      }
      return NextResponse.json({ error: "A previous partnership existed; cannot re-request" }, { status: 400 });
    }

    const { data: partnership, error } = await supabase
      .from("venue_agency_partnerships")
      .insert({
        venue_id,
        agency_id,
        status: "pending",
        initiated_by,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Partnership request error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the other party
    try {
      let targetUserId: string | null = null;
      let senderName: string = "";
      if (initiated_by === "venue") {
        const { data: agencyRow } = await supabase
          .from("agencies")
          .select("user_id, name")
          .eq("id", agency_id)
          .single();
        targetUserId = agencyRow?.user_id ?? null;
        const { data: venueRow } = await supabase
          .from("venues")
          .select("name")
          .eq("id", venue_id)
          .single();
        senderName = venueRow?.name ?? "A venue";
      } else {
        const { data: venueRow } = await supabase
          .from("venues")
          .select("user_id, name")
          .eq("id", venue_id)
          .single();
        targetUserId = venueRow?.user_id ?? null;
        const { data: agencyRow } = await supabase
          .from("agencies")
          .select("name")
          .eq("id", agency_id)
          .single();
        senderName = agencyRow?.name ?? "An agency";
      }
      if (targetUserId) {
        const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000";
        await fetch(`${base}/api/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.SUPABASE_SERVICE_ROLE_KEY && { "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY }),
          },
          body: JSON.stringify({
            userId: targetUserId,
            type: "new_message",
            title: "Partnership request",
            body: `${senderName} sent you a partnership request`,
            data: { type: "partnership_request", partnership_id: partnership.id },
          }),
        });
      }
    } catch (pushErr) {
      console.error("Partnership push notification error:", pushErr);
    }

    return NextResponse.json({ partnership });
  } catch (err) {
    console.error("Partnership request:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
