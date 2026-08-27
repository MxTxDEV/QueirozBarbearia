import "server-only";
import { prisma } from "@/lib/prisma";

const SLOT_STEP_MINUTES = 15;
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

/** Constrói um Date em UTC para uma data (Y-M-D) e horário "HH:mm" — evita bugs de fuso horário do servidor. */
export function timeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m, 0, 0));
}

export function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export type TimeSlot = { start: Date; label: string };

/**
 * Calcula os horários disponíveis de um barbeiro em uma data, considerando:
 * horário de trabalho, intervalo de almoço, folgas/férias, agendamentos
 * existentes (ativos) e a duração total dos serviços selecionados.
 */
export async function getAvailableSlots(params: {
  barberId: string;
  date: Date;
  totalDurationMinutes: number;
}): Promise<TimeSlot[]> {
  const day = dateOnly(params.date);
  const weekday = day.getUTCDay();

  const workingHour = await prisma.barberWorkingHour.findUnique({
    where: { barberId_weekday: { barberId: params.barberId, weekday } },
  });
  if (!workingHour) return [];

  const timeOffs = await prisma.barberTimeOff.findMany({
    where: {
      barberId: params.barberId,
      startDate: { lte: day },
      endDate: { gte: day },
    },
  });
  if (timeOffs.length > 0) return [];

  const dayStart = timeOnDate(day, workingHour.startTime);
  const dayEnd = timeOnDate(day, workingHour.endTime);
  const breakStart = workingHour.breakStart ? timeOnDate(day, workingHour.breakStart) : null;
  const breakEnd = workingHour.breakEnd ? timeOnDate(day, workingHour.breakEnd) : null;

  const nextDay = new Date(day);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      barberId: params.barberId,
      appointmentDate: day,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { startTime: true, endTime: true },
  });

  const now = new Date();
  const slots: TimeSlot[] = [];
  const durationMs = params.totalDurationMinutes * 60_000;

  for (
    let candidate = new Date(dayStart);
    candidate.getTime() + durationMs <= dayEnd.getTime();
    candidate = new Date(candidate.getTime() + SLOT_STEP_MINUTES * 60_000)
  ) {
    const candidateEnd = new Date(candidate.getTime() + durationMs);

    if (candidate < now) continue;

    if (breakStart && breakEnd && overlaps(candidate, candidateEnd, breakStart, breakEnd)) continue;

    const conflicts = existingAppointments.some((appt) =>
      overlaps(candidate, candidateEnd, appt.startTime, appt.endTime)
    );
    if (conflicts) continue;

    slots.push({
      start: candidate,
      label: candidate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
    });
  }

  return slots;
}

/** Reverifica no servidor, dentro da transação de criação, se o horário ainda está livre (Regra 1). */
export async function hasSchedulingConflict(params: {
  barberId: string;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const day = dateOnly(params.startTime);
  const conflicting = await prisma.appointment.findFirst({
    where: {
      barberId: params.barberId,
      appointmentDate: day,
      status: { in: [...ACTIVE_STATUSES] },
      id: params.excludeAppointmentId ? { not: params.excludeAppointmentId } : undefined,
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
    },
  });
  return !!conflicting;
}
