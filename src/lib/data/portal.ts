import { shopNow } from "@/lib/shop-time";
import "server-only";
import { prisma } from "@/lib/prisma";

export async function getCustomerNextAppointment(customerId: string, companyId: string) {
  return prisma.appointment.findFirst({
    where: {
      customerId,
      companyId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startTime: { gte: shopNow() },
    },
    orderBy: { startTime: "asc" },
    include: { barber: true, services: true },
  });
}

/** Tudo que o cliente tem: horários avulsos e os que vêm de uma recorrência (com a descrição dela). */
const withDetails = {
  barber: true,
  services: true,
  recurringOccurrence: { include: { recurringAppointment: { select: { id: true, frequencyUnit: true, intervalValue: true, status: true } } } },
} as const;

export async function listCustomerAppointments(customerId: string, companyId: string) {
  return prisma.appointment.findMany({
    where: { customerId, companyId },
    orderBy: { startTime: "desc" },
    include: withDetails,
  });
}

/**
 * Agenda do cliente já separada: "próximos" (pendentes/confirmados que ainda vão acontecer, do mais
 * perto pro mais longe — avulsos e de recorrência juntos) e "histórico" (o resto, do mais recente pro mais antigo).
 */
export async function getCustomerAgenda(customerId: string, companyId: string) {
  const all = await listCustomerAppointments(customerId, companyId);
  const now = shopNow().getTime();
  const isUpcoming = (a: (typeof all)[number]) => (a.status === "PENDING" || a.status === "CONFIRMED") && a.startTime.getTime() >= now;
  const upcoming = all.filter(isUpcoming).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const history = all.filter((a) => !isUpcoming(a));
  return { upcoming, history };
}
