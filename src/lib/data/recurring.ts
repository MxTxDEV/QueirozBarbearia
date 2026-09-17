import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, RecurringAppointmentStatus } from "@prisma/client";

export async function listRecurringAppointmentsForAdmin(
  companyId: string,
  filters: { status?: RecurringAppointmentStatus; barberId?: string }
) {
  const where: Prisma.RecurringAppointmentWhereInput = {
    companyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.barberId ? { barberId: filters.barberId } : {}),
  };

  return prisma.recurringAppointment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      barber: true,
      service: true,
      occurrences: {
        where: { status: { in: ["PENDING", "CONFIRMED", "WAITING_LIST"] } },
        orderBy: { scheduledDate: "asc" },
        take: 1,
      },
    },
  });
}

export async function getRecurringAppointmentDetail(id: string, companyId: string) {
  return prisma.recurringAppointment.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      barber: true,
      service: true,
      createdByUser: true,
      approvedByUser: true,
      occurrences: { orderBy: { occurrenceNumber: "asc" } },
    },
  });
}

export async function listRecurringAppointmentsForCustomer(customerId: string, companyId: string) {
  return prisma.recurringAppointment.findMany({
    where: { customerId, companyId },
    orderBy: { createdAt: "desc" },
    include: {
      barber: true,
      service: true,
      occurrences: {
        where: { status: { in: ["PENDING", "CONFIRMED", "WAITING_LIST"] } },
        orderBy: { scheduledDate: "asc" },
        take: 1,
      },
    },
  });
}

export async function getRecurringAppointmentForCustomer(id: string, companyId: string, customerId: string) {
  return prisma.recurringAppointment.findFirst({
    where: { id, companyId, customerId },
    include: {
      barber: true,
      service: true,
      occurrences: { orderBy: { occurrenceNumber: "asc" } },
    },
  });
}
