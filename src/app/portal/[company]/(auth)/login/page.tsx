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
        {/* O nome da empresa já aparece em destaque no logo, logo acima
            deste card (ver layout) — repeti-lo aqui como título só duplicava
            a mesma informação duas vezes na mesma tela. */}
        <h1 className="text-lg font-semibold text-foreground">Vamos agendar seu horário?</h1>
        <p className="text-sm text-foreground-muted">
          Informe seu WhatsApp e enviamos um código de acesso na hora.
        </p>
      </CardHeader>
      <CardContent>
        <PortalLoginForm companySlug={slug} />
      </CardContent>
    </Card>
  );
}
