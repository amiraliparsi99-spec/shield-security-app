"use client";

import { useRef, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { PersonnelAvatar } from "@/components/ui/PersonnelAvatar";

type Props = {
  userId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  onChange: (url: string | null) => void;
  size?: "lg" | "xl";
};

export function ProfileAvatarUpload({
  userId,
  profileId,
  displayName,
  avatarUrl,
  onChange,
  size = "xl",
}: Props) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .or(`id.eq.${profileId},user_id.eq.${userId}`);

      if (profileError) throw profileError;

      onChange(publicUrl);
    } catch (e: any) {
      console.error("[ProfileAvatarUpload]", e);
      setError(e?.message || "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative shrink-0 disabled:opacity-60"
        aria-label="Change profile photo"
      >
        <PersonnelAvatar name={displayName} avatarUrl={avatarUrl} size={size} />
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition group-hover:opacity-100">
          <span className="text-xs font-medium text-white">
            {uploading ? "Uploading…" : "Change photo"}
          </span>
        </span>
      </button>

      <div className="text-center sm:text-left">
        <p className="text-sm font-medium text-white">Profile photo</p>
        <p className="mt-1 text-xs text-zinc-400 max-w-xs">
          Helps agencies tell guards apart when names match. Your photo appears on your roster card
          and shift assignments.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-3 text-sm text-shield-400 hover:text-shield-300 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : avatarUrl ? "Replace photo" : "Upload photo"}
        </button>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
