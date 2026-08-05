"use client";

import { useResetTour } from "./OnboardingTour";

interface ReplayTourButtonProps {
  tourId: string;
  className?: string;
}

export function ReplayTourButton({ tourId, className }: ReplayTourButtonProps) {
  const resetTour = useResetTour(tourId);

  return (
    <button
      type="button"
      onClick={resetTour}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
      }
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      Replay app tour
    </button>
  );
}
