import "server-only";
import { prisma } from "@/lib/prisma";
import type { AppointmentStatus, Prisma } from "@prisma/client";

export type AppointmentRangeFilter = "today" | "tomorrow" | "week" | "month" | "all";

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function rangeToDates(range: AppointmentRangeFilter): { from?: Date; to?: Date } {
  const today = dateOnlyUTC(new Date());
  if (range === "today") {
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() + 1);
    return { from: today, to };
  }
  if (range === "tomorrow") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() + 1);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    return { from, to };
  }
  if (range === "week") {
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from: today, to };
  }
  if (range === "month") {
    const to = new Date(today);
    to.setUTCMonth(to.getUTCMonth() + 1);
    return { from: today, to };
  }
  return {};
}

export async function listAppointments(
  companyId: string,
  filters: {
    range?: AppointmentRangeFilter;
    barberId?: string;
    status?: AppointmentStatus;
    customerQuery?: string;
  }
) {
  const { from, to } = rangeToDates(filters.range ?? "all");

  const where: Prisma.AppointmentWhereInput = {
    companyId,
    ...(from && to ? { appointmentDate: { gte: from, lt: to } } : {}),
    ...(filters.barberId ? { barberId: filters.barberId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.customerQuery
      ? { customer: { fullName: { contains: filters.customerQuery, mode: "insensitive" } } }
      : {}),
  };

  return prisma.appointment.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: { customer: true, barber: true, services: true, payments: true },
  });
}

export async function getAppointmentDetail(id: string, companyId: string) {
  return prisma.appointment.findFirst({
    where: { id, companyId },
    include: { customer: true, barber: true, services: true, payments: true },
  });
}
