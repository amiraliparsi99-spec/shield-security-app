"use client";

import { ShieldAIChat } from "./ShieldAIChat";

interface Props {
  userRole: "venue" | "agency" | "personnel";
}

export function ShieldAIWrapper({ userRole }: Props) {
  return <ShieldAIChat userRole={userRole} />;
}
