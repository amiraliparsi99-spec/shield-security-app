"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/lib/db/notifications";
import { useDropdown } from "./useDropdown";

type Role = "venue" | "personnel" | "agency" | "admin";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function attentionPath(role: Role): string {
  switch (role) {
    case "venue":
      return "/d/venue/attention";
    case "agency":
      return "/d/agency/attention";
    case "personnel":
      return "/d/personnel";
    default:
      return "/admin";
  }
}

export function NotificationsBell({ userId, role }: { userId: string; role: Role }) {
  const supabase = createClient();
  const router = useRouter();
  const { open, setOpen, ref } = useDropdown();

  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [count, notifications] = await Promise.all([
      getUnreadCount(supabase, userId),
      getUserNotifications(supabase, userId, { limit: 8 }),
    ]);
    setUnread(count);
    setItems(notifications as NotificationRow[]);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Initial load + light polling so the badge stays roughly current.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh list when opening.
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  async function handleItemClick(n: NotificationRow) {
    if (!n.is_read) {
      markAsRead(supabase, n.id);
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i))
      );
    }
    setOpen(false);

    const data = n.data ?? {};
    if (data.booking_id && role === "venue") {
      router.push(`/d/venue/bookings/${data.booking_id}`);
    } else if (data.booking_id && role === "agency") {
      router.push(`/d/agency/bookings/${data.booking_id}`);
    } else {
      router.push(attentionPath(role));
    }
  }

  async function handleMarkAll() {
    await markAllAsRead(supabase, userId);
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-shield-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-shield-400 transition hover:text-shield-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                You&apos;re all caught up.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.is_read ? "bg-transparent" : "bg-shield-400"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400 line-clamp-2">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-zinc-600">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(attentionPath(role));
            }}
            className="block w-full border-t border-white/[0.06] px-4 py-3 text-center text-xs font-medium text-shield-400 transition hover:bg-white/[0.04] hover:text-shield-300"
          >
            View everything that needs attention
          </button>
        </div>
      )}
    </div>
  );
}
