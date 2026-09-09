import Link from "next/link";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { listPublicCompanies } from "@/lib/data/public-companies";
import { EmptyState } from "@/components/ui/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { CompanyCard } from "./company-card";

export const metadata = {
  title: "Escolha uma barbearia | Agendamento online",
  description: "Encontre a barbearia ideal e agende seu horário em poucos cliques.",
};

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { companies, totalPages } = await listPublicCompanies(page);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--background)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <BrandLogo height={28} />
        <ThemeToggle />
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Escolha uma barbearia</h1>
          <p className="mt-2 text-sm text-foreground-muted sm:text-base">
            Encontre a barbearia ideal e agende seu horário.
          </p>
        </div>

        {companies.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Nenhuma barbearia disponível no momento"
            description="Volte em breve — novas barbearias aparecem aqui assim que habilitam o agendamento online."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginação">
                <Link
                  href={`/agendar?page=${page - 1}`}
                  aria-disabled={page <= 1}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-[var(--surface-subtle-hover)]"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <span className="px-3 text-sm text-foreground-muted">
                  Página {page} de {totalPages}
                </span>
                <Link
                  href={`/agendar?page=${page + 1}`}
                  aria-disabled={page >= totalPages}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-[var(--surface-subtle-hover)]"
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
