"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function VenueError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError {...props} homeHref="/d/venue" homeLabel="Back to overview" />
  );
}
