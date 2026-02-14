import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const profileRole = session ? await getProfileRole(supabase, session.user.id) : null;
  const guestRole = (await cookies()).get("shield_guest_role")?.value;
  const role: Role | null = profileRole ?? (guestRole && ["venue", "personnel", "agency"].includes(guestRole) ? (guestRole as Role) : null);

  const isVenue = role === "venue";

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <header className="shrink-0 glass border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold text-white">Birmingham</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isVenue ? "Personnel available · Security agencies" : "Venues hiring · Personnel available · Security agencies"}
        </p>
      </header>

      <DashboardTabs role={role === "admin" ? null : role} />
    </div>
  );
}
