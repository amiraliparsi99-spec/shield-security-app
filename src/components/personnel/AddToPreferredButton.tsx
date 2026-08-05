"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Add to Preferred Staff" toggle shown on a guard's profile. Only renders for
 * venue accounts (preferred_staff is keyed by venue). No-ops for other roles.
 */
export function AddToPreferredButton({ personnelId }: { personnelId: string }) {
  const supabase = createClient();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [preferred, setPreferred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const vid = (venue as { id?: string } | null)?.id ?? null;
      if (cancelled) return;
      setVenueId(vid);
      if (vid) {
        const { data: pref } = await supabase
          .from("preferred_staff")
          .select("personnel_id")
          .eq("venue_id", vid)
          .eq("personnel_id", personnelId)
          .maybeSingle();
        if (!cancelled) setPreferred(!!pref);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, personnelId]);

  const toggle = useCallback(async () => {
    if (!venueId || busy) return;
    setBusy(true);
    try {
      if (preferred) {
        await supabase
          .from("preferred_staff")
          .delete()
          .eq("venue_id", venueId)
          .eq("personnel_id", personnelId);
        setPreferred(false);
      } else {
        await supabase
          .from("preferred_staff")
          .upsert(
            { venue_id: venueId, personnel_id: personnelId, note: null },
            { onConflict: "venue_id,personnel_id" },
          );
        setPreferred(true);
      }
    } finally {
      setBusy(false);
    }
  }, [supabase, venueId, personnelId, preferred, busy]);

  // Not a venue (or still loading the very first time) — show nothing.
  if (loading || !venueId) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
        preferred
          ? "border border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
          : "bg-shield-500 text-white shadow-lg shadow-shield-500/20 hover:bg-shield-600"
      }`}
    >
      <svg className="h-4 w-4" fill={preferred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.8c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      {busy ? "Saving…" : preferred ? "Preferred — remove" : "Add to Preferred Staff"}
    </button>
  );
}
