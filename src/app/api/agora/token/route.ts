/**
 * Agora Token Server
 * Generates RTC tokens for secure voice/video calls
 * 
 * POST /api/agora/token
 * Body: { channelName: string, uid: number, role?: 'publisher' | 'subscriber' }
 */

import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-access-token";
import { createClient } from "@supabase/supabase-js";

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TOKEN_EXPIRATION_SECONDS = 3600;

async function getAuthUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await admin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  try {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const sb = await createServerClient();
    const { data: { session } } = await sb.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      return NextResponse.json(
        { error: "Agora credentials not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { channelName, uid, role = "publisher" } = body;

    // Validate required fields
    if (!channelName) {
      return NextResponse.json(
        { error: "channelName is required" },
        { status: 400 }
      );
    }

    if (uid === undefined || uid === null) {
      return NextResponse.json(
        { error: "uid is required" },
        { status: 400 }
      );
    }

    // Determine Agora role
    const agoraRole = role === "subscriber" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    // Calculate expiration time
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + TOKEN_EXPIRATION_SECONDS;

    // Generate the token
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      agoraRole,
      privilegeExpireTime
    );

    return NextResponse.json({
      token,
      appId: APP_ID,
      channelName,
      uid,
      expiresAt: privilegeExpireTime,
    });
  } catch (error: any) {
    console.error("Agora token generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate token" },
      { status: 500 }
    );
  }
}

