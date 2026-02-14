"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Demo Call Button - For testing the calling UI
 * Simulates incoming/outgoing calls without needing authentication
 */
export function DemoCallButton() {
  const [showDemo, setShowDemo] = useState(false);
  const [demoCallState, setDemoCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [demoParticipant, setDemoParticipant] = useState<{ name: string; role: string } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Call duration timer
  useEffect(() => {
    if (demoCallState === 'connected') {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [demoCallState]);

  // Demo participants
  const demoUsers = [
    { name: "John Security", role: "personnel" },
    { name: "Metro Venues Ltd", role: "venue" },
    { name: "Elite Security Agency", role: "agency" },
  ];

  const simulateOutgoingCall = (user: typeof demoUsers[0]) => {
    setDemoParticipant(user);
    setDemoCallState('calling');
    setCallDuration(0);
    setShowDemo(false);
    
    // Simulate connection after 3 seconds
    setTimeout(() => {
      setDemoCallState('connected');
    }, 3000);
  };

  const simulateIncomingCall = (user: typeof demoUsers[0]) => {
    setDemoParticipant(user);
    setDemoCallState('ringing');
    setShowDemo(false);
  };

  const answerCall = () => {
    setDemoCallState('connected');
    setCallDuration(0);
  };

  const endCall = () => {
    setDemoCallState('idle');
    setDemoParticipant(null);
    setCallDuration(0);
    setIsMuted(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!mounted) return null;

  return (
    <>
      {/* Incoming Call Modal */}
      <AnimatePresence>
        {demoCallState === 'ringing' && demoParticipant && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center px-8">
              <motion.div
                className="w-28 h-28 mx-auto mb-6 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="text-4xl font-bold text-white">
                  {demoParticipant.name[0]}
                </span>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-1">{demoParticipant.name}</h2>
              <p className="text-zinc-400 capitalize mb-2">{demoParticipant.role}</p>
              <motion.p
                className="text-emerald-400 text-lg mb-8"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Incoming Call...
              </motion.p>
              <div className="flex justify-center gap-8">
                <motion.button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white text-2xl"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  📵
                </motion.button>
                <motion.button
                  onClick={answerCall}
                  className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  📞
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      <AnimatePresence>
        {(demoCallState === 'calling' || demoCallState === 'connected') && demoParticipant && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-zinc-900 to-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="pt-12 pb-4 text-center">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                {demoCallState === 'calling' ? 'Calling...' : 'In Call'}
              </p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-32 h-32 mb-6 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center shadow-xl">
                <span className="text-5xl font-bold text-white">
                  {demoParticipant.name[0]}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{demoParticipant.name}</h2>
              <p className="text-zinc-400 capitalize mb-4">{demoParticipant.role}</p>
              {demoCallState === 'connected' ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-lg font-mono">{formatDuration(callDuration)}</span>
                </div>
              ) : (
                <motion.p
                  className="text-zinc-500"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Ringing...
                </motion.p>
              )}
            </div>
            <div className="pb-12 px-6">
              <div className="flex justify-center items-center gap-8">
                <motion.button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                    isMuted ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-white'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isMuted ? '🔇' : '🎤'}
                </motion.button>
                <motion.button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white text-2xl shadow-lg"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  📵
                </motion.button>
                <motion.button
                  className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-white text-2xl"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  🔊
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo Button */}
      {demoCallState === 'idle' && (
        <div className="fixed bottom-24 right-6 z-50">
          <AnimatePresence>
            {showDemo && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-16 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl mb-2"
              >
                <h3 className="text-white font-semibold mb-1">Test Call UI</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Preview the calling interface without a real connection.
                </p>
                
                <p className="text-xs text-zinc-500 mb-2 font-medium">OUTGOING CALL</p>
                <div className="space-y-2 mb-4">
                  {demoUsers.map((user, i) => (
                    <button
                      key={i}
                      onClick={() => simulateOutgoingCall(user)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-shield-500 to-emerald-500 flex items-center justify-center">
                        <span className="text-white font-bold">{user.name[0]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-zinc-500 capitalize">{user.role}</p>
                      </div>
                      <PhoneIcon className="w-5 h-5 text-emerald-400" />
                    </button>
                  ))}
                </div>

                <p className="text-xs text-zinc-500 mb-2 font-medium">INCOMING CALL</p>
                <button
                  onClick={() => simulateIncomingCall(demoUsers[0])}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-lg">📞</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-emerald-400 text-sm font-medium">Simulate Incoming Call</p>
                    <p className="text-xs text-zinc-500">See the ringing UI</p>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setShowDemo(!showDemo)}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition ${
              showDemo 
                ? 'bg-zinc-700 text-white' 
                : 'bg-gradient-to-br from-shield-500 to-emerald-500 text-white'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Test Calling Feature"
          >
            {showDemo ? (
              <XIcon className="w-6 h-6" />
            ) : (
              <TestIcon className="w-6 h-6" />
            )}
          </motion.button>
        </div>
      )}
    </>
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

function TestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
