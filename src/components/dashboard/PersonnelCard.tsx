"use client";

import Link from "next/link";

interface PersonnelCardProps {
  personnel: any;
}

export function PersonnelCard({ personnel }: PersonnelCardProps) {
  const name = personnel.display_name || "Unknown";
  const city = personnel.city || personnel.location_name || null;
  const certs: string[] = personnel.certs ?? personnel.skills ?? [];
  const isAvailable = personnel.is_available || personnel.status === "available";
  const isLooking = personnel.status === "looking";

  const rate =
    personnel.hourly_rate != null
      ? `£${personnel.hourly_rate}/hr`
      : personnel.rate_per_hour != null
        ? `£${(personnel.rate_per_hour / 100).toFixed(2)}/hr`
        : null;

  const score = personnel.shield_score ?? null;

  return (
    <Link
      href={`/personnel/${personnel.id}`}
      className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-shield-500/25 hover:bg-white/[0.06]"
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-shield-500/15 text-lg font-semibold text-shield-400 ring-1 ring-white/10">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{name}</span>
            {isAvailable && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                Available
              </span>
            )}
            {isLooking && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                Looking for work
              </span>
            )}
          </div>
          {city && <p className="mt-1 text-sm text-zinc-400">{city}</p>}
          {score != null && <p className="mt-1 text-sm text-zinc-500">Shield Score: {score}</p>}
          {certs.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              {certs.slice(0, 2).join(" · ")}
              {certs.length > 2 ? ` · +${certs.length - 2}` : ""}
            </p>
          )}
          {rate && <p className="mt-2 text-sm font-medium text-shield-400">{rate}</p>}
        </div>
        <span className="shrink-0 self-center text-zinc-500">→</span>
      </div>
    </Link>
  );
}
