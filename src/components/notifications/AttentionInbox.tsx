"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";

interface Notice {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  shift: "🛡️",
  payment: "💷",
  message: "💬",
  booking: "📅",
  verification: "✅",
  system: "🔔",
};

// Higher = more urgent; drives sort order within unread.
function priority(n: Notice): number {
  const kind = String(n.data?.type ?? "");
  if (kind === "sos") return 100;
  if (kind === "zone_breach") return 80;
  if (n.title?.toLowerCase().includes("cover")) return 70;
  if (kind === "venue_attendance_confirmation") return 50;
  if (n.title?.toLowerCase().includes("dispute")) return 40;
  return 10;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AttentionInbox({ basePath }: { basePath: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unread" | "all">("unread");

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, data, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);
    setItems((data as Notice[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    [supabase],
  );

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  }, [supabase, items]);

  function linkFor(n: Notice): string | null {
    const action = String(n.data?.type ?? n.data?.action ?? "");
    const bookingId = n.data?.booking_id ? String(n.data.booking_id) : null;
    if (
      action === "sos" ||
      action === "zone_breach" ||
      action === "open_live_checkin" ||
      action === "venue_attendance_confirmation"
    ) {
      return `${basePath}/live`;
    }
    if (bookingId) return `${basePath}/bookings/${bookingId}`;
    return null;
  }

  const unreadCount = items.filter((n) => !n.is_read).length;
  const visible = (filter === "unread" ? items.filter((n) => !n.is_read) : items)
    .slice()
    .sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      const p = priority(b) - priority(a);
      if (p !== 0) return p;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Needs your attention</h1>
          <p className="mt-1 text-sm text-zinc-400">
            SOS alerts, cover sourcing, attendance to confirm, and other actions in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${filter === "unread" ? "bg-shield-500 text-white" : "text-zinc-400"}`}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${filter === "all" ? "bg-shield-500 text-white" : "text-zinc-400"}`}
            >
              All
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <EmptyState
            icon="✅"
            title={filter === "unread" ? "You're all caught up" : "Nothing here yet"}
            description={
              filter === "unread"
                ? "There's nothing that needs your attention right now. Anything urgent — like a late guard or an SOS — will appear here."
                : "Alerts and updates about your shifts and staff will show up here as they happen."
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => {
            const href = linkFor(n);
            const isSos = String(n.data?.type ?? "") === "sos";
            const isBreach = String(n.data?.type ?? "") === "zone_breach";
            const inner = (
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                  isSos
                    ? "border-red-500/50 bg-red-600/10"
                    : isBreach
                      ? "border-amber-500/40 bg-amber-500/[0.06]"
                      : n.is_read
                        ? "border-white/[0.06] bg-white/[0.02]"
                        : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <span className="text-xl leading-none">{isSos ? "🆘" : TYPE_ICON[n.type ?? "system"] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isSos && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        SOS
                      </span>
                    )}
                    {!n.is_read && !isSos && <span className="h-2 w-2 shrink-0 rounded-full bg-shield-400" />}
                    <p className="truncate text-sm font-semibold text-white">{n.title ?? "Notification"}</p>
                    <span className="ml-auto shrink-0 text-[11px] text-zinc-500">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="mt-1 text-sm leading-relaxed text-zinc-300">{n.body}</p>}
                </div>
                {!n.is_read && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markRead(n.id);
                    }}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {href ? (
                  <Link href={href} onClick={() => markRead(n.id)} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
