/**
 * Profile helpers for OAuth flows — kept separate from oauth.ts so the root
 * layout can import this without loading @react-native-google-signin (which
 * crashes on builds that don't include the native module, e.g. Expo Go).
 */

import { supabase } from "./supabase";

/**
 * True once a profile row exists for this user. Caller uses this to decide
 * whether to send a fresh OAuth user through the role-picker onboarding.
 */
export async function hasCompletedProfile(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[oauth] hasCompletedProfile query failed:", error.message);
    return false;
  }
  return !!data?.role;
}
