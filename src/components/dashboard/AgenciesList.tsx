"use client";

import Link from "next/link";

interface AgenciesListProps {
  agencies: any[];
}

export function AgenciesList({ agencies }: AgenciesListProps) {
  if (!agencies || agencies.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-zinc-500">
        No security agencies registered yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {agencies.map((a) => {
        const types: string[] = a.types ?? a.specializations ?? [];
        const location = a.address || a.city || a.location_name || null;
        const staffInfo = a.staff_range ?? (a.staff_count ? `${a.staff_count}` : null);

        return (
          <Link
            key={a.id}
            href={`/agency/${a.id}`}
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-shield-500/25 hover:bg-white/[0.06]"
          >
            <p className="font-semibold text-white">{a.name}</p>
            {types.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {location && <p className="mt-2 text-sm text-zinc-500">{location}</p>}
            {staffInfo && <p className="mt-2 text-sm text-shield-400">{staffInfo} staff</p>}
            <p className="mt-1 text-xs text-zinc-500">Tap for full details</p>
          </Link>
        );
      })}
    </div>
  );
}
