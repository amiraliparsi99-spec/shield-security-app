import { IncidentViewer } from "@/components/venue/IncidentViewer";

export default function AgencyIncidentsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Incident Reports</h1>
        <p className="text-sm text-zinc-400 mt-1">
          View and manage incidents reported by your staff
        </p>
      </header>
      <IncidentViewer />
    </div>
  );
}
