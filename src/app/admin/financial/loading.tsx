import { Skeleton } from "@/components/ui/skeleton";

export default function FinancialLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando financeiro">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>

      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-10 w-56" />
        <div className="mt-5 flex gap-8 border-t pt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>

      <Skeleton className="h-72" />
    </div>
  );
}
