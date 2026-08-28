import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateServiceAction } from "@/actions/services";
import { toNumber } from "@/lib/serialize";
import { Card, CardContent } from "@/components/ui/card";
import { ServiceForm } from "../../service-form";
import { requireAdminContext } from "@/lib/require-admin";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const service = await prisma.service.findFirst({ where: { id, companyId: user.companyId } });
  if (!service) notFound();

  const action = updateServiceAction.bind(null, id);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Editar serviço</h1>
      <Card>
        <CardContent>
          <ServiceForm
            action={action}
            defaults={{
              name: service.name,
              description: service.description ?? undefined,
              price: toNumber(service.price),
              durationMinutes: service.durationMinutes,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
