"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

type CallShellProps = {
  children: React.ReactNode;
};

const CallRuntime = dynamic(
  () => import("./CallRuntime").then((m) => m.CallRuntime),
  { ssr: false }
);

export function CallShell({ children }: CallShellProps) {
  const pathname = usePathname();
  const callEnabled =
    pathname?.startsWith("/d/venue/mission-control") ||
    pathname?.startsWith("/d/venue/messages") ||
    pathname?.startsWith("/d/venue/bookings/") ||
    pathname?.startsWith("/chat");

  if (!callEnabled) {
    return <>{children}</>;
  }

  return <CallRuntime>{children}</CallRuntime>;
}

