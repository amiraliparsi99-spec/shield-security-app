import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const { user_id, owner_id, owner_type } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const stripe = await getStripe();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        user_id,
        owner_id: owner_id || "",
        owner_type: owner_type || "personnel",
      },
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
      return_url: `${appUrl}/api/verify/identity/complete`,
    });

    // Ephemeral key for native mobile SDK (IdentityVerificationSheet)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { verification_session: verificationSession.id },
      { apiVersion: "2026-01-28.clover" }
    );

    return NextResponse.json({
      id: verificationSession.id,
      ephemeralKeySecret: ephemeralKey.secret,
      url: verificationSession.url,
    });
  } catch (error: any) {
    console.error("Stripe Identity Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create verification session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/verify/identity?session_id=...
 * Check the status of a Stripe Identity verification session.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const stripe = await getStripe();
    const session = await stripe.identity.verificationSessions.retrieve(sessionId);

    return NextResponse.json({
      id: session.id,
      status: session.status,
      last_error: session.last_error,
    });
  } catch (error: any) {
    console.error("Stripe Identity Status Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check verification status" },
      { status: 500 }
    );
  }
}
