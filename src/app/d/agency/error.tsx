"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AgencyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError {...props} homeHref="/d/agency" homeLabel="Back to overview" />
  );
}
