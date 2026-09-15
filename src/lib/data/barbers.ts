import "server-only";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/lib/availability-helpers";

export async function listBarbers(companyId: string) {
  return prisma.barber.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { workingHours: { orderBy: { weekday: "asc" } }, services: { include: { service: true } } },
  });
}

export async function getBarberDetail(id: string, companyId: string) {
  return prisma.barber.findFirst({
    where: { id, companyId },
    include: {
      workingHours: { orderBy: { weekday: "asc" } },
      timeOffs: { orderBy: { startDate: "desc" } },
      services: { include: { service: true } },
      // Só bloqueios de hoje em diante — os passados não importam mais pra
      // gestão da agenda (histórico fica preservado no banco/auditoria).
      blocks: { where: { date: { gte: dateOnly(new Date()) } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] },
    },
  });
}

export async function listActiveBarbersWithServices(companyId: string) {
  const barbers = await prisma.barber.findMany({
    where: { companyId, active: true },
    orderBy: { name: "asc" },
    include: { services: { include: { service: true } } },
  });

  return barbers.map((b) => ({
    ...b,
    services: b.services.filter((bs) => bs.service.active),
  }));
}
