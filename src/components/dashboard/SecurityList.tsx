"use client";

import type { Personnel } from "@/types/database";
import { PersonnelCard } from "./PersonnelCard";

interface SecurityListProps {
  personnel: Personnel[];
}

export function SecurityList({ personnel }: SecurityListProps) {
  return (
    <div className="space-y-3">
      {personnel.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-zinc-500">
          No security personnel available in this area right now.
        </p>
      ) : (
        personnel.map((p) => <PersonnelCard key={p.id} personnel={p} />)
      )}
    </div>
  );
}
