import { ShiftScheduler } from "@/components/agency/ShiftScheduler";

export default function SchedulerPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Shift Scheduler</h1>
        <p className="text-zinc-400 mt-1">Drag and drop staff to assign shifts</p>
      </div>
      <ShiftScheduler />
    </div>
  );
}
