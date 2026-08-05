"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches errors thrown in the root layout itself. It replaces the whole
 * document, so it cannot rely on providers, fonts or global styles being
 * mounted — everything here is inline on purpose.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080a0f",
          color: "#fafafa",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            Shield HQ hit an unexpected error
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", margin: "0 0 24px" }}>
            The team has been notified. Reloading usually clears it.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 8,
              background: "#14b8a6",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Reload Shield HQ
          </a>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 11, color: "#52525b", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
