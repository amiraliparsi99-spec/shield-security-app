import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { AgencySidebar, AgencyMobileNav } from "@/components/agency/AgencySidebar";
import { ShieldAIWrapper } from "@/components/ai/ShieldAIWrapper";

async function getAgencyDetails(supabase: any, userId: string) {
  // Get agency details (userId in profiles table is the id column)
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, verification_status")
    .eq("user_id", userId)
    .single();

  return agency;
}

export default async function AgencyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const cookieStore = await cookies();
  const guestRole = cookieStore.get("shield_guest_role")?.value;

  const role = session ? await getProfileRole(supabase, session.user.id) : null;
  const allow = (session && role === "agency") || (!session && guestRole === "agency");
  
  if (!allow) {
    redirect(role ? getRoleDashboardPath(role) : "/signup");
  }

  // Get agency details for sidebar
  const agency = session ? await getAgencyDetails(supabase, session.user.id) : null;

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      {/* Sidebar (desktop) */}
      <AgencySidebar 
        agencyName={agency?.name} 
        isVerified={agency?.verification_status === "verified"} 
      />

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <AgencyMobileNav />

      {/* Shield AI Assistant */}
      <ShieldAIWrapper userRole="agency" />
    </div>
  );
}
