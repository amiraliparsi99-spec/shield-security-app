import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgencyById } from "@/lib/dashboard-mock";
import { createClient } from "@/lib/supabase/server";

export default async function AgencyDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = getAgencyById(id);
  if (!agency) notFound();

  const supabase = await createClient();
  const { data: agencyRow } = await supabase.from("agencies").select("owner_id").eq("id", id).maybeSingle();
  const ownerId = agencyRow?.owner_id;

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
        <div className="grid-pattern absolute inset-0 opacity-20" />
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>

        <div className="mt-6 glass rounded-2xl p-6">
          <h1 className="font-display text-2xl font-semibold text-white">{agency.name}</h1>

          <div className="mt-3 flex flex-wrap gap-2">
            {agency.types.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-shield-500/20 px-3 py-1 text-sm font-medium text-shield-400"
              >
                {t}
              </span>
            ))}
          </div>

          {(agency.address || agency.location_name) && (
            <div className="mt-4 flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-zinc-300">{agency.address || agency.location_name}</span>
            </div>
          )}

          {(agency.staff_range || agency.rate_from) && (
            <div className="mt-4 flex flex-wrap gap-4">
              {agency.staff_range && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm text-zinc-300">{agency.staff_range}</span>
                </div>
              )}
              {agency.rate_from && (
                <span className="text-sm font-medium text-shield-400">{agency.rate_from}</span>
              )}
            </div>
          )}

          {agency.description && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-zinc-500">About</h2>
              <p className="mt-2 text-zinc-300 leading-relaxed">{agency.description}</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {ownerId && (
            <Link
              href={"/chat/start?with=" + encodeURIComponent(ownerId)}
              className="inline-flex items-center gap-2 rounded-xl bg-shield-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition hover:bg-shield-600 hover:shadow-glow active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Message
            </Link>
          )}
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 glass rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            Request a quote
          </Link>
        </div>
      </main>
    </div>
  );
}
