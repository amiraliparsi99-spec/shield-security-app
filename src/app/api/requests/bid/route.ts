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
    const { request_id, proposed_rate, cover_letter, estimated_staff } = body;

    if (!request_id || proposed_rate == null) {
      return NextResponse.json(
        { error: "Missing required fields: request_id, proposed_rate" },
        { status: 400 }
      );
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 403 });
    }

    const { data: securityRequest } = await supabase
      .from("security_requests")
      .select("id, status, partners_only, venue_id")
      .eq("id", request_id)
      .single();

    if (!securityRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (securityRequest.status !== "open") {
      return NextResponse.json({ error: "Request is no longer open for bids" }, { status: 400 });
    }

    if (securityRequest.partners_only) {
      const { data: partnership } = await supabase
        .from("venue_agency_partnerships")
        .select("id")
        .eq("venue_id", securityRequest.venue_id)
        .eq("agency_id", agency.id)
        .eq("status", "active")
        .maybeSingle();
      if (!partnership) {
        return NextResponse.json({ error: "This request is only open to partner agencies" }, { status: 403 });
      }
    }

    const { data: existing } = await supabase
      .from("request_bids")
      .select("id, status")
      .eq("request_id", request_id)
      .eq("agency_id", agency.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") {
        const { data: updated, error } = await supabase
          .from("request_bids")
          .update({
            proposed_rate: Number(proposed_rate),
            cover_letter: cover_letter || null,
            estimated_staff: estimated_staff || null,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ bid: updated });
      }
      return NextResponse.json({ error: "You have already submitted a bid" }, { status: 400 });
    }

    const { data: bid, error } = await supabase
      .from("request_bids")
      .insert({
        request_id,
        agency_id: agency.id,
        proposed_rate: Number(proposed_rate),
        cover_letter: cover_letter || null,
        estimated_staff: estimated_staff || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Create bid error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify venue of new bid
    try {
      const { data: venueRow } = await supabase
        .from("venues")
        .select("user_id")
        .eq("id", securityRequest.venue_id)
        .single();
      const { data: agencyRow } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", agency.id)
        .single();
      if (venueRow?.user_id) {
        const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000";
        await fetch(`${base}/api/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.SUPABASE_SERVICE_ROLE_KEY && { "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY }),
          },
          body: JSON.stringify({
            userId: venueRow.user_id,
            type: "new_message",
            title: "New bid on your request",
            body: `${agencyRow?.name ?? "An agency"} submitted a bid`,
            data: { type: "request_bid", request_id: request_id, bid_id: bid.id },
          }),
        });
      }
    } catch (pushErr) {
      console.error("Bid push notification error:", pushErr);
    }

    return NextResponse.json({ bid });
  } catch (err) {
    console.error("Request bid:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
