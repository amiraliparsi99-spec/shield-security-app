"use client";

import { motion } from "framer-motion";
import { useCall } from "@/contexts/CallContext";
import type { UserRole } from "@/lib/database.types";

interface CallButtonProps {
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  bookingId?: string;
  shiftId?: string;
  variant?: "default" | "icon" | "small";
  className?: string;
}

export function CallButton({
  userId,
  name,
  role,
  avatarUrl,
  bookingId,
  shiftId,
  variant = "default",
  className = "",
}: CallButtonProps) {
  const { initiateCall, callState } = useCall();

  const handleCall = async () => {
    if (callState !== 'idle') {
      alert("You're already in a call");
      return;
    }

    await initiateCall(
      { userId, name, role, avatarUrl },
      { bookingId, shiftId }
    );
  };

  const isDisabled = callState !== 'idle';

  if (variant === "icon") {
    return (
      <motion.button
        onClick={handleCall}
        disabled={isDisabled}
        className={`w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 disabled:cursor-not-allowed flex items-center justify-center text-white transition ${className}`}
        whileHover={!isDisabled ? { scale: 1.1 } : {}}
        whileTap={!isDisabled ? { scale: 0.95 } : {}}
        title={`Call ${name}`}
      >
        <PhoneIcon className="w-5 h-5" />
      </motion.button>
    );
  }

  if (variant === "small") {
    return (
      <motion.button
        onClick={handleCall}
        disabled={isDisabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
      >
        <PhoneIcon className="w-4 h-4" />
        <span>Call</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={handleCall}
      disabled={isDisabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-medium transition ${className}`}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
    >
      <PhoneIcon className="w-5 h-5" />
      <span>Call {name}</span>
    </motion.button>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}
