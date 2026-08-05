"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function PersonnelError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      {...props}
      homeHref="/d/personnel"
      homeLabel="Back to overview"
    />
  );
}
