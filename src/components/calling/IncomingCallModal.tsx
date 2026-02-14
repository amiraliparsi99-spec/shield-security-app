"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCall } from "@/contexts/CallContext";

export function IncomingCallModal() {
  const { callState, isIncomingCall, remoteParticipant, answerCall, rejectCall } = useCall();

  const isVisible = callState === 'ringing' && isIncomingCall;

  if (!isVisible || !remoteParticipant) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="text-center px-8"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          {/* Pulsing avatar */}
          <div className="relative mb-6">
            <motion.div
              className="absolute inset-0 bg-emerald-500/30 rounded-full"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ width: 120, height: 120, margin: "0 auto" }}
            />
            <motion.div
              className="absolute inset-0 bg-emerald-500/20 rounded-full"
              animate={{
                scale: [1, 1.6, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
              }}
              style={{ width: 120, height: 120, margin: "0 auto" }}
            />
            <div className="relative w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center">
              {remoteParticipant.avatarUrl ? (
                <img
                  src={remoteParticipant.avatarUrl}
                  alt={remoteParticipant.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {remoteParticipant.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Caller info */}
          <h2 className="text-2xl font-bold text-white mb-1">
            {remoteParticipant.name}
          </h2>
          <p className="text-zinc-400 mb-2 capitalize">
            {remoteParticipant.role}
          </p>
          <motion.p
            className="text-emerald-400 text-lg mb-8"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Incoming Call...
          </motion.p>

          {/* Action buttons */}
          <div className="flex justify-center gap-8">
            {/* Decline */}
            <motion.button
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <DeclineIcon className="w-8 h-8" />
            </motion.button>

            {/* Accept */}
            <motion.button
              onClick={answerCall}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <PhoneIcon className="w-8 h-8" />
            </motion.button>
          </div>

          {/* Labels */}
          <div className="flex justify-center gap-12 mt-4">
            <span className="text-sm text-zinc-500">Decline</span>
            <span className="text-sm text-zinc-500">Accept</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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

function DeclineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
      />
    </svg>
  );
}
