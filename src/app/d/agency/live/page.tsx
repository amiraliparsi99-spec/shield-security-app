import { LiveCheckIn } from "@/components/venue/LiveCheckIn";

export default function AgencyLivePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <LiveCheckIn ownerType="agency" />
    </div>
  );
}
