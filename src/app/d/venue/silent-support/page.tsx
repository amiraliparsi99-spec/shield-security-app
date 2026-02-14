import { SilentSupportDashboard } from "@/components/venue/SilentSupport";

export const metadata = {
  title: "Silent Support | Shield",
  description: "Discreet guest safety system",
};

export default function SilentSupportPage() {
  // In production, get venue ID from session
  const venueId = "venue-demo";
  const venueName = "The Night Owl";

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🤝</span>
          <h1 className="font-display text-2xl font-semibold text-white">Silent Support</h1>
        </div>
        <p className="text-zinc-400 max-w-2xl">
          Give your guests a discreet way to request help. Like "Ask for Angela" but digital - 
          guests scan a QR code to alert security without drawing attention.
        </p>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-1">Today's Requests</p>
          <p className="text-2xl font-semibold text-white">3</p>
          <p className="text-xs text-green-400 mt-1">All resolved ✓</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-1">Avg. Response Time</p>
          <p className="text-2xl font-semibold text-white">45s</p>
          <p className="text-xs text-zinc-500 mt-1">Under 1 min target</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-1">Active Locations</p>
          <p className="text-2xl font-semibold text-white">12</p>
          <p className="text-xs text-zinc-500 mt-1">QR codes generated</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-zinc-500 mb-1">This Month</p>
          <p className="text-2xl font-semibold text-white">47</p>
          <p className="text-xs text-blue-400 mt-1">+23% vs last month</p>
        </div>
      </div>

      {/* Main Dashboard */}
      <SilentSupportDashboard venueId={venueId} venueName={venueName} />

      {/* How It Works */}
      <div className="mt-8 glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">1️⃣</span>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Print & Place QR Codes</p>
              <p className="text-sm text-zinc-400">
                Generate QR codes for each location - tables, restrooms, bar areas. Print and display discreetly.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">2️⃣</span>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Guest Scans for Help</p>
              <p className="text-sm text-zinc-400">
                Guest feeling unsafe scans the QR code on their phone. No app download required.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">3️⃣</span>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Security Responds Discreetly</p>
              <p className="text-sm text-zinc-400">
                You receive an instant alert with the exact location. Staff approaches casually to help.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
