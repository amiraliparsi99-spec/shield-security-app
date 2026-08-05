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

/** Personnel id for this profile. Resolves across legacy profile layouts. */
export async function getPersonnelId(supabase: SupabaseClient, profileId: string): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const candidates = new Set<string>([user.id, profileId]);

  const { data: byId } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (byId?.id) candidates.add(String(byId.id));

  try {
    const { data: byUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (byUser?.id) candidates.add(String(byUser.id));
  } catch {
    // profiles.user_id may not exist in older schemas.
  }

  const { data: rows } = await supabase
    .from("personnel")
    .select("id")
    .in("user_id", Array.from(candidates))
    .limit(1);

  return rows?.[0]?.id ?? null;
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

/**
 * Check if a personnel member has completed verification.
 * Checks the verifications table for status = 'verified'.
 */
export async function isPersonnelVerified(
  supabase: SupabaseClient,
  personnelId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("verifications")
    .select("status")
    .eq("owner_type", "personnel")
    .eq("owner_id", personnelId)
    .maybeSingle();

  return data?.status === "verified";
}

/**
 * Check if a personnel member has a fully connected Stripe bank account.
 * Having a stripe_accounts row alone is not enough — onboarding must be complete.
 */
export async function isPersonnelBankConnected(
  supabase: SupabaseClient,
  personnelId: string
): Promise<boolean> {
  const { data: personnel } = await supabase
    .from("personnel")
    .select("user_id")
    .eq("id", personnelId)
    .single();

  if (!personnel?.user_id) return false;

  const { data: stripeAccount } = await supabase
    .from("stripe_accounts")
    .select("stripe_account_id, onboarding_complete, charges_enabled, payouts_enabled, details_submitted")
    .eq("user_id", personnel.user_id)
    .maybeSingle();

  if (!stripeAccount?.stripe_account_id) return false;

  return !!(
    stripeAccount.onboarding_complete ||
    stripeAccount.charges_enabled ||
    stripeAccount.payouts_enabled ||
    stripeAccount.details_submitted
  );
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
