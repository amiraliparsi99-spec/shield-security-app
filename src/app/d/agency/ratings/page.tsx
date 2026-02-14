import { StaffRatings } from "@/components/venue/StaffRatings";

export default function AgencyRatingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Staff Ratings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          View feedback and ratings from venues for your staff
        </p>
      </header>
      <StaffRatings />
    </div>
  );
}
