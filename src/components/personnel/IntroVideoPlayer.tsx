"use client";

import dynamic from "next/dynamic";

// Mux's web component is client-only; load it on demand.
const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[9/16] max-h-[420px] w-full animate-pulse rounded-xl bg-white/5" />
  ),
});

export function IntroVideoPlayer({
  playbackId,
  name,
}: {
  playbackId: string;
  name: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
      <MuxPlayer
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#00d4aa"
        metadata={{ video_title: `${name} — intro` }}
        poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`}
        style={{ width: "100%", aspectRatio: "9 / 16", maxHeight: 340 }}
      />
    </div>
  );
}
