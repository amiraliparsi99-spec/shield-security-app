import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole, getRoleDashboardPath } from "@/lib/auth";

export default async function PersonnelDashboard() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const cookieStore = await cookies();
  const guestRole = cookieStore.get("shield_guest_role")?.value;

  const role = session ? await getProfileRole(supabase, session.user.id) : null;
  const allow = (session && role === "personnel") || (!session && guestRole === "personnel");
  if (!allow) redirect(role ? getRoleDashboardPath(role) : "/signup");

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <header className="shrink-0 glass border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold text-white">Your profile</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Set your availability, view applications, and manage bookings.
        </p>
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="glass rounded-2xl p-6 transition-all hover:shadow-glow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-medium text-white">Your availability</h2>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              When you&apos;re available for shifts. (Coming soon)
            </p>
          </section>

          <section className="glass rounded-2xl p-6 transition-all hover:shadow-glow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-medium text-white">Applications</h2>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Applications you&apos;ve submitted to venue requests. (Coming soon)
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-shield-500/20 px-4 py-2 text-sm font-medium text-shield-300 transition hover:bg-shield-500/30 hover:shadow-glow-sm"
            >
              Browse requests
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </section>

          <section className="glass rounded-2xl p-6 transition-all hover:shadow-glow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-500/20">
                <svg className="h-5 w-5 text-shield-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-medium text-white">Bookings</h2>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Confirmed shifts. (Coming soon)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
