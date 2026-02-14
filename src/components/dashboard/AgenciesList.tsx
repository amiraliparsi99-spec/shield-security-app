"use client";

import Link from "next/link";
import type { Agency } from "@/lib/dashboard-mock";

interface AgenciesListProps {
  agencies: Agency[];
}

export function AgenciesList({ agencies }: AgenciesListProps) {
  return (
    <div className="space-y-3">
      {agencies.map((a) => (
        <Link
          key={a.id}
          href={`/agency/${a.id}`}
          className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-shield-500/25 hover:bg-white/[0.06]"
        >
          <p className="font-semibold text-white">{a.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {a.types.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
          {(a.address || a.location_name) && (
            <p className="mt-2 text-sm text-zinc-500">
              {a.address || a.location_name}
            </p>
          )}
          <p className="mt-2 text-sm text-shield-400">
            {a.staff_range && `${a.staff_range} staff`}
            {a.staff_range && a.rate_from && " · "}
            {a.rate_from}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Tap for full details</p>
        </Link>
      ))}
    </div>
  );
}
