/**
 * Polling fallback for intro-video processing. The client calls this with the
 * direct-upload id after uploading; if Mux has finished transcoding we save the
 * playback id + status (the same thing the webhook does). Lets local dev work
 * without a publicly reachable webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  introVideoAutoApprove,
  isMuxConfigured,
  resolveUploadPlayback,
} from "@/lib/video/mux";

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMuxConfigured()) {
    return NextResponse.json({ status: "none" });
  }

  const { uploadId } = (await request.json().catch(() => ({}))) as {
    uploadId?: string;
  };

  const { data: personnel } = await supabaseAdmin
    .from("personnel")
    .select("id, intro_video_status, intro_video_playback_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!personnel) {
    return NextResponse.json({ error: "Not personnel" }, { status: 403 });
  }

  const current = personnel as {
    id: string;
    intro_video_status: string | null;
    intro_video_playback_id: string | null;
  };

  // Already resolved (likely via webhook) — just report it. Only short-circuit
  // when the status actually reflects a finished video; a lingering playback_id
  // with status still 'processing' means a fresh upload is in flight.
  if (
    current.intro_video_playback_id &&
    (current.intro_video_status === "approved" ||
      current.intro_video_status === "pending" ||
      current.intro_video_status === "rejected")
  ) {
    return NextResponse.json({
      status: current.intro_video_status,
      playbackId: current.intro_video_playback_id,
    });
  }

  if (!uploadId) {
    return NextResponse.json({ status: current.intro_video_status ?? "none" });
  }

  try {
    const resolved = await resolveUploadPlayback(uploadId);
    if (!resolved) {
      return NextResponse.json({ status: "processing" });
    }
    const approved = introVideoAutoApprove();
    await supabaseAdmin
      .from("personnel")
      .update({
        intro_video_asset_id: resolved.assetId,
        intro_video_playback_id: resolved.playbackId,
        intro_video_status: approved ? "approved" : "pending",
        intro_video_reviewed_at: approved ? new Date().toISOString() : null,
      } as never)
      .eq("id", current.id);
    return NextResponse.json({
      status: approved ? "approved" : "pending",
      playbackId: resolved.playbackId,
    });
  } catch (e) {
    console.error("[intro-video] status poll failed:", e);
    return NextResponse.json({ status: "processing" });
  }
}
