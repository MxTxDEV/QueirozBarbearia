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

export async function listCustomerAppointments(customerId: string, companyId: string) {
  return prisma.appointment.findMany({
    where: { customerId, companyId },
    orderBy: { startTime: "desc" },
    include: { barber: true, services: true },
  });
}
