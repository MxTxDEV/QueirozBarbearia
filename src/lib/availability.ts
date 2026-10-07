import { shopNow } from "@/lib/shop-time";
import "server-only";
import { prisma } from "@/lib/prisma";
import { timeOnDate, dateOnly, overlaps, resolveBreak } from "@/lib/availability-helpers";
import { closuresFor } from "@/lib/day-marks";

export { timeOnDate, dateOnly, overlaps };

const SLOT_STEP_MINUTES = 15;

/** Minutos do dia → "HH:MM" (timeOnDate recebe texto). */
const minutesToHHMMLocal = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

export type TimeSlot = { start: Date; label: string };

/**
 * Subconjunto do client Prisma usado pelas checagens de conflito — aceita
 * tanto o client global quanto o `tx` de dentro de um `$transaction`, pra
 * que o mesmo código sirva de pré-checagem E de re-checagem atômica (ver
 * hasSchedulingConflict). Usado pelo motor de agendamento normal e pelo
 * motor da lista de espera (src/lib/waitlist.ts) — uma única regra de
 * disponibilidade para todo mundo.
 */
type ConflictCheckClient = Pick<
  typeof prisma,
  "appointment" | "barberBlock" | "waitlistEntry" | "barberWorkingHour" | "barberTimeOff" | "barberBreakOverride" | "barber" | "calendarDayMark"
>;

/** Marcas do dia (feriado/folga/fora de expediente) que valem para este barbeiro: o dia todo fechado e/ou janelas fechadas. */
async function dayClosures(client: ConflictCheckClient, barberId: string, day: Date) {
  const barber = await client.barber.findUnique({ where: { id: barberId }, select: { companyId: true } });
  if (!barber) return { wholeDay: null as string | null, windows: [] as { start: number; end: number; reason: string }[] };
  const marks = await client.calendarDayMark.findMany({
    where: { companyId: barber.companyId, date: day, OR: [{ barberId: null }, { barberId }] },
  });
  return closuresFor(marks, barberId);
}

/**
 * Calcula os horários disponíveis de um barbeiro em uma data, considerando:
 * horário de trabalho, intervalo de almoço, folgas/férias (dia inteiro),
 * bloqueios pontuais (BarberBlock, janela específica do dia), agendamentos
 * existentes (ativos), reservas temporárias (HOLD) ativas da lista de
 * espera e a duração total dos serviços selecionados.
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

  // Feriado / folga / fora de expediente marcado na agenda: o dia inteiro fechado, ou só uma janela.
  const marked = await dayClosures(prisma, params.barberId, day);
  if (marked.wholeDay) return [];

  const dayStart = timeOnDate(day, workingHour.startTime);
  const dayEnd = timeOnDate(day, workingHour.endTime);
  // Intervalo do dia: a exceção daquela data (arrastada no calendário) vence o padrão da semana.
  const breakOverride = await prisma.barberBreakOverride.findUnique({
    where: { barberId_date: { barberId: params.barberId, date: day } },
  });
  const dayBreak = resolveBreak(workingHour, breakOverride);
  const breakStart = dayBreak ? timeOnDate(day, dayBreak.start) : null;
  const breakEnd = dayBreak ? timeOnDate(day, dayBreak.end) : null;

  // Horários são guardados como relógio de parede em UTC: compara com o relógio da barbearia, não o do servidor.
  const now = shopNow();

  const [existingAppointments, blocks, activeHolds] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        barberId: params.barberId,
        appointmentDate: day,
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { startTime: true, endTime: true },
    }),
    // Bloqueio flexível (janela específica do dia) — não é folga, convive
    // com o horário de trabalho normal no mesmo dia.
    prisma.barberBlock.findMany({
      where: { barberId: params.barberId, date: day },
      select: { startTime: true, endTime: true },
    }),
    // HOLD da lista de espera: uma oferta OFFERED com prazo ainda não
    // vencido ocupa o horário do mesmo jeito que um Appointment ativo —
    // ver src/lib/waitlist.ts. holdExpiresAt > now também serve de
    // reconhecimento "ao vivo" de expiração: mesmo antes do cron rodar,
    // uma oferta vencida já para de contar aqui.
    prisma.waitlistEntry.findMany({
      where: { offeredBarberId: params.barberId, status: "OFFERED", holdExpiresAt: { gt: now } },
      select: { offeredStartTime: true, offeredEndTime: true },
    }),
  ]);

  const markedWindows = marked.windows.map((w) => ({ start: timeOnDate(day, minutesToHHMMLocal(w.start)), end: timeOnDate(day, minutesToHHMMLocal(w.end)) }));

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

    if (markedWindows.some((w) => overlaps(candidate, candidateEnd, w.start, w.end))) continue;

    // Duração inteira do serviço tem que caber fora do bloqueio — não só o
    // instante inicial (ex: bloqueio 18:30-20:00 barra um corte de 60min
    // que começaria às 18:00, mesmo com 18:00 "livre" isoladamente).
    const blocked = blocks.some((b) => overlaps(candidate, candidateEnd, b.startTime, b.endTime));
    if (blocked) continue;

    const conflicts = existingAppointments.some((appt) =>
      overlaps(candidate, candidateEnd, appt.startTime, appt.endTime)
    );
    if (conflicts) continue;

    const held = activeHolds.some(
      (h) => h.offeredStartTime && h.offeredEndTime && overlaps(candidate, candidateEnd, h.offeredStartTime, h.offeredEndTime)
    );
    if (held) continue;

    slots.push({
      start: candidate,
      label: candidate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
    });
  }

  return slots;
}

/**
 * Reverifica se um intervalo [startTime, endTime) está livre pra um
 * barbeiro — considerando bloqueios, agendamentos ativos e HOLDs ativos da
 * lista de espera. Usado tanto na pré-checagem quanto dentro da transação
 * Serializable de criação (passando `tx` em `client`), e também pelo motor
 * da lista de espera ao tentar oferecer/confirmar uma vaga — mesma regra
 * de disponibilidade em todos os pontos de escrita do sistema.
 */
export async function hasSchedulingConflict(
  params: {
    barberId: string;
    startTime: Date;
    endTime: Date;
    /** Um ou mais agendamentos a ignorar (a troca de horários ignora os DOIS que estão sendo trocados). */
    excludeAppointmentId?: string | string[];
    excludeWaitlistEntryId?: string;
  },
  client: ConflictCheckClient = prisma
): Promise<boolean> {
  const day = dateOnly(params.startTime);
  const excludedAppointmentIds = [params.excludeAppointmentId ?? []].flat();

  // Fora do horário de funcionamento (dia sem expediente cadastrado, ou
  // início/fim do serviço que não cabe inteiro dentro do expediente/almoço)
  // ou dia de folga/férias — mesma regra usada por getAvailableSlots, aqui
  // reaplicada porque este é o único ponto de escrita real (chamado dentro
  // da transação Serializable) e não pode confiar cegamente em o candidato
  // ter vindo do seletor de horários da UI (ex: ocorrências de recorrência,
  // que calculam o horário a partir da regra da série, não do seletor).
  const weekday = day.getUTCDay();
  const workingHour = await client.barberWorkingHour.findUnique({
    where: { barberId_weekday: { barberId: params.barberId, weekday } },
  });
  if (!workingHour) return true;

  const dayStart = timeOnDate(day, workingHour.startTime);
  const dayEnd = timeOnDate(day, workingHour.endTime);
  if (params.startTime < dayStart || params.endTime > dayEnd) return true;

  const breakOverride = await client.barberBreakOverride.findUnique({
    where: { barberId_date: { barberId: params.barberId, date: day } },
  });
  const dayBreak = resolveBreak(workingHour, breakOverride);
  if (dayBreak) {
    const breakStart = timeOnDate(day, dayBreak.start);
    const breakEnd = timeOnDate(day, dayBreak.end);
    if (overlaps(params.startTime, params.endTime, breakStart, breakEnd)) return true;
  }

  const timeOff = await client.barberTimeOff.findFirst({
    where: { barberId: params.barberId, startDate: { lte: day }, endDate: { gte: day } },
  });
  if (timeOff) return true;

  // Feriado / folga / fora de expediente marcado na agenda.
  const marked = await dayClosures(client, params.barberId, day);
  if (marked.wholeDay) return true;
  for (const window of marked.windows) {
    if (overlaps(params.startTime, params.endTime, timeOnDate(day, minutesToHHMMLocal(window.start)), timeOnDate(day, minutesToHHMMLocal(window.end)))) return true;
  }

  const blocking = await client.barberBlock.findFirst({
    where: {
      barberId: params.barberId,
      date: day,
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
    },
  });
  if (blocking) return true;

  const conflictingAppointment = await client.appointment.findFirst({
    where: {
      barberId: params.barberId,
      appointmentDate: day,
      status: { in: [...ACTIVE_STATUSES] },
      id: excludedAppointmentIds.length > 0 ? { notIn: excludedAppointmentIds } : undefined,
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
    },
  });
  if (conflictingAppointment) return true;

  const conflictingHold = await client.waitlistEntry.findFirst({
    where: {
      offeredBarberId: params.barberId,
      status: "OFFERED",
      holdExpiresAt: { gt: new Date() },
      id: params.excludeWaitlistEntryId ? { not: params.excludeWaitlistEntryId } : undefined,
      offeredStartTime: { lt: params.endTime },
      offeredEndTime: { gt: params.startTime },
    },
  });
  return !!conflictingHold;
}
