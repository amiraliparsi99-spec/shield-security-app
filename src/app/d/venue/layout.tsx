import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { VenueSidebar, VenueMobileNav } from "@/components/venue/VenueSidebar";
import { ShieldAIWrapper } from "@/components/ai/ShieldAIWrapper";

async function getVenueDetails(supabase: any, userId: string) {
  // Get profile ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    // Try with id = userId
    const { data: profileById } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();
    
    if (!profileById) return null;
  }

  const profileId = profile?.id || userId;

  // Get venue details
  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, verification_status")
    .eq("owner_id", profileId)
    .single();

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
  const allow = (session && role === "venue") || (!session && guestRole === "venue");
  
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
        isVerified={venue?.verification_status === "verified"} 
      />

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <VenueMobileNav />

      {/* Shield AI Assistant */}
      <ShieldAIWrapper userRole="venue" />
    </div>
  );
}
