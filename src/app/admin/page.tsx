import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userIsAdmin = await isAdmin(supabase, user.id);
  if (!userIsAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
            <p className="text-zinc-400">Manage verifications, users, and platform settings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Verifications */}
            <Link
              href="/admin/verifications"
              className="glass rounded-xl p-6 transition-all hover:shadow-glow-sm group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-shield-500/20 rounded-lg flex items-center justify-center group-hover:bg-shield-500/30 transition">
                  <svg
                    className="w-6 h-6 text-shield-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-shield-400 transition">Verifications</h3>
                  <p className="text-sm text-zinc-500">Review pending verifications</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">
                Review and approve documents submitted by personnel and agencies
              </p>
            </Link>

            {/* Users (Future) */}
            <div className="glass rounded-xl p-6 opacity-60">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Users</h3>
                  <p className="text-sm text-zinc-500">Coming soon</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">Manage users and permissions</p>
            </div>

            {/* Analytics (Future) */}
            <div className="glass rounded-xl p-6 opacity-60">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Analytics</h3>
                  <p className="text-sm text-zinc-500">Coming soon</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">View platform statistics and insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
