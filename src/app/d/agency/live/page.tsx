import { LiveCheckIn } from "@/components/venue/LiveCheckIn";

export default function AgencyLivePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Live Tracking</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor your staff in real-time across all active shifts
        </p>
      </header>
      <LiveCheckIn />
    </div>
  );
}
