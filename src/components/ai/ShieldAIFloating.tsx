"use client";

import { useEffect, useState } from "react";
import { ShieldAI, ShieldAIButton } from "./ShieldAI";

interface Props {
  userRole: "venue" | "agency" | "personnel";
  userName?: string;
}

/**
 * Self-contained floating Shield AI helper. Drop this into any dashboard
 * layout to give that role a persistent "ask the assistant" button in the
 * bottom-right corner. It manages its own open/closed state, so no surrounding
 * provider is required.
 */
export function ShieldAIFloating({ userRole, userName }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Allow anything (e.g. the top-bar Help menu) to open the assistant via
  // `window.dispatchEvent(new CustomEvent("shield-ai:open"))`.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener("shield-ai:open", open);
    return () => window.removeEventListener("shield-ai:open", open);
  }, []);

  return (
    <>
      {!isOpen && <ShieldAIButton onClick={() => setIsOpen(true)} />}
      <ShieldAI
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userRole={userRole}
        userName={userName}
      />
    </>
  );
}
