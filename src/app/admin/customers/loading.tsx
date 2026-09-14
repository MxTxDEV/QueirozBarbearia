import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando clientes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <Skeleton className="h-10 w-full max-w-sm" />

      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
