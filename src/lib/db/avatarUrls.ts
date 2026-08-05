import type { SupabaseClient } from "@supabase/supabase-js";
import type { Personnel } from "@/lib/database.types";

type ProfileAvatarRow = {
  id: string;
  user_id: string | null;
  avatar_url: string | null;
};

/** Resolve profile avatar URLs onto personnel rows (by personnel.user_id). */
export async function enrichPersonnelWithAvatars<T extends Personnel>(
  supabase: SupabaseClient,
  personnel: T[],
): Promise<(T & { avatar_url: string | null })[]> {
  if (personnel.length === 0) return [];

  const ownerIds = [...new Set(personnel.map((p) => p.user_id).filter(Boolean))];
  if (ownerIds.length === 0) {
    return personnel.map((p) => ({ ...p, avatar_url: null }));
  }

  const [{ data: byId }, { data: byUserId }] = await Promise.all([
    supabase.from("profiles").select("id, user_id, avatar_url").in("id", ownerIds),
    supabase.from("profiles").select("id, user_id, avatar_url").in("user_id", ownerIds),
  ]);

  const avatarByOwner = new Map<string, string>();
  for (const row of [...((byId as ProfileAvatarRow[]) ?? []), ...((byUserId as ProfileAvatarRow[]) ?? [])]) {
    if (!row.avatar_url) continue;
    avatarByOwner.set(row.id, row.avatar_url);
    if (row.user_id) avatarByOwner.set(row.user_id, row.avatar_url);
  }

  return personnel.map((p) => ({
    ...p,
    avatar_url: avatarByOwner.get(p.user_id) ?? null,
  }));
}
