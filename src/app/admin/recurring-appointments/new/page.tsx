import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { requireAdminContext } from "@/lib/require-admin";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { NewRecurringForm } from "./new-recurring-form";

export default async function NewRecurringAppointmentPage() {
  const user = await requireAdminContext();
  const [barbers, customers] = await Promise.all([
    prisma.barber.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: { name: "asc" },
      include: { services: { include: { service: true } } },
    }),
    prisma.customer.findMany({ where: { companyId: user.companyId }, orderBy: { fullName: "asc" } }),
  ]);

  const data = barbers.map((b) => ({
    id: b.id,
    name: b.name,
    services: b.services
      .filter((bs) => bs.service.active)
      .map((bs) => ({ id: bs.service.id, name: bs.service.name, durationMinutes: bs.service.durationMinutes, price: toNumber(bs.service.price) })),
  }));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Recorrências", href: "/admin/recurring-appointments" }, { label: "Nova" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nova recorrência</h1>
        <p className="text-sm text-foreground-muted">
          Criada pela equipe já entra ativa — as ocorrências são validadas e confirmadas na hora, sem etapa extra de aprovação.
        </p>
      </div>
      <NewRecurringForm barbers={data} customers={customers.map((c) => ({ id: c.id, fullName: c.fullName, whatsapp: c.whatsapp }))} />
    </div>
  );
}
