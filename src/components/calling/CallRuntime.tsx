"use client";

import { CallProvider } from "@/contexts/CallContext";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { IncomingCallModal } from "./IncomingCallModal";

type CallRuntimeProps = {
  children: React.ReactNode;
};

export function CallRuntime({ children }: CallRuntimeProps) {
  return (
    <CallProvider>
      {children}
      <IncomingCallModal />
      <ActiveCallOverlay />
    </CallProvider>
  );
}

