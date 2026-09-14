import { Skeleton } from "@/components/ui/skeleton";

export default function BarbersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando barbeiros">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
