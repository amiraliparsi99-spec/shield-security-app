import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { PersonnelSidebar, PersonnelMobileNav } from "@/components/personnel/PersonnelSidebar";
import { ShieldAIWrapper } from "@/components/ai/ShieldAIWrapper";

async function getPersonnelDetails(supabase: any, userId: string) {
  // Try to get personnel details
  const { data: personnel } = await supabase
    .from("personnel")
    .select("id, display_name")
    .eq("user_id", userId)
    .single();

  return personnel;
}

export default async function PersonnelDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const cookieStore = await cookies();
  const guestRole = cookieStore.get("shield_guest_role")?.value;

  const role = session ? await getProfileRole(supabase, session.user.id) : null;
  const allow = (session && role === "personnel") || (!session && guestRole === "personnel");
  
  if (!allow) {
    redirect(role ? getRoleDashboardPath(role) : "/signup");
  }

  // Get personnel details for sidebar
  const personnel = session ? await getPersonnelDetails(supabase, session.user.id) : null;

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      {/* Sidebar (desktop) */}
      <PersonnelSidebar 
        userName={personnel?.display_name} 
        shieldScore={94} 
      />

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <PersonnelMobileNav />

      {/* Shield AI Assistant */}
      <ShieldAIWrapper userRole="personnel" />
    </div>
  );
}
