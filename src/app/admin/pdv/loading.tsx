import { Skeleton } from "@/components/ui/skeleton";

export default function PdvLoading() {
  return (
    <div className="space-y-6 pb-32 lg:pb-6" aria-busy="true" aria-label="Carregando PDV">
      <div>
        <Skeleton className="h-7 w-16" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
