import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { AdminBookingForm } from "./admin-booking-form";
import { requireAdminContext } from "@/lib/require-admin";

export default async function NewAppointmentPage() {
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
      .map((bs) => ({
        id: bs.service.id,
        name: bs.service.name,
        price: toNumber(bs.service.price),
        durationMinutes: bs.service.durationMinutes,
      })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Novo agendamento</h1>
      <AdminBookingForm
        barbers={data}
        customers={customers.map((c) => ({ id: c.id, fullName: c.fullName, whatsapp: c.whatsapp }))}
      />
    </div>
  );
}
