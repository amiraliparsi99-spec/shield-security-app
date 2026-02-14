"use client";

import Link from "next/link";
import type { Personnel } from "@/types/database";
import { formatLocation, formatExperience } from "@/lib/format";

interface PersonnelCardProps {
  personnel: Personnel;
}

export function PersonnelCard({ personnel }: PersonnelCardProps) {
  const rate =
    personnel.rate_per_hour != null
      ? `£${(personnel.rate_per_hour / 100).toFixed(2)}/hr`
      : null;

  return (
    <Link
      href={`/personnel/${personnel.id}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-shield-500/25 hover:bg-white/[0.06]"
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-shield-500/15 text-lg font-semibold text-shield-400 ring-1 ring-white/10">
          {personnel.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{personnel.display_name}</span>
            {personnel.status === "available" && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                Available
              </span>
            )}
            {personnel.status === "looking" && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                Looking for work
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">{formatLocation(personnel)}</p>
          <p className="mt-1 text-sm text-zinc-500">{formatExperience(personnel)}</p>
          {personnel.certs.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              {personnel.certs.slice(0, 2).join(" · ")}
              {personnel.certs.length > 2 ? ` · +${personnel.certs.length - 2}` : ""}
            </p>
          )}
          {rate && <p className="mt-2 text-sm font-medium text-shield-400">{rate}</p>}
        </div>
        <span className="shrink-0 self-center text-zinc-500">→</span>
      </div>
    </Link>
  );
}
