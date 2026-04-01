import { StatsSkeleton, CardSkeleton, ListSkeleton } from "@/components/ui/LoadingStates";

export default function VenueDashboardLoading() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0 opacity-50" />
      </div>
      <header className="shrink-0 glass border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="h-7 w-40 shimmer rounded" />
        <div className="mt-2 h-4 w-64 shimmer rounded" />
      </header>
      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <StatsSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="glass rounded-xl p-6">
          <div className="h-5 w-36 shimmer rounded mb-4" />
          <ListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}
