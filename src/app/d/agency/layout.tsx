import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";
import { guestPreviewRole } from "@/lib/auth/dashboardAccess";
import { AgencySidebar, AgencyMobileNav } from "@/components/agency/AgencySidebar";
import { OnboardingTour, AGENCY_TOUR } from "@/components/onboarding/OnboardingTour";
import { ShieldAIFloating } from "@/components/ai/ShieldAIFloating";

async function getAgencyDetails(supabase: any, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) {
    console.error("[AgencyLayout] Profile lookup by user_id failed:", profileError.message);
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
      console.error("[AgencyLayout] Profile fallback lookup failed:", profileByIdError.message);
    }

    if (!profileById) return null;
    profileId = profileById.id;
  }

  if (!profileId) return null;

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id, name, is_active, is_verified")
    .eq("user_id", profileId)
    .maybeSingle();
  if (agencyError) {
    console.error("[AgencyLayout] Agency lookup failed:", agencyError.message);
  }

  return agency;
}

export default async function AgencyDashboardLayout({
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
    if (guestRole !== "agency") redirect("/signup");
  } else if (role !== "agency") {
    // No "role is null so let them in" escape hatch, and no honouring the guest
    // cookie for a signed-in user: both let any account open this dashboard.
    redirect(role ? getRoleDashboardPath(role) : "/dashboard");
  }

  const agency = user ? await getAgencyDetails(supabase, user.id) : null;

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
        isVerified={agency?.is_verified ?? false}
      />

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <AgencyMobileNav />

      {/* First-run guided tour */}
      <OnboardingTour steps={AGENCY_TOUR} tourId="agency-v1" />

      {/* Always-available AI helper */}
      <ShieldAIFloating userRole="agency" userName={agency?.name ?? undefined} />
    </div>
  );
}
