import { Skeleton } from "@/components/ui/skeleton";

export default function CompanyBookingLandingLoading() {
  return (
    <div className="min-h-screen" aria-busy="true" aria-label="Carregando barbearia">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--background)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>

      <Skeleton className="h-48 w-full rounded-none sm:h-64" />

      <div className="mx-auto max-w-2xl px-4 pb-16">
        <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
          <Skeleton className="h-20 w-20 rounded-2xl border-4 border-background sm:h-24 sm:w-24" />
        </div>
        <Skeleton className="mt-4 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-6 flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mt-8 h-12 w-full" />
      </div>
    </div>
  );
}
