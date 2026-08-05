import Mux from "@mux/mux-node";

/**
 * Server-side Mux helpers for guard intro videos.
 *
 * The guard's device uploads the file directly to Mux via a one-time "direct
 * upload" URL we mint here; Mux transcodes and notifies us via webhook. We only
 * ever store the asset/playback ids + a moderation status in our DB.
 */

let client: Mux | null = null;

export function isMuxConfigured(): boolean {
  return !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

export function getMux(): Mux {
  if (!client) {
    client = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
  }
  return client;
}

/** When true, uploaded videos skip manual review and publish immediately. */
export function introVideoAutoApprove(): boolean {
  return process.env.INTRO_VIDEO_AUTO_APPROVE === "true";
}

/**
 * Create a one-time direct-upload target. `personnelId` is stamped as the asset
 * passthrough so the webhook can attribute the finished asset to the guard.
 */
export async function createIntroVideoUpload(personnelId: string): Promise<{
  uploadId: string;
  uploadUrl: string;
}> {
  const upload = await getMux().video.uploads.create({
    cors_origin: "*",
    new_asset_settings: {
      playback_policy: ["public"],
      passthrough: personnelId,
      // "basic" quality keeps encoding free and is plenty for a phone clip.
      video_quality: "basic",
    } as never,
  });
  return { uploadId: upload.id, uploadUrl: upload.url };
}

/**
 * Polling fallback for environments where the webhook can't reach us (local
 * dev). Given a direct-upload id, returns the asset's playback id once Mux has
 * finished transcoding, or null if it isn't ready yet.
 */
export async function resolveUploadPlayback(
  uploadId: string,
): Promise<{ assetId: string; playbackId: string } | null> {
  const upload = await getMux().video.uploads.retrieve(uploadId);
  const assetId = (upload as { asset_id?: string }).asset_id;
  if (!assetId) return null;
  const asset = await getMux().video.assets.retrieve(assetId);
  if ((asset as { status?: string }).status !== "ready") return null;
  const playbackId = (asset as { playback_ids?: { id: string }[] })
    .playback_ids?.[0]?.id;
  if (!playbackId) return null;
  return { assetId, playbackId };
}

/** Verify + parse a Mux webhook. Throws if the signature is invalid. */
export function unwrapMuxWebhook(rawBody: string, headers: Headers): unknown {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  const headerObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  return getMux().webhooks.unwrap(rawBody, headerObj, secret);
}

export function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function muxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`;
}
