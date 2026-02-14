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
    const { personnel_id, role, hourly_rate, message } = body;

    if (!personnel_id || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get agency
    const { data: agency } = await supabase
      .from("agencies")
      .select("id, name")
      .eq("user_id", user.id)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Check if personnel exists
    const { data: personnel } = await supabase
      .from("personnel")
      .select("id, display_name, user_id")
      .eq("id", personnel_id)
      .single();

    if (!personnel) {
      return NextResponse.json({ error: "Personnel not found" }, { status: 404 });
    }

    // Check for existing invitation
    const { data: existingInvite } = await supabase
      .from("agency_invitations")
      .select("id, status")
      .eq("agency_id", agency.id)
      .eq("personnel_id", personnel_id)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: "Invitation already sent and pending" },
        { status: 400 }
      );
    }

    // Check if already in agency
    const { data: existingStaff } = await supabase
      .from("agency_staff")
      .select("id")
      .eq("agency_id", agency.id)
      .eq("personnel_id", personnel_id)
      .in("status", ["active", "pending"])
      .single();

    if (existingStaff) {
      return NextResponse.json(
        { error: "This person is already in your team" },
        { status: 400 }
      );
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("agency_invitations")
      .insert({
        agency_id: agency.id,
        personnel_id: personnel_id,
        role,
        hourly_rate: hourly_rate ? Math.round(parseFloat(hourly_rate) * 100) : null,
        message: message || null,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Invitation creation error:", inviteError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Send push notification to personnel
    try {
      const { data: pushTokens } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", personnel.user_id);

      if (pushTokens && pushTokens.length > 0) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokens: pushTokens.map((t) => t.token),
            title: "Agency Invitation",
            body: `${agency.name} has invited you to join their team`,
            data: {
              type: "agency_invitation",
              invitation_id: invitation.id,
              agency_id: agency.id,
            },
          }),
        });
      }
    } catch (pushError) {
      console.error("Push notification error:", pushError);
      // Don't fail the request if push fails
    }

    return NextResponse.json({
      success: true,
      invitation,
    });
  } catch (error: any) {
    console.error("Invite staff error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
