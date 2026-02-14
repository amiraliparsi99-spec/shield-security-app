import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "venue" | "personnel" | "agency";

export async function getProfileRole(
  supabase: SupabaseClient,
  userId: string
): Promise<Role | null> {
  const out = await getProfileIdAndRole(supabase, userId);
  if (out?.role && ["venue", "personnel", "agency"].includes(out.role)) {
    return out.role as Role;
  }
  return null;
}

/** Resolve profile id and role. Tries user_id then id for 0001/0003 compat. */
export async function getProfileIdAndRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profileId: string; role: string } | null> {
  const { data: byUser } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (byUser?.id) return { profileId: byUser.id, role: byUser.role };
  const { data: byId } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (byId?.id) return { profileId: byId.id, role: byId.role };
  return null;
}

/** Venue → /d/venue, Personnel → /d/personnel, Agency → /d/agency. */
export function getRoleDashboardPath(role: Role): string {
  if (role === "venue") return "/d/venue";
  if (role === "personnel") return "/d/personnel";
  if (role === "agency") return "/d/agency";
  return "/";
}

/** Personnel id for this profile. Tries both profileId and auth user id. */
export async function getPersonnelId(supabase: SupabaseClient, profileId: string): Promise<string | null> {
  // Try by profileId first
  const { data: byProfile } = await supabase.from("personnel").select("id").eq("user_id", profileId).maybeSingle();
  if (byProfile?.id) return byProfile.id;
  
  // Also try by auth user id (for cases where personnel.user_id = auth.uid())
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id && user.id !== profileId) {
    const { data: byAuth } = await supabase.from("personnel").select("id").eq("user_id", user.id).maybeSingle();
    if (byAuth?.id) return byAuth.id;
  }
  
  return null;
}

/** Agency id for this profile. Tries both profileId and auth user id. */
export async function getAgencyId(supabase: SupabaseClient, profileId: string): Promise<string | null> {
  // Try by profileId first (user_id column)
  const { data: byProfile } = await supabase.from("agencies").select("id").eq("user_id", profileId).maybeSingle();
  if (byProfile?.id) return byProfile.id;
  
  // Also try by auth user id
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id && user.id !== profileId) {
    const { data: byAuth } = await supabase.from("agencies").select("id").eq("user_id", user.id).maybeSingle();
    if (byAuth?.id) return byAuth.id;
  }
  
  return null;
}

/** Venue id for this profile. Tries both profileId and auth user id. */
export async function getVenueId(supabase: SupabaseClient, profileId: string): Promise<string | null> {
  // Try by profileId first (user_id column)
  const { data: byProfile } = await supabase.from("venues").select("id").eq("user_id", profileId).maybeSingle();
  if (byProfile?.id) return byProfile.id;
  
  // Also try by auth user id
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id && user.id !== profileId) {
    const { data: byAuth } = await supabase.from("venues").select("id").eq("user_id", user.id).maybeSingle();
    if (byAuth?.id) return byAuth.id;
  }
  
  return null;
}
