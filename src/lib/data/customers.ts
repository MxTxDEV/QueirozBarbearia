import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

export async function listCustomers(search?: string) {
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { whatsapp: { contains: search.replace(/\D/g, "") } },
          ],
        }
      : undefined,
    orderBy: { fullName: "asc" },
    include: { _count: { select: { appointments: true } } },
  });
  return customers;
}

export async function getCustomerProfile(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { appointmentDate: "desc" },
        include: { barber: true, services: true },
      },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!customer) return null;

  const totalPaid = customer.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const completedAppointments = customer.appointments.filter((a) => a.status === "COMPLETED");
  const visits = completedAppointments.length;
  const clv = totalPaid;
  const avgTicket = visits > 0 ? totalPaid / visits : 0;
  const lastVisit = completedAppointments[0]?.appointmentDate ?? null;

  const barberCounts = new Map<string, { name: string; count: number }>();
  const serviceCounts = new Map<string, { name: string; count: number }>();
  for (const appt of completedAppointments) {
    const b = barberCounts.get(appt.barberId) ?? { name: appt.barber.name, count: 0 };
    b.count++;
    barberCounts.set(appt.barberId, b);
    for (const s of appt.services) {
      const svc = serviceCounts.get(s.serviceId) ?? { name: s.serviceName, count: 0 };
      svc.count++;
      serviceCounts.set(s.serviceId, svc);
    }
  }
  const preferredBarber = [...barberCounts.values()].sort((a, b) => b.count - a.count)[0]?.name ?? null;
  const topServices = [...serviceCounts.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  return {
    customer,
    clv,
    avgTicket,
    visits,
    lastVisit,
    preferredBarber,
    topServices,
  };
}

export async function findCustomerByWhatsapp(whatsapp: string) {
  return prisma.customer.findUnique({ where: { whatsapp } });
}
