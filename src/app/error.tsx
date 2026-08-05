"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function AppError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} homeHref="/" homeLabel="Back to home" />;
}
