import { getCurrentCustomer } from "@/lib/customer-auth";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const customer = await getCurrentCustomer();

  // As rotas de login ficam em /portal/(auth) e não usam este shell.
  if (!customer) return children;

  return <PortalShell customerName={customer.fullName}>{children}</PortalShell>;
}
