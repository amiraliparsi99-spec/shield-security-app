"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SupportLocation {
  id: string;
  label: string;
  code: string;
  created_at: string;
}

interface SupportRequest {
  id: string;
  location: string;
  type: "unsafe" | "medical" | "lost" | "other";
  status: "pending" | "responding" | "resolved";
  created_at: string;
  responded_at?: string;
  responded_by?: string;
}

const TYPE_LABELS = {
  unsafe: { label: "Feels Unsafe", icon: "🛡️", color: "text-red-400", bg: "bg-red-500/20" },
  medical: { label: "Medical Help", icon: "🏥", color: "text-amber-400", bg: "bg-amber-500/20" },
  lost: { label: "Lost Friends", icon: "👥", color: "text-blue-400", bg: "bg-blue-500/20" },
  other: { label: "Other", icon: "💬", color: "text-purple-400", bg: "bg-purple-500/20" },
};

// QR Code Generator Component
export function QRCodeGenerator({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [locations, setLocations] = useState<SupportLocation[]>([
    { id: "1", label: "Table 1", code: btoa("Table 1"), created_at: new Date().toISOString() },
    { id: "2", label: "Table 2", code: btoa("Table 2"), created_at: new Date().toISOString() },
    { id: "3", label: "Restroom A", code: btoa("Restroom A"), created_at: new Date().toISOString() },
    { id: "4", label: "Bar Area", code: btoa("Bar Area"), created_at: new Date().toISOString() },
  ]);
  const [newLocation, setNewLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<SupportLocation | null>(null);

  const addLocation = () => {
    if (!newLocation.trim()) return;
    const location: SupportLocation = {
      id: Date.now().toString(),
      label: newLocation.trim(),
      code: btoa(newLocation.trim()),
      created_at: new Date().toISOString(),
    };
    setLocations([...locations, location]);
    setNewLocation("");
  };

  const getQRUrl = (code: string) => {
    const supportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/support/${code}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(supportUrl)}&bgcolor=1a1a2e&color=ffffff`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Silent Support QR Codes</h2>
          <p className="text-sm text-zinc-400">Generate QR codes for different locations</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">System Active</span>
        </div>
      </div>

      {/* Add new location */}
      <div className="flex gap-3">
        <input
          type="text"
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          placeholder="Add location (e.g., Table 5, VIP Area)"
          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
          onKeyDown={(e) => e.key === "Enter" && addLocation()}
        />
        <button
          onClick={addLocation}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Location Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {locations.map((location) => (
          <button
            key={location.id}
            onClick={() => setSelectedLocation(location)}
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📍</span>
              <span className="text-xs text-zinc-500 group-hover:text-blue-400 transition-colors">
                View QR →
              </span>
            </div>
            <p className="font-medium text-white">{location.label}</p>
            <p className="text-xs text-zinc-500 mt-1">Click to generate</p>
          </button>
        ))}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setSelectedLocation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-white/10"
            >
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-1">{selectedLocation.label}</h3>
                <p className="text-sm text-zinc-400 mb-6">Scan to request discreet assistance</p>
                
                <div className="bg-white p-4 rounded-xl mb-6 inline-block">
                  <img
                    src={getQRUrl(selectedLocation.code)}
                    alt={`QR Code for ${selectedLocation.label}`}
                    className="w-48 h-48"
                  />
                </div>

                <div className="space-y-3">
                  <a
                    href={getQRUrl(selectedLocation.code)}
                    download={`silent-support-${selectedLocation.label.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className="block w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
                  >
                    Download QR Code
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/support/${selectedLocation.code}`);
                      alert("Link copied!");
                    }}
                    className="block w-full py-3 px-4 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => setSelectedLocation(null)}
                    className="w-full py-2 text-zinc-500 hover:text-white transition-colors text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Real-time Alert Panel Component
export function SupportAlertPanel({ venueId }: { venueId: string }) {
  const [requests, setRequests] = useState<SupportRequest[]>([
    // Demo data - in production, this comes from Supabase realtime
    {
      id: "1",
      location: "Table 4",
      type: "unsafe",
      status: "pending",
      created_at: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    },
  ]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Simulated real-time updates
  useEffect(() => {
    // In production: 
    // const channel = supabase.channel('support_requests')
    //   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_requests' }, handleNewRequest)
    //   .subscribe();
    
    return () => {
      // channel.unsubscribe();
    };
  }, [venueId]);

  const handleRespond = (requestId: string) => {
    setRequests(requests.map(r => 
      r.id === requestId 
        ? { ...r, status: "responding", responded_at: new Date().toISOString() }
        : r
    ));
  };

  const handleResolve = (requestId: string) => {
    setRequests(requests.map(r => 
      r.id === requestId 
        ? { ...r, status: "resolved" }
        : r
    ));
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const activeRequests = requests.filter(r => r.status === "responding");

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const getTimeSince = (iso: string) => {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Support Requests</h2>
          <p className="text-sm text-zinc-400">Real-time alerts from guests</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              soundEnabled 
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                : "bg-white/5 text-zinc-500 border border-white/10"
            }`}
          >
            {soundEnabled ? "🔔 Sound On" : "🔕 Sound Off"}
          </button>
        </div>
      </div>

      {/* Pending Alerts */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-red-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Needs Attention ({pendingRequests.length})
          </h3>
          {pendingRequests.map((request) => {
            const typeInfo = TYPE_LABELS[request.type];
            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-pulse-slow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl ${typeInfo.bg} flex items-center justify-center text-2xl`}>
                      {typeInfo.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{request.location}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo.bg} ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        Requested at {formatTime(request.created_at)} • {getTimeSince(request.created_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRespond(request.id)}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-400 transition-colors whitespace-nowrap"
                  >
                    Respond Now
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Active Responses */}
      {activeRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            In Progress ({activeRequests.length})
          </h3>
          {activeRequests.map((request) => {
            const typeInfo = TYPE_LABELS[request.type];
            return (
              <div
                key={request.id}
                className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${typeInfo.bg} flex items-center justify-center text-xl`}>
                      {typeInfo.icon}
                    </div>
                    <div>
                      <span className="font-medium text-white">{request.location}</span>
                      <p className="text-sm text-zinc-400">
                        Responding since {formatTime(request.responded_at!)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolve(request.id)}
                    className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 font-medium text-sm hover:bg-green-500/30 transition-colors border border-green-500/30"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {pendingRequests.length === 0 && activeRequests.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <span className="text-3xl">✨</span>
          </div>
          <p className="text-zinc-400">No active support requests</p>
          <p className="text-sm text-zinc-500 mt-1">Requests will appear here in real-time</p>
        </div>
      )}

      {/* Recent History */}
      {requests.filter(r => r.status === "resolved").length > 0 && (
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-sm font-medium text-zinc-500 mb-3">Recently Resolved</h3>
          <div className="space-y-2">
            {requests.filter(r => r.status === "resolved").slice(0, 3).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-zinc-400">{request.location}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500">{TYPE_LABELS[request.type].label}</span>
                </div>
                <span className="text-zinc-600">{formatTime(request.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Combined Dashboard Widget
export function SilentSupportDashboard({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [activeTab, setActiveTab] = useState<"alerts" | "qrcodes">("alerts");

  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === "alerts"
              ? "text-white bg-white/5 border-b-2 border-blue-500"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          🚨 Live Alerts
        </button>
        <button
          onClick={() => setActiveTab("qrcodes")}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === "qrcodes"
              ? "text-white bg-white/5 border-b-2 border-blue-500"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          📱 QR Codes
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "alerts" && <SupportAlertPanel venueId={venueId} />}
        {activeTab === "qrcodes" && <QRCodeGenerator venueId={venueId} venueName={venueName} />}
      </div>
    </div>
  );
}
