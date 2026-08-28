import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCustomerAction } from "@/actions/customers";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CustomerForm } from "../../customer-form";
import { requireAdminContext } from "@/lib/require-admin";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const customer = await prisma.customer.findFirst({ where: { id, companyId: user.companyId } });
  if (!customer) notFound();

  const action = updateCustomerAction.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Editar cliente</h1>
      <Card>
        <CardHeader />
        <CardContent>
          <CustomerForm
            action={action}
            defaults={{
              fullName: customer.fullName,
              whatsapp: customer.whatsapp,
              email: customer.email ?? undefined,
              birthDate: customer.birthDate ? customer.birthDate.toISOString().slice(0, 10) : undefined,
              notes: customer.notes ?? undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
