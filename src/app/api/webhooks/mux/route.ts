/**
 * Mux webhook receiver. Mux calls this when an asset finishes transcoding (or
 * errors). We verify the signature, then attribute the asset to the guard via
 * the passthrough (personnel id) and store the playback id + moderation status.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { introVideoAutoApprove, unwrapMuxWebhook } from "@/lib/video/mux";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Mux signs the raw body — we must read it as text, not parsed JSON.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let event: {
    type?: string;
    data?: {
      id?: string;
      passthrough?: string;
      playback_ids?: { id: string; policy?: string }[];
    };
  };
  try {
    event = unwrapMuxWebhook(rawBody, request.headers) as typeof event;
  } catch (e) {
    console.error("[mux-webhook] signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const personnelId = event.data?.passthrough;
  if (!personnelId) {
    return NextResponse.json({ received: true });
  }

  if (event.type === "video.asset.ready") {
    const assetId = event.data?.id ?? null;
    const playbackId = event.data?.playback_ids?.[0]?.id ?? null;
    if (playbackId) {
      const approved = introVideoAutoApprove();
      await supabaseAdmin
        .from("personnel")
        .update({
          intro_video_asset_id: assetId,
          intro_video_playback_id: playbackId,
          intro_video_status: approved ? "approved" : "pending",
          intro_video_reviewed_at: approved ? new Date().toISOString() : null,
        } as never)
        .eq("id", personnelId);
    }
  } else if (event.type === "video.asset.errored") {
    // Let the guard retry from a clean state.
    await supabaseAdmin
      .from("personnel")
      .update({ intro_video_status: "none" } as never)
      .eq("id", personnelId);
  }

  return NextResponse.json({ received: true });
}
