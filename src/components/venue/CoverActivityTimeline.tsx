"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Cover Activity Timeline.
 *
 * Renders a chronological history of every cover-related event for a shift:
 *   - Travel risk ring escalations (R3 → R4 → R5 → R6)
 *   - Cover wave broadenings (Wave 1 5mi → Wave 2 15mi → Wave 3 25mi)
 *   - Replacement found / unfilled / original-guard recovered states
 *
 * Reads from `shift_travel_risk_events` and `shift_cover_waves` (both have
 * RLS rules limiting venues to their own bookings — see migrations 0054/0056).
 *
 * Fails gracefully if either table doesn't exist (leaves the section empty).
 */

type TimelineRow = {
  id: string;
  kind: "ring" | "wave";
  at: string;
  ring?: string | null;
  wave?: number | null;
  radius_miles?: number | null;
  trigger?: string | null;
  reason?: string | null;
  guards_notified?: number | null;
  offers_created?: number | null;
  distance_m?: number | null;
};

const RING_LABELS: Record<string, { icon: string; copy: string; tone: string }> = {
  R3: { icon: "🟡", copy: "Status unclear", tone: "text-amber-300" },
  R4: { icon: "🟠", copy: "Late risk flagged", tone: "text-orange-300" },
  R5: { icon: "🔴", copy: "Sourcing cover started", tone: "text-red-300" },
  R6: { icon: "❌", copy: "Marked no-show", tone: "text-red-400" },
  cleared: { icon: "✅", copy: "Recovered — back on track", tone: "text-emerald-300" },
};

const TRIGGER_LABELS: Record<string, string> = {
  guard_withdrawal: "Original guard released",
  venue_release: "Released by venue",
  ring_r5: "Auto-triggered (R5)",
  ring_r6: "Auto-triggered (no-show)",
  wave_expired: "Previous wave expired",
  manual: "Manual",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CoverActivityTimeline({ shiftId }: { shiftId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const fetchRows = async () => {
      const merged: TimelineRow[] = [];

      // Travel risk events — best-effort, table may not exist on older schema.
      try {
        const { data: ringRows } = await (supabase as any)
          .from("shift_travel_risk_events")
          .select("id, ring, trigger_reason, distance_m, created_at")
          .eq("shift_id", shiftId)
          .order("created_at", { ascending: true })
          .limit(50);
        for (const r of (ringRows ?? []) as Array<{
          id: string;
          ring: string;
          trigger_reason: string | null;
          distance_m: number | null;
          created_at: string;
        }>) {
          merged.push({
            id: `ring-${r.id}`,
            kind: "ring",
            at: r.created_at,
            ring: r.ring,
            reason: r.trigger_reason,
            distance_m: r.distance_m,
          });
        }
      } catch {
        // ignore
      }

      // Cover waves — best-effort.
      try {
        const { data: waveRows } = await (supabase as any)
          .from("shift_cover_waves")
          .select("id, wave, radius_miles, trigger, guards_notified, offers_created, created_at")
          .eq("shift_id", shiftId)
          .order("created_at", { ascending: true })
          .limit(50);
        for (const w of (waveRows ?? []) as Array<{
          id: string;
          wave: number;
          radius_miles: number;
          trigger: string;
          guards_notified: number;
          offers_created: number;
          created_at: string;
        }>) {
          merged.push({
            id: `wave-${w.id}`,
            kind: "wave",
            at: w.created_at,
            wave: w.wave,
            radius_miles: w.radius_miles,
            trigger: w.trigger,
            guards_notified: w.guards_notified,
            offers_created: w.offers_created,
          });
        }
      } catch {
        // ignore
      }

      merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      if (!cancelled) {
        setRows(merged);
        setLoaded(true);
      }
    };

    void fetchRows();
    const refresh = setInterval(fetchRows, 30_000);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [shiftId, supabase]);

  if (!loaded) {
    return (
      <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-500">
        Loading cover activity…
      </div>
    );
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Cover Activity
        </h4>
        <span className="text-[10px] text-zinc-600">{rows.length} event{rows.length === 1 ? "" : "s"}</span>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center text-sm">
              {r.kind === "ring"
                ? (RING_LABELS[r.ring ?? ""]?.icon ?? "•")
                : r.wave === 1
                  ? "🟡"
                  : r.wave === 2
                    ? "🟠"
                    : "🔴"}
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`font-medium ${
                    r.kind === "ring"
                      ? RING_LABELS[r.ring ?? ""]?.tone ?? "text-zinc-300"
                      : "text-zinc-200"
                  }`}
                >
                  {r.kind === "ring"
                    ? RING_LABELS[r.ring ?? ""]?.copy ?? `Ring ${r.ring}`
                    : `Wave ${r.wave} of 3 (${r.radius_miles} mi)`}
                </span>
                <span className="text-[10px] text-zinc-500" title={new Date(r.at).toLocaleString()}>
                  {formatTime(r.at)} · {formatRelative(r.at, now)}
                </span>
              </div>

              {r.kind === "ring" && r.distance_m != null ? (
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  Guard was{" "}
                  {r.distance_m < 1000
                    ? `${r.distance_m} m`
                    : `${(r.distance_m / 1000).toFixed(1)} km`}{" "}
                  from site
                  {r.reason ? ` · ${r.reason.replace(/_/g, " ")}` : ""}
                </div>
              ) : null}

              {r.kind === "wave" ? (
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {TRIGGER_LABELS[r.trigger ?? ""] ?? r.trigger ?? "Cover sourced"}
                  {typeof r.guards_notified === "number" ? (
                    <> · {r.guards_notified} guard{r.guards_notified === 1 ? "" : "s"} notified</>
                  ) : null}
                  {typeof r.offers_created === "number" && r.offers_created > 0 ? (
                    <> · {r.offers_created} offer{r.offers_created === 1 ? "" : "s"} sent</>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
