import "server-only";
import { prisma } from "@/lib/prisma";

export async function listBarbers() {
  return prisma.barber.findMany({
    orderBy: { name: "asc" },
    include: { workingHours: { orderBy: { weekday: "asc" } }, services: { include: { service: true } } },
  });
}

export async function getBarberDetail(id: string) {
  return prisma.barber.findUnique({
    where: { id },
    include: {
      workingHours: { orderBy: { weekday: "asc" } },
      timeOffs: { orderBy: { startDate: "desc" } },
      services: { include: { service: true } },
    },
  });
}

export async function listActiveBarbersWithServices() {
  const barbers = await prisma.barber.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { services: { include: { service: true } } },
  });

  return barbers.map((b) => ({
    ...b,
    services: b.services.filter((bs) => bs.service.active),
  }));
}
