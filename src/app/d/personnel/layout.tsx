import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { guestPreviewRole } from "@/lib/auth/dashboardAccess";
import { PersonnelSidebar, PersonnelMobileNav } from "@/components/personnel/PersonnelSidebar";
import { OnboardingTour, PERSONNEL_TOUR } from "@/components/onboarding/OnboardingTour";
import { ShieldAIFloating } from "@/components/ai/ShieldAIFloating";
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
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const guestRole = guestPreviewRole(
    cookieStore.get("shield_guest_role")?.value,
    Boolean(user),
  );

  const role = user ? await getProfileRole(supabase, user.id) : null;

  if (!user) {
    if (guestRole !== "personnel") redirect("/signup");
  } else if (role !== "personnel") {
    redirect(role ? getRoleDashboardPath(role) : "/dashboard");
  }

  // Get personnel details for sidebar
  const personnel = user ? await getPersonnelDetails(supabase, user.id) : null;

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

      {/* First-run guided tour */}
      <OnboardingTour steps={PERSONNEL_TOUR} tourId="personnel-v1" />

      {/* Always-available AI helper */}
      <ShieldAIFloating userRole="personnel" userName={personnel?.display_name ?? undefined} />
    </div>
  );
}
