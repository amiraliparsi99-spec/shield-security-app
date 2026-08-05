import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadProfileAvatar(
  supabase: SupabaseClient,
  params: {
    userId: string;
    profileId: string;
    uri: string;
    mimeType?: string;
  },
): Promise<string> {
  const { userId, profileId, uri, mimeType = "image/jpeg" } = params;

  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5 MB.");
  }

  const ext =
    mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { cacheControl: "3600", upsert: true, contentType: mimeType });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .or(`id.eq.${profileId},user_id.eq.${userId}`);

  if (profileError) throw profileError;

  return publicUrl;
}
