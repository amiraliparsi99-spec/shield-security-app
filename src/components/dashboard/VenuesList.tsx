"use client";

import Link from "next/link";
import type { VenueWithRequests } from "@/lib/dashboard-mock";

interface VenuesListProps {
  venues: VenueWithRequests[];
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function VenuesList({ venues }: VenuesListProps) {
  return (
    <div className="space-y-3">
      {venues.map((v) => {
        const totalGuards = v.openRequests.reduce((s, r) => s + r.guardsCount, 0);
        const next = v.openRequests[0];
        return (
          <Link
            key={v.id}
            href={`/venue/${v.id}`}
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-shield-500/25 hover:bg-white/[0.06]"
          >
            <p className="font-semibold text-white">{v.name}</p>
            {v.address && <p className="mt-1 text-sm text-zinc-500">{v.address}</p>}
            <p className="mt-2 text-sm text-shield-400">
              Looking for {totalGuards} guard{totalGuards !== 1 ? "s" : ""}
              {next ? ` · Next: ${formatDate(next.start)}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {v.openRequests.length} open request{v.openRequests.length !== 1 ? "s" : ""} · Tap for details
            </p>
          </Link>
        );
      })}
    </div>
  );
}
