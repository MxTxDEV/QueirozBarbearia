import "server-only";
import { prisma } from "@/lib/prisma";

export async function getCustomerNextAppointment(customerId: string) {
  return prisma.appointment.findFirst({
    where: {
      customerId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: "asc" },
    include: { barber: true, services: true },
  });
}

export async function listCustomerAppointments(customerId: string) {
  return prisma.appointment.findMany({
    where: { customerId },
    orderBy: { startTime: "desc" },
    include: { barber: true, services: true },
  });
}
