"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCall, formatCallDuration } from "@/contexts/CallContext";

export function ActiveCallOverlay() {
  const { 
    callState, 
    remoteParticipant, 
    isMuted, 
    callDuration,
    isIncomingCall,
    toggleMute, 
    endCall 
  } = useCall();

  // Show overlay for calling, connecting, or connected states (but not for incoming ringing)
  const isVisible = ['calling', 'connecting', 'connected'].includes(callState) && !isIncomingCall;

  if (!isVisible || !remoteParticipant) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Top bar */}
        <div className="pt-12 pb-4 px-6 text-center">
          <p className="text-sm text-zinc-500 uppercase tracking-wider">
            {callState === 'calling' && 'Calling...'}
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'connected' && 'In Call'}
          </p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Avatar */}
          <motion.div
            className="relative mb-6"
            animate={callState === 'connected' ? {} : {
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Connection indicator ring */}
            {callState === 'connected' && (
              <motion.div
                className="absolute -inset-2 rounded-full border-2 border-emerald-500/30"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
            
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-shield-500/20">
              {remoteParticipant.avatarUrl ? (
                <img
                  src={remoteParticipant.avatarUrl}
                  alt={remoteParticipant.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-5xl font-bold text-white">
                  {remoteParticipant.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </motion.div>

          {/* Participant info */}
          <h2 className="text-2xl font-bold text-white mb-1">
            {remoteParticipant.name}
          </h2>
          <p className="text-zinc-400 capitalize mb-4">
            {remoteParticipant.role}
          </p>

          {/* Call status/duration */}
          {callState === 'connected' ? (
            <motion.div
              className="flex items-center gap-2 text-emerald-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-lg font-mono">
                {formatCallDuration(callDuration)}
              </span>
            </motion.div>
          ) : (
            <motion.p
              className="text-zinc-500"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {callState === 'calling' ? 'Ringing...' : 'Establishing connection...'}
            </motion.p>
          )}
        </div>

        {/* Call controls */}
        <div className="pb-12 px-6">
          <div className="flex justify-center items-center gap-8">
            {/* Mute button */}
            <motion.button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                isMuted 
                  ? 'bg-white text-zinc-900' 
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {isMuted ? (
                <MicOffIcon className="w-6 h-6" />
              ) : (
                <MicIcon className="w-6 h-6" />
              )}
            </motion.button>

            {/* End call button */}
            <motion.button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <EndCallIcon className="w-8 h-8" />
            </motion.button>

            {/* Speaker button (placeholder) */}
            <motion.button
              className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <SpeakerIcon className="w-6 h-6" />
            </motion.button>
          </div>

          {/* Button labels */}
          <div className="flex justify-center items-center gap-8 mt-3">
            <span className="w-14 text-center text-xs text-zinc-500">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
            <span className="w-16 text-center text-xs text-zinc-500">End</span>
            <span className="w-14 text-center text-xs text-zinc-500">Speaker</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
      />
    </svg>
  );
}

function EndCallIcon({ className }: { className?: string }) {
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

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}
