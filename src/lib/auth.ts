import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "venue" | "personnel" | "agency" | "admin";

/**
 * Fetch the user's role from profiles. Falls back to user_metadata.role if no row.
 * Handles both profile table structures:
 * - 0001: id references auth.users(id) directly
 * - 0003: user_id references auth.users(id)
 */
export async function getProfileRole(
  supabase: SupabaseClient,
  userId: string
): Promise<Role | null> {
  const validRoles = ["venue", "personnel", "agency", "admin"];

  // Try user_id first (matches AuthProvider order)
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.role && validRoles.includes(data.role)) {
    return data.role as Role;
  }

  // Fallback: try id (older structure where id = auth user id)
  const { data: dataById } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (dataById?.role && validRoles.includes(dataById.role)) {
    return dataById.role as Role;
  }

  // Last resort: check user_metadata.role from auth
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.user_metadata?.role) {
    const metaRole = user.user_metadata.role as string;
    if (validRoles.includes(metaRole)) {
      return metaRole as Role;
    }
  }

  return null;
}

export function getRoleDashboardPath(role: Role): string {
  switch (role) {
    case "venue":
      return "/d/venue";
    case "personnel":
      return "/d/personnel";
    case "agency":
      return "/d/agency";
    case "admin":
      return "/admin";
    default:
      return "/dashboard";
  }
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case "venue":
      return "Venue";
    case "personnel":
      return "Personnel";
    case "agency":
      return "Agency";
    case "admin":
      return "Admin";
    default:
      return "Dashboard";
  }
}

/**
 * Check if user is an admin
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const role = await getProfileRole(supabase, userId);
  return role === "admin";
}
