import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PortalLoginForm } from "./portal-login-form";

export default async function PortalLoginPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/portal/dashboard");

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold text-foreground">Portal do cliente</h1>
        <p className="text-sm text-foreground-muted">Entre com seu WhatsApp para agendar seu horário.</p>
      </CardHeader>
      <CardContent>
        <PortalLoginForm />
      </CardContent>
    </Card>
  );
}
