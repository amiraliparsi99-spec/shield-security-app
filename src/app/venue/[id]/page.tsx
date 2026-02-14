import Link from "next/link";
import { notFound } from "next/navigation";
import { getVenueById } from "@/lib/dashboard-mock";
import type { OpenRequest } from "@/lib/dashboard-mock";
import { createClient } from "@/lib/supabase/server";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatTimeRange(start: string, end?: string) {
  try {
    const s = new Date(start);
    const startStr = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (end) {
      const e = new Date(end);
      return `${startStr} – ${e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return startStr;
  } catch {
    return start;
  }
}

function VenueTypeLabel(t: string) {
  const labels: Record<string, string> = {
    club: "Club",
    bar: "Bar",
    stadium: "Stadium / Arena",
    event_space: "Event space",
    restaurant: "Restaurant",
    corporate: "Corporate",
    retail: "Retail",
    other: "Other",
  };
  return labels[t] ?? t;
}

function RequestCard({ r }: { r: OpenRequest }) {
  const rate = r.rateOffered != null ? `£${(r.rateOffered / 100).toFixed(2)}/hr` : null;
  return (
    <div className="glass rounded-2xl p-4 transition-all hover:shadow-glow-sm">
      <h3 className="font-semibold text-white">{r.title}</h3>
      <p className="mt-1 text-sm text-zinc-400">
        {formatDate(r.start)}
        {r.end && ` · ${formatTimeRange(r.start, r.end)}`}
      </p>
      <p className="mt-2 text-sm text-shield-400">
        {r.guardsCount} guard{r.guardsCount !== 1 ? "s" : ""} needed
        {rate && ` · ${rate}`}
      </p>
      {r.certsRequired && r.certsRequired.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          Certs: {r.certsRequired.join(", ")}
        </p>
      )}
      {r.description && <p className="mt-2 text-sm text-zinc-400">{r.description}</p>}
    </div>
  );
}

export default async function VenueDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = getVenueById(id);
  if (!venue) notFound();

  const supabase = await createClient();
  const { data: venueRow } = await supabase.from("venues").select("owner_id").eq("id", id).maybeSingle();
  const ownerId = venueRow?.owner_id;

  const totalGuards = venue.openRequests.reduce((s, r) => s + r.guardsCount, 0);

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
          <h1 className="font-display text-2xl font-semibold text-white">{venue.name}</h1>

          {venue.venueType && (
            <span className="mt-3 inline-block rounded-full bg-shield-500/20 px-3 py-1 text-xs font-medium text-shield-400">
              {VenueTypeLabel(venue.venueType)}
            </span>
          )}

          {venue.address && (
            <div className="mt-4 flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-zinc-300">{venue.address}</span>
            </div>
          )}

          {venue.description && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-zinc-500">About the venue</h2>
              <p className="mt-2 text-zinc-300 leading-relaxed">{venue.description}</p>
            </div>
          )}

          {venue.capacity != null && (
            <p className="mt-4 text-sm text-zinc-500">Capacity: <span className="text-zinc-400">{venue.capacity.toLocaleString()}</span></p>
          )}

          {ownerId && (
            <div className="mt-6">
              <Link
                href={"/chat/start?with=" + encodeURIComponent(ownerId)}
                className="inline-flex items-center gap-2 rounded-xl bg-shield-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition hover:bg-shield-600 hover:shadow-glow active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message venue
              </Link>
            </div>
          )}
        </div>

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-white">What we&apos;re looking for</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {venue.openRequests.length} open request{venue.openRequests.length !== 1 ? "s" : ""} · {totalGuards} guard{totalGuards !== 1 ? "s" : ""} needed in total
          </p>
          <div className="mt-4 space-y-4">
            {venue.openRequests.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
