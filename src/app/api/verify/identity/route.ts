import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";

async function getAuthUserId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies
            .getAll()
            .map((c) => ({ name: c.name, value: c.value }));
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request);
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user_id, owner_id, owner_type } = await request.json();

    // Only allow creating a verification session for yourself — prevents an
    // attacker from triggering identity verification flows against other users.
    if (!user_id || user_id !== authUserId) {
      return NextResponse.json(
        { error: "user_id must match the authenticated user" },
        { status: 403 },
      );
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

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { verification_session: verificationSession.id },
      { apiVersion: "2026-01-28.clover" },
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
      { status: 500 },
    );
  }
}

/**
 * GET /api/verify/identity?session_id=...
 * Check the status of a Stripe Identity verification session.
 * Only the owner of the session (matched via metadata.user_id) may read it.
 */
export async function GET(request: NextRequest) {
  try {
    const authUserId = await getAuthUserId(request);
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const stripe = await getStripe();
    const session = await stripe.identity.verificationSessions.retrieve(sessionId);

    if (session.metadata?.user_id !== authUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      last_error: session.last_error,
    });
  } catch (error: any) {
    console.error("Stripe Identity Status Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check verification status" },
      { status: 500 },
    );
  }
}
