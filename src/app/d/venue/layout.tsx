import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { VenueSidebar, VenueMobileNav } from "@/components/venue/VenueSidebar";
async function getVenueDetails(supabase: any, userId: string) {
  // Resolve profile ID reliably
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) {
    console.error("[VenueLayout] Profile lookup by user_id failed:", profileError.message);
  }

  let profileId = profile?.id ?? null;

  if (!profile) {
    // Fallback: some rows use id = auth user id
    const { data: profileById, error: profileByIdError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();
    if (profileByIdError) {
      console.error("[VenueLayout] Profile fallback lookup failed:", profileByIdError.message);
    }

    if (!profileById) return null;
    profileId = profileById.id;
  }

  if (!profileId) return null;

  // Get venue details — schema uses user_id (not owner_id)
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, name, type, is_active")
    .eq("user_id", profileId)
    .single();
  if (venueError) {
    console.error("[VenueLayout] Venue lookup failed:", venueError.message);
  }

  return venue;
}

export default async function VenueDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const cookieStore = await cookies();
  const guestRole = cookieStore.get("shield_guest_role")?.value;

  const role = session ? await getProfileRole(supabase, session.user.id) : null;
  // Resilience fallback: if session exists but role lookup is flaky,
  // still allow venue dashboard when venue guest-role cookie is present.
  const allow =
    (session && (role === "venue" || role === null || guestRole === "venue")) ||
    (!session && guestRole === "venue");

  if (!allow) {
    redirect(role ? getRoleDashboardPath(role) : "/signup");
  }

  // Get venue details for sidebar
  const venue = session ? await getVenueDetails(supabase, session.user.id) : null;

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      {/* Sidebar (desktop) */}
      <VenueSidebar 
        venueName={venue?.name} 
        isVerified={venue?.is_active ?? false} 
      />

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <VenueMobileNav />
    </div>
  );
}
