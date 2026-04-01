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

  // Fetch real data for the logged-in user
  let displayName = "Guard";
  let upcomingShifts: any[] = [];
  let recentEarnings = 0;
  let shieldScore: number | null = null;
  let totalShifts = 0;

  if (session?.user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .single();
    if (profile?.display_name) displayName = profile.display_name;

    const { data: personnel } = await supabase
      .from("personnel")
      .select("id, shield_score")
      .eq("user_id", session.user.id)
      .single();

    if (personnel) {
      shieldScore = personnel.shield_score;

      // Upcoming shifts (next 7 days)
      const now = new Date().toISOString();
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id, role, scheduled_start, scheduled_end, status, hourly_rate, booking:bookings(event_name, venues(name))")
        .eq("personnel_id", personnel.id)
        .gte("scheduled_start", now)
        .lte("scheduled_start", nextWeek)
        .in("status", ["accepted", "pending"])
        .order("scheduled_start")
        .limit(5);

      upcomingShifts = shifts || [];

      // Total completed shifts
      const { count } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("personnel_id", personnel.id)
        .eq("status", "completed");

      totalShifts = count ?? 0;

      // Recent earnings (this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: earningsData } = await supabase
        .from("shifts")
        .select("actual_hours, hourly_rate")
        .eq("personnel_id", personnel.id)
        .eq("status", "completed")
        .gte("scheduled_start", startOfMonth.toISOString());

      recentEarnings = (earningsData || []).reduce((sum, s) => {
        const hours = s.actual_hours || 0;
        const rate = s.hourly_rate || 0;
        return sum + hours * rate;
      }, 0);
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <header className="shrink-0 glass border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <h1 className="font-display text-xl font-semibold text-white">
          Welcome back, {displayName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Here&apos;s what&apos;s happening with your shifts.
        </p>
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-white">{totalShifts}</p>
              <p className="text-xs text-zinc-400 mt-1">Shifts completed</p>
            </div>
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-[#00d4aa]">
                £{(recentEarnings / 100).toFixed(0)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">This month</p>
            </div>
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold text-white">{shieldScore ?? "—"}</p>
              <p className="text-xs text-zinc-400 mt-1">Shield Score</p>
            </div>
          </div>

          {/* Upcoming shifts */}
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-medium text-white">Upcoming shifts</h2>
              <Link href="/d/personnel/jobs" className="text-sm text-[#00d4aa] hover:text-[#5eead4] transition">
                Find shifts →
              </Link>
            </div>
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-zinc-400 text-sm">No upcoming shifts this week</p>
                <Link href="/d/personnel/jobs" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#00d4aa]/20 px-4 py-2 text-sm font-medium text-[#00d4aa] transition hover:bg-[#00d4aa]/30">
                  Browse available shifts
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.map((shift: any) => {
                  const booking = shift.booking as any;
                  const venue = booking?.venues as any;
                  return (
                    <Link key={shift.id} href={`/d/personnel/shift/${shift.id}`} className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 transition hover:bg-white/[0.06]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00d4aa]/20 text-[#00d4aa] text-lg flex-shrink-0">
                        🛡️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {venue?.name || booking?.event_name || "Shift"}
                        </p>
                        <p className="text-sm text-zinc-400">
                          {formatDate(shift.scheduled_start)} · {formatTime(shift.scheduled_start)}–{formatTime(shift.scheduled_end)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-[#00d4aa]">£{shift.hourly_rate}/hr</p>
                        <p className="text-xs text-zinc-500 capitalize">{shift.status}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick actions */}
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display text-lg font-medium text-white mb-4">Quick actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: "/d/personnel/jobs", icon: "🔍", label: "Find shifts" },
                { href: "/d/personnel/availability", icon: "📅", label: "Availability" },
                { href: "/d/personnel/earnings", icon: "💰", label: "Earnings" },
                { href: "/d/personnel/messages", icon: "💬", label: "Messages" },
              ].map((action) => (
                <Link key={action.href} href={action.href} className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 transition hover:bg-white/[0.06] hover:border-[#00d4aa]/20">
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-sm text-zinc-300 font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
