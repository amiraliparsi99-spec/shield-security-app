import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import Link from "next/link";
import { AdminVerificationPanel } from "@/components/verification/AdminVerificationPanel";

export default async function AdminVerificationsPage() {
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
          <div className="mb-6">
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-300 mb-4">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin
            </Link>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Review</h1>
            <p className="text-zinc-400">
              View documents submitted by security guards and personnel. Approve or reject each document; when all are approved, their account is marked verified and they can request jobs.
            </p>
          </div>
          <AdminVerificationPanel />
        </div>
      </div>
    </div>
  );
}
