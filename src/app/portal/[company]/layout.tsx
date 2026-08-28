import { resolvePortalCompany } from "@/lib/require-customer";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { CompanyUnavailable } from "@/components/company-unavailable";

export default async function PortalCompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const company = await resolvePortalCompany(slug);

  if (company.status !== "ACTIVE") {
    return <CompanyUnavailable name={company.name} status={company.status} />;
  }

  const customer = await getCurrentCustomer();

  // As rotas de login ficam em /portal/[company]/(auth) e não usam este shell.
  // Também não usa o shell se a sessão for de outra empresa — as próprias
  // páginas (via requireCustomerContext) cuidam do redirect para o login
  // correto nesse caso.
  if (!customer || customer.companyId !== company.id) return children;

  return (
    <PortalShell
      customerName={customer.fullName}
      companySlug={slug}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
    >
      {children}
    </PortalShell>
  );
}
