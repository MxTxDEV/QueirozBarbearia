import { redirect } from "next/navigation";
import { resolvePortalCompany } from "@/lib/require-customer";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PortalLoginForm } from "./portal-login-form";

export default async function PortalLoginPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const company = await resolvePortalCompany(slug);

  const customer = await getCurrentCustomer();
  if (customer && customer.companyId === company.id) redirect(`/portal/${slug}/dashboard`);

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold text-foreground">{company.name}</h1>
        <p className="text-sm text-foreground-muted">Entre com seu WhatsApp para agendar seu horário.</p>
      </CardHeader>
      <CardContent>
        <PortalLoginForm companySlug={slug} />
      </CardContent>
    </Card>
  );
}
