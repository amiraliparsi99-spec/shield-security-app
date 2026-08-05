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
  // Mount the call runtime across the whole dashboard (venue, agency, and
  // personnel) plus chat. Call UI (CallButton / useCall) lives on mission
  // control, messages, booking detail and shift pages for every role, so the
  // provider must wrap all of them — not just venue paths.
  const callEnabled =
    pathname?.startsWith("/d/") || pathname?.startsWith("/chat");

  if (!callEnabled) {
    return <>{children}</>;
  }

  return <CallRuntime>{children}</CallRuntime>;
}

