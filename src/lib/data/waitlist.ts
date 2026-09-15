import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, WaitlistStatus } from "@prisma/client";
import { rangeToDates, type AppointmentRangeFilter } from "@/lib/data/appointments";

export async function listWaitlistEntries(
  companyId: string,
  filters: {
    range?: AppointmentRangeFilter;
    barberId?: string;
    serviceId?: string;
    status?: WaitlistStatus;
  }
) {
  const { from, to } = rangeToDates(filters.range ?? "all");

  const where: Prisma.WaitlistEntryWhereInput = {
    companyId,
    ...(from && to ? { date: { gte: from, lt: to } } : {}),
    ...(filters.barberId ? { barberId: filters.barberId } : {}),
    ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  return prisma.waitlistEntry.findMany({
    where,
    orderBy: [{ date: "asc" }, { preferredTime: "asc" }, { createdAt: "asc" }],
    include: { customer: true, service: true, barber: true, offeredBarber: true },
    take: 500,
  });
}

/** Entradas ativas (aguardando ou com oferta) de um cliente — usado na área "minha lista de espera" do portal. */
export async function listActiveWaitlistEntriesForCustomer(companyId: string, customerId: string) {
  return prisma.waitlistEntry.findMany({
    where: { companyId, customerId, status: { in: ["WAITING", "OFFERED"] } },
    orderBy: [{ date: "asc" }, { preferredTime: "asc" }],
    include: { service: true, barber: true, offeredBarber: true },
  });
}
