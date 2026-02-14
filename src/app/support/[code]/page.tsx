"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type SupportType = "unsafe" | "medical" | "lost" | "other";

interface LocationInfo {
  venue_name: string;
  location_label: string; // e.g., "Table 4", "Restroom A"
  venue_id: string;
}

export default function SilentSupportPage() {
  const params = useParams();
  const code = params.code as string;
  
  const [step, setStep] = useState<"initial" | "type" | "sending" | "sent" | "error">("initial");
  const [supportType, setSupportType] = useState<SupportType | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Decode location info from the QR code
  useEffect(() => {
    try {
      // In production, this would fetch from Supabase using the code
      // For now, decode from a base64 encoded string or fetch from API
      const mockData: LocationInfo = {
        venue_name: "The Night Owl",
        location_label: decodeLocationFromCode(code),
        venue_id: "venue-123",
      };
      setLocationInfo(mockData);
    } catch (e) {
      console.error("Invalid support code");
    }
    setLoading(false);
  }, [code]);

  const decodeLocationFromCode = (code: string): string => {
    // Simple decode - in production, fetch from DB
    try {
      const decoded = atob(code);
      return decoded || "Unknown Location";
    } catch {
      // If not base64, use as-is or show generic
      return code.replace(/-/g, " ") || "This Location";
    }
  };

  const handleRequestHelp = () => {
    setStep("type");
  };

  const handleSelectType = async (type: SupportType) => {
    setSupportType(type);
    setStep("sending");
    
    // Simulate sending request (in production, this calls Supabase)
    try {
      // await fetch('/api/support/request', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     code,
      //     type,
      //     venue_id: locationInfo?.venue_id,
      //     location: locationInfo?.location_label,
      //   })
      // });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStep("sent");
    } catch (error) {
      setStep("error");
    }
  };

  const supportTypes: { type: SupportType; label: string; icon: string; description: string }[] = [
    { 
      type: "unsafe", 
      label: "I feel unsafe", 
      icon: "🛡️",
      description: "Someone is making me uncomfortable"
    },
    { 
      type: "medical", 
      label: "Need medical help", 
      icon: "🏥",
      description: "Feeling unwell or injured"
    },
    { 
      type: "lost", 
      label: "Lost my friends", 
      icon: "👥",
      description: "Help finding my group"
    },
    { 
      type: "other", 
      label: "Other assistance", 
      icon: "💬",
      description: "General help needed"
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Subtle animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/60">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {locationInfo?.venue_name || "Venue"}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <AnimatePresence mode="wait">
            {/* Initial State */}
            {step === "initial" && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center max-w-sm"
              >
                <div className="mb-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                    <span className="text-4xl">🤝</span>
                  </div>
                  <h1 className="text-2xl font-semibold mb-2">Silent Support</h1>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Need discreet assistance? Our team will come to you without drawing attention.
                  </p>
                </div>

                <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/40 mb-1">Your location</p>
                  <p className="text-lg font-medium">{locationInfo?.location_label}</p>
                </div>

                <button
                  onClick={handleRequestHelp}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Request Discreet Help
                </button>

                <p className="mt-6 text-xs text-white/40">
                  Your request is private. Staff will approach casually.
                </p>
              </motion.div>
            )}

            {/* Type Selection */}
            {step === "type" && (
              <motion.div
                key="type"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-sm"
              >
                <button 
                  onClick={() => setStep("initial")}
                  className="mb-6 text-white/60 text-sm flex items-center gap-2 hover:text-white transition-colors"
                >
                  ← Back
                </button>

                <h2 className="text-xl font-semibold mb-2 text-center">How can we help?</h2>
                <p className="text-white/60 text-sm text-center mb-6">
                  Select the type of assistance you need
                </p>

                <div className="space-y-3">
                  {supportTypes.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleSelectType(item.type)}
                      className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          {item.icon}
                        </div>
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-white/50">{item.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Sending State */}
            {step === "sending" && (
              <motion.div
                key="sending"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center"
              >
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Alerting Security...</h2>
                <p className="text-white/60 text-sm">Please stay where you are</p>
              </motion.div>
            )}

            {/* Success State */}
            {step === "sent" && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center max-w-sm"
              >
                <motion.div 
                  className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <span className="text-5xl">✓</span>
                </motion.div>
                <h2 className="text-2xl font-semibold mb-2">Help is on the way</h2>
                <p className="text-white/60 text-sm mb-8 leading-relaxed">
                  A team member will approach you casually at <strong className="text-white">{locationInfo?.location_label}</strong> within the next few minutes.
                </p>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left mb-6">
                  <p className="text-xs text-white/40 mb-2">What to expect</p>
                  <ul className="text-sm text-white/80 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      Staff will approach naturally, like checking on your table
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      You can explain the situation privately
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400">•</span>
                      They can help you leave safely if needed
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => setStep("initial")}
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  Need to request again?
                </button>
              </motion.div>
            )}

            {/* Error State */}
            {step === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center max-w-sm"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <span className="text-4xl">⚠️</span>
                </div>
                <h2 className="text-xl font-semibold mb-2">Connection Issue</h2>
                <p className="text-white/60 text-sm mb-6">
                  We couldn't send your request. Please try again or speak to any staff member directly.
                </p>
                <button
                  onClick={() => setStep("initial")}
                  className="w-full py-3 px-6 rounded-xl bg-white/10 font-medium hover:bg-white/20 transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className="text-xs text-white/30">
            Powered by Shield • Your safety matters
          </p>
        </footer>
      </div>
    </div>
  );
}
