import Link from "next/link";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";
import { listPublicCompanies } from "@/lib/data/public-companies";
import { EmptyState } from "@/components/ui/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { CompanyCard } from "./company-card";
import { AgendarFilters } from "./agendar-filters";

export const metadata = {
  title: "Escolha uma barbearia | Agendamento online",
  description: "Encontre a barbearia ideal e agende seu horário em poucos cliques.",
};

type SearchParams = { page?: string; q?: string; maxPrice?: string; lat?: string; lng?: string };

export default async function AgendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const query = sp.q?.trim() || undefined;
  const maxPrice = sp.maxPrice ? Number(sp.maxPrice) : undefined;
  const lat = sp.lat ? Number(sp.lat) : undefined;
  const lng = sp.lng ? Number(sp.lng) : undefined;
  const near = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  const { companies, totalPages } = await listPublicCompanies({
    page,
    query,
    maxPrice: maxPrice != null && Number.isFinite(maxPrice) ? maxPrice : undefined,
    near,
  });

  // Preserva os filtros atuais ao trocar de página.
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (maxPrice != null) params.set("maxPrice", String(maxPrice));
    if (near) {
      params.set("lat", String(near.lat));
      params.set("lng", String(near.lng));
    }
    params.set("page", String(targetPage));
    return `/agendar?${params.toString()}`;
  };

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

        <AgendarFilters />

        {companies.length === 0 ? (
          <EmptyState
            icon={Store}
            title={query || maxPrice != null ? "Nenhuma barbearia encontrada" : "Nenhuma barbearia disponível no momento"}
            description={
              query || maxPrice != null
                ? "Tente ajustar a busca ou o filtro de preço."
                : "Volte em breve — novas barbearias aparecem aqui assim que habilitam o agendamento online."
            }
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
                  href={pageHref(page - 1)}
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
                  href={pageHref(page + 1)}
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
