"use client";

import Link from "next/link";
import type { OpenRequest, VenueWithRequests } from "@/lib/dashboard-mock";
import { formatRequestDate, formatTimeRange } from "@/lib/format";

interface VenuesWhenListProps {
  venues: VenueWithRequests[];
}

type Slot = { request: OpenRequest; venue: VenueWithRequests };

function buildSlots(venues: VenueWithRequests[]): Slot[] {
  const slots: Slot[] = [];
  for (const v of venues) {
    for (const r of v.openRequests) {
      slots.push({ request: r, venue: v });
    }
  }
  slots.sort((a, b) => new Date(a.request.start).getTime() - new Date(b.request.start).getTime());
  return slots;
}

export function VenuesWhenList({ venues }: VenuesWhenListProps) {
  const slots = buildSlots(venues);

  if (slots.length === 0) {
    return (
      <p className="py-6 text-sm text-zinc-500">
        No shifts in this period. Try a different search or check back later.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {slots.map(({ request, venue }) => {
        const rate = request.rateOffered != null ? `£${(request.rateOffered / 100).toFixed(2)}/hr` : null;
        return (
          <div
            key={request.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/venue/${venue.id}`}
                  className="font-semibold text-white hover:text-shield-400"
                >
                  {venue.name}
                </Link>
                <p className="mt-0.5 text-sm text-zinc-400">{request.title}</p>
              </div>
              <Link
                href="/signup"
                className="shrink-0 rounded-xl bg-shield-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-shield-500/20 transition hover:bg-shield-600 active:scale-[0.98]"
              >
                Confirm availability
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-300">
              {formatRequestDate(request.start)}
              {request.end && ` · ${formatTimeRange(request.start, request.end)}`}
            </p>
            <p className="mt-1 text-sm text-shield-400">
              {request.guardsCount} guard{request.guardsCount !== 1 ? "s" : ""} needed
              {rate && ` · ${rate}`}
            </p>
            {request.certsRequired && request.certsRequired.length > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Certs: {request.certsRequired.join(", ")}
              </p>
            )}
            {request.description && (
              <p className="mt-2 text-sm text-zinc-500 line-clamp-2">{request.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
