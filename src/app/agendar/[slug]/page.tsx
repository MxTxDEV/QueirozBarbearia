import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Scissors, Users, Clock, CalendarPlus } from "lucide-react";
import { resolvePublicCompany } from "@/lib/data/public-companies";
import { CompanyUnavailable } from "@/components/company-unavailable";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolution = await resolvePublicCompany(slug);
  if (resolution.kind === "not_found") return { title: "Barbearia não encontrada" };

  const name = resolution.kind === "available" ? resolution.company.name : resolution.name;
  const title = `Agende seu horário | ${name}`;
  const description = `Agende seu horário na ${name} de forma rápida e online.`;
  const logo = resolution.kind === "available" ? resolution.company.logoUrl : null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: logo ? [{ url: logo }] : undefined,
    },
  };
}

export default async function CompanyBookingLandingPage({ params }: Props) {
  const { slug } = await params;
  const resolution = await resolvePublicCompany(slug);

  if (resolution.kind === "not_found") notFound();
  if (resolution.kind === "unavailable") {
    return <CompanyUnavailable name={resolution.name} status={resolution.reason} />;
  }

  const { company } = resolution;
  const location = [company.neighborhood, company.city, company.state].filter(Boolean).join(", ");
  const mapsUrl =
    company.latitude != null && company.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${company.latitude},${company.longitude}`
      : location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([company.address, location].filter(Boolean).join(", "))}`
        : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--background)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <Link href="/agendar" className="text-sm text-foreground-muted hover:text-foreground">
          ← Todas as barbearias
        </Link>
        <ThemeToggle />
      </header>

      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-secondary-dark/40 to-accent-dark/30 sm:h-64">
        {company.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.coverImageUrl} alt="" className="h-full w-full object-cover" />
        )}

        {/* Logo 100% dentro da capa (nunca sobra pra fora). */}
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-white p-2 shadow-lg sm:h-24 sm:w-24">
            <CompanyLogo logoUrl={company.logoUrl} name={company.name} height={56} className="max-w-[76px] text-neutral-900" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{company.name}</h1>
          <Badge variant={company.isOpenNow ? "success" : "muted"}>
            {company.isOpenNow ? "Aberta agora" : "Fechada agora"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-foreground-muted">Agende seu horário de forma rápida e online.</p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground-muted">
          {location &&
            (mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground hover:underline">
                <MapPin className="h-4 w-4 shrink-0" /> {location}
              </a>
            ) : (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" /> {location}
              </span>
            ))}
          <span className="flex items-center gap-1.5">
            <Scissors className="h-4 w-4 shrink-0" /> {company.serviceCount} serviço{company.serviceCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 shrink-0" /> {company.barberCount} profissiona{company.barberCount === 1 ? "l" : "is"}
          </span>
          {company.todayHoursLabel && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" /> Hoje: {company.todayHoursLabel}
            </span>
          )}
        </div>

        <Link href={`/portal/${company.slug}/login`} className="mt-8 block">
          <Button size="lg" className="w-full">
            <CalendarPlus className="h-5 w-5" /> Agendar horário
          </Button>
        </Link>
      </div>
    </div>
  );
}
