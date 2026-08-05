/**
 * Mints a one-time Mux direct-upload URL for the authenticated guard's intro
 * video. The device uploads straight to the returned URL; Mux transcodes and
 * calls our webhook when the asset is ready.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createIntroVideoUpload, isMuxConfigured } from "@/lib/video/mux";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (user && !error) return user;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMuxConfigured()) {
    return NextResponse.json(
      { error: "Video uploads are not configured on this environment." },
      { status: 503 },
    );
  }

  const { data: personnel } = await supabaseAdmin
    .from("personnel")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!personnel) {
    return NextResponse.json(
      { error: "Only personnel accounts can upload an intro video." },
      { status: 403 },
    );
  }

  try {
    const { uploadUrl, uploadId } = await createIntroVideoUpload(personnel.id);

    await supabaseAdmin
      .from("personnel")
      .update({
        intro_video_status: "processing",
        // Clear any prior asset so a re-record can't be mistaken for resolved.
        intro_video_playback_id: null,
        intro_video_asset_id: null,
        intro_video_reviewed_at: null,
        intro_video_uploaded_at: new Date().toISOString(),
      } as never)
      .eq("id", personnel.id);

    return NextResponse.json({ uploadUrl, uploadId });
  } catch (e: unknown) {
    console.error("[intro-video] create upload failed:", e);
    return NextResponse.json(
      { error: "Could not start the video upload. Try again." },
      { status: 500 },
    );
  }
}
