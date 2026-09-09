import Link from "next/link";
import { MapPin, Scissors, Clock } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicCompanyCard as PublicCompanyCardData } from "@/lib/data/public-companies";

export function CompanyCard({ company }: { company: PublicCompanyCardData }) {
  const location = [company.neighborhood, company.city].filter(Boolean).join(" — ") || company.state;

  return (
    <Link
      href={`/agendar/${company.slug}`}
      className="glass glass-hover group flex flex-col overflow-hidden rounded-3xl"
    >
      <div className="relative h-32 w-full shrink-0 overflow-hidden bg-gradient-to-br from-secondary-dark/40 to-accent-dark/30">
        {company.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[var(--duration-base)] group-hover:scale-105"
          />
        )}
        <div className="absolute left-3 top-3">
          <Badge variant={company.isOpenNow ? "success" : "muted"}>{company.isOpenNow ? "Aberta" : "Fechada"}</Badge>
        </div>
        <div className="absolute -bottom-6 left-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-background bg-[var(--background-elevated)] shadow-lg">
          <CompanyLogo logoUrl={company.logoUrl} name={company.name} height={36} className="max-w-[48px]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-8">
        <h3 className="truncate text-base font-semibold text-foreground">{company.name}</h3>

        {location && (
          <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <Scissors className="h-3.5 w-3.5 shrink-0" />
            {company.serviceCount} serviço{company.serviceCount === 1 ? "" : "s"}
          </span>
          {company.todayHoursLabel && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {company.todayHoursLabel}
            </span>
          )}
        </div>

        {/* Span estilizado, não <button> — o card inteiro já é um <Link>, e
            aninhar um <button> real dentro de <a> é HTML inválido. */}
        <span className={cn(buttonVariants({ size: "sm" }), "mt-2 w-full")}>Agendar horário</span>
      </div>
    </Link>
  );
}
