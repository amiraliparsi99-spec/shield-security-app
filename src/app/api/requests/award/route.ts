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
    const { request_id, bid_id } = body;

    if (!request_id || !bid_id) {
      return NextResponse.json(
        { error: "Missing required fields: request_id, bid_id" },
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

    const { data: securityRequest } = await supabase
      .from("security_requests")
      .select("id, venue_id, title, event_date, start_time, end_time, staff_requirements, status")
      .eq("id", request_id)
      .eq("venue_id", venue.id)
      .single();

    if (!securityRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (securityRequest.status !== "open") {
      return NextResponse.json({ error: "Request is no longer open" }, { status: 400 });
    }

    const { data: bid } = await supabase
      .from("request_bids")
      .select("id, agency_id, status")
      .eq("id", bid_id)
      .eq("request_id", request_id)
      .single();

    if (!bid) {
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    if (bid.status !== "pending") {
      return NextResponse.json({ error: "Bid is no longer pending" }, { status: 400 });
    }

    const { error: updateRequestError } = await supabase
      .from("security_requests")
      .update({
        status: "awarded",
        awarded_agency_id: bid.agency_id,
      })
      .eq("id", request_id);

    if (updateRequestError) {
      console.error("Award request update error:", updateRequestError);
      return NextResponse.json({ error: updateRequestError.message }, { status: 500 });
    }

    const { error: updateBidError } = await supabase
      .from("request_bids")
      .update({ status: "accepted" })
      .eq("id", bid_id);

    if (updateBidError) {
      console.error("Award bid update error:", updateBidError);
      return NextResponse.json({ error: updateBidError.message }, { status: 500 });
    }

    const { data: declinedBids } = await supabase
      .from("request_bids")
      .select("id")
      .eq("request_id", request_id)
      .eq("status", "pending");

    if (declinedBids?.length) {
      await supabase
        .from("request_bids")
        .update({ status: "declined" })
        .eq("request_id", request_id)
        .neq("id", bid_id);
    }

    const eventDate = securityRequest.event_date;
    const startTime = String(securityRequest.start_time).slice(0, 5);
    const endTime = String(securityRequest.end_time).slice(0, 5);
    const startISO = `${eventDate}T${startTime}:00`;
    const endISO = `${eventDate}T${endTime}:00`;

    const staffReqs = Array.isArray(securityRequest.staff_requirements)
      ? securityRequest.staff_requirements
      : (securityRequest.staff_requirements && typeof securityRequest.staff_requirements === "object")
        ? Object.entries(securityRequest.staff_requirements).map(([role, qty]) => ({ role, quantity: Number(qty) || 1 }))
        : [{ role: "Security", quantity: 1 }];

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        venue_id: venue.id,
        event_name: securityRequest.title,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        brief_notes: "Awarded from security request",
        staff_requirements: staffReqs,
        status: "pending",
      })
      .select("id")
      .single();

    if (bookingError) {
      console.error("Create booking on award:", bookingError);
    }

    // Notify winning agency
    try {
      const { data: agencyRow } = await supabase
        .from("agencies")
        .select("user_id")
        .eq("id", bid.agency_id)
        .single();
      const { data: venueRow } = await supabase
        .from("venues")
        .select("name")
        .eq("id", venue.id)
        .single();
      if (agencyRow?.user_id) {
        const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000";
        await fetch(`${base}/api/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.SUPABASE_SERVICE_ROLE_KEY && { "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY }),
          },
          body: JSON.stringify({
            userId: agencyRow.user_id,
            type: "new_message",
            title: "You won the bid",
            body: `${venueRow?.name ?? "A venue"} awarded your bid`,
            data: { type: "request_awarded", request_id: request_id, bid_id: bid_id, booking_id: booking?.id },
          }),
        });
      }
    } catch (pushErr) {
      console.error("Award push notification error:", pushErr);
    }

    return NextResponse.json({
      awarded: true,
      request_id: request_id,
      bid_id: bid_id,
      agency_id: bid.agency_id,
      booking_id: booking?.id,
    });
  } catch (err) {
    console.error("Award request:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
