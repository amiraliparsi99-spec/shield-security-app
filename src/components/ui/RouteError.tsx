"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Where "back to safety" should point, e.g. "/d/agency". */
  homeHref?: string;
  homeLabel?: string;
};

/**
 * Shared fallback for App Router `error.tsx` boundaries. Reports to Sentry and
 * surfaces a reference code so a beta tester can quote it in a bug report
 * instead of describing a blank screen.
 */
export function RouteError({
  error,
  reset,
  homeHref = "/",
  homeLabel = "Back to home",
}: RouteErrorProps) {
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    const eventId = Sentry.captureException(error);
    setReference(eventId ?? error.digest ?? null);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <svg
            className="h-6 w-6 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.1 12.29A1.9 1.9 0 0 0 4.88 19h14.24a1.9 1.9 0 0 0 1.64-2.77l-7.1-12.29a1.9 1.9 0 0 0-3.32 0Z"
            />
          </svg>
        </div>

        <h1 className="font-display text-xl font-semibold text-white">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          This page hit an unexpected error. The team has been notified
          automatically — trying again often clears it.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-shield-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-shield-400"
          >
            Try again
          </button>
          <Link
            href={homeHref}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            {homeLabel}
          </Link>
        </div>

        {reference && (
          <p className="mt-6 font-mono text-[11px] text-zinc-600">
            Reference: {reference}
          </p>
        )}
      </div>
    </div>
  );
}
