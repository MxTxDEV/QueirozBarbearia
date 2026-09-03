import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 pb-4" aria-busy="true" aria-label="Carregando dashboard">
      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-64" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48 lg:col-span-2" />
      </div>
    </div>
  );
}
