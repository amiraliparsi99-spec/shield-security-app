"use client";

import { useCallback, useEffect, useState } from "react";
import { IntroVideoPlayer } from "@/components/personnel/IntroVideoPlayer";

interface PendingVideo {
  id: string;
  display_name: string;
  intro_video_playback_id: string | null;
  intro_video_uploaded_at: string | null;
}

export function AdminIntroVideoPanel() {
  const [items, setItems] = useState<PendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/intro-videos");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (personnelId: string, action: "approve" | "reject") => {
    setBusyId(personnelId);
    try {
      const res = await fetch("/api/admin/intro-videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId, action }),
      });
      if (res.ok) setItems((prev) => prev.filter((p) => p.id !== personnelId));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
        No intro videos awaiting review.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3">
            <p className="font-medium text-white">{item.display_name}</p>
            {item.intro_video_uploaded_at && (
              <p className="text-xs text-zinc-500">
                Uploaded{" "}
                {new Date(item.intro_video_uploaded_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          {item.intro_video_playback_id ? (
            <div className="max-w-[220px]">
              <IntroVideoPlayer
                playbackId={item.intro_video_playback_id}
                name={item.display_name}
              />
            </div>
          ) : (
            <p className="text-xs text-amber-400">No playback id.</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => review(item.id, "approve")}
              disabled={busyId === item.id}
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {busyId === item.id ? "…" : "Approve"}
            </button>
            <button
              onClick={() => review(item.id, "reject")}
              disabled={busyId === item.id}
              className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
