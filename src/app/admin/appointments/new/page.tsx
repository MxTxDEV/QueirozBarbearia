import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { AdminBookingForm } from "./admin-booking-form";
import { requireAdminContext } from "@/lib/require-admin";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; barberId?: string }>;
}) {
  const user = await requireAdminContext();
  const sp = await searchParams;
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

  // Valores vindos da URL (clique num horário livre do calendário) — só
  // aceitos se tiverem o formato esperado / pertencerem a um barbeiro ativo
  // desta empresa; qualquer outra coisa é ignorada.
  const prefill = {
    date: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined,
    time: sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : undefined,
    barberId: sp.barberId && data.some((b) => b.id === sp.barberId) ? sp.barberId : undefined,
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Agendamentos", href: "/admin/appointments" }, { label: "Novo" }]} />
      <h1 className="text-2xl font-semibold text-foreground">Novo agendamento</h1>
      <AdminBookingForm
        barbers={data}
        customers={customers.map((c) => ({ id: c.id, fullName: c.fullName, whatsapp: c.whatsapp }))}
        prefill={prefill}
      />
    </div>
  );
}
