import { shopNow } from "@/lib/shop-time";
import "server-only";
import { prisma } from "@/lib/prisma";
import type { AppointmentStatus, Prisma } from "@prisma/client";

export type AppointmentRangeFilter = "today" | "tomorrow" | "week" | "month" | "all";

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function rangeToDates(range: AppointmentRangeFilter): { from?: Date; to?: Date } {
  const today = dateOnlyUTC(shopNow());
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
    include: { customer: true, barber: true, services: true, payments: true, recurringOccurrence: true },
    // range: "all" não tem filtro de data (from/to indefinidos acima) — sem
    // teto isso é uma query sem limite numa empresa antiga. Stopgap até a
    // tela ganhar paginação de verdade; os demais ranges já são limitados por data.
    ...(!from && !to ? { take: 1000 } : {}),
  });
}

/**
 * Agendamentos dentro de um intervalo explícito de datas — usado pela visão
 * de calendário, que navega por semanas/dias/meses arbitrários em vez dos
 * atalhos relativos de `rangeToDates`. Aplica os mesmos filtros da lista.
 */
export async function listAppointmentsInRange(
  companyId: string,
  params: {
    from: Date;
    to: Date;
    barberId?: string;
    status?: AppointmentStatus;
    customerQuery?: string;
  }
) {
  const where: Prisma.AppointmentWhereInput = {
    companyId,
    appointmentDate: { gte: params.from, lt: params.to },
    ...(params.barberId ? { barberId: params.barberId } : {}),
    // Agendamento cancelado libera o horário e some do calendário (continua na
    // Lista, como histórico). Só aparece aqui se alguém filtrar explicitamente por "Cancelado".
    status: params.status ?? { not: "CANCELLED" },
    ...(params.customerQuery
      ? { customer: { fullName: { contains: params.customerQuery, mode: "insensitive" } } }
      : {}),
  };

  return prisma.appointment.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: { customer: true, barber: true, services: true, payments: true, recurringOccurrence: true },
  });
}

export async function getAppointmentDetail(id: string, companyId: string) {
  return prisma.appointment.findFirst({
    where: { id, companyId },
    include: { customer: true, barber: true, services: true, payments: true, recurringOccurrence: true },
  });
}

export type DayCount = { count: number; hasPending: boolean };

/**
 * Quantos agendamentos ativos há em cada dia do período (e se algum ainda
 * aguarda confirmação) — alimenta os pontinhos do mini calendário lateral.
 * Respeita o filtro de barbeiro; cancelados e faltas não contam.
 */
export async function getAppointmentDayCounts(
  companyId: string,
  params: { from: Date; to: Date; barberId?: string }
): Promise<Record<string, DayCount>> {
  const rows = await prisma.appointment.findMany({
    where: {
      companyId,
      appointmentDate: { gte: params.from, lt: params.to },
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      ...(params.barberId ? { barberId: params.barberId } : {}),
    },
    select: { appointmentDate: true, status: true },
  });

  const counts: Record<string, DayCount> = {};
  for (const row of rows) {
    const key = row.appointmentDate.toISOString().slice(0, 10);
    const entry = counts[key] ?? { count: 0, hasPending: false };
    entry.count += 1;
    if (row.status === "PENDING") entry.hasPending = true;
    counts[key] = entry;
  }
  return counts;
}
