import "server-only";
import { prisma } from "@/lib/prisma";
import { buildClosedSegments, hhmmToMinutes, subtractIntervals, type ClosedSegment, type Interval } from "@/lib/quick-slots";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

function minutesOfDay(d: Date) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type DayAvailability = {
  /** Janelas em que dá pra agendar (expediente − almoço − folga − bloqueios − agendamentos − HOLDs). */
  open: Interval[];
  /** Trechos em que o barbeiro não atende (fora do expediente, almoço, folga, bloqueio) — o calendário tranca. */
  closed: ClosedSegment[];
};

/**
 * Janelas livres (em minutos do dia) de cada barbeiro em cada dia do período,
 * pra desenhar os botões de agendamento rápido no calendário. Mesmas fontes de
 * indisponibilidade de getAvailableSlots/hasSchedulingConflict: expediente,
 * almoço, folga/férias, bloqueios pontuais, agendamentos ativos e HOLDs. Só
 * orienta a UI — a decisão que vale continua sendo a do motor ao criar.
 *
 * Chave do mapa: `${barberId}|${YYYY-MM-DD}`. Uma consulta por fonte pro
 * período inteiro (nada de consulta por dia/barbeiro).
 */
export async function getOpenIntervals(
  companyId: string,
  barberIds: string[],
  from: Date,
  to: Date
): Promise<Map<string, DayAvailability>> {
  const result = new Map<string, DayAvailability>();
  if (barberIds.length === 0) return result;

  const [workingHours, timeOffs, blocks, appointments, holds] = await Promise.all([
    prisma.barberWorkingHour.findMany({ where: { barberId: { in: barberIds }, barber: { companyId } } }),
    prisma.barberTimeOff.findMany({
      where: { barberId: { in: barberIds }, barber: { companyId }, startDate: { lt: to }, endDate: { gte: from } },
    }),
    prisma.barberBlock.findMany({ where: { companyId, barberId: { in: barberIds }, date: { gte: from, lt: to } } }),
    prisma.appointment.findMany({
      where: { companyId, barberId: { in: barberIds }, appointmentDate: { gte: from, lt: to }, status: { in: [...ACTIVE_STATUSES] } },
      select: { barberId: true, appointmentDate: true, startTime: true, endTime: true },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        companyId,
        offeredBarberId: { in: barberIds },
        status: "OFFERED",
        holdExpiresAt: { gt: new Date() },
        offeredStartTime: { gte: from, lt: to },
      },
      select: { offeredBarberId: true, offeredStartTime: true, offeredEndTime: true },
    }),
  ]);

  const blocksByKey = new Map<string, (Interval & { reason: string | null })[]>();
  for (const b of blocks) {
    const key = `${b.barberId}|${isoDay(b.date)}`;
    const endMinute = minutesOfDay(b.endTime);
    const list = blocksByKey.get(key) ?? [];
    list.push({ start: minutesOfDay(b.startTime), end: endMinute === 0 ? 24 * 60 : endMinute, reason: b.reason });
    blocksByKey.set(key, list);
  }

  const busyByKey = new Map<string, Interval[]>();
  const addBusy = (barberId: string, day: string, start: Date, end: Date) => {
    const key = `${barberId}|${day}`;
    const list = busyByKey.get(key) ?? [];
    const endMinute = minutesOfDay(end);
    list.push({ start: minutesOfDay(start), end: endMinute === 0 ? 24 * 60 : endMinute });
    busyByKey.set(key, list);
  };
  for (const a of appointments) addBusy(a.barberId, isoDay(a.appointmentDate), a.startTime, a.endTime);
  for (const h of holds) {
    if (h.offeredBarberId && h.offeredStartTime && h.offeredEndTime) {
      addBusy(h.offeredBarberId, isoDay(h.offeredStartTime), h.offeredStartTime, h.offeredEndTime);
    }
  }

  const hoursByBarberWeekday = new Map(workingHours.map((w) => [`${w.barberId}|${w.weekday}`, w]));

  for (let day = new Date(from); day < to; day = new Date(day.getTime() + 86_400_000)) {
    const dayKey = isoDay(day);
    for (const barberId of barberIds) {
      const wh = hoursByBarberWeekday.get(`${barberId}|${day.getUTCDay()}`);
      const onTimeOff = timeOffs.some((t) => t.barberId === barberId && t.startDate <= day && t.endDate >= day);
      const working = wh ? { start: hhmmToMinutes(wh.startTime), end: hhmmToMinutes(wh.endTime) } : null;
      const breakInterval = wh?.breakStart && wh?.breakEnd ? { start: hhmmToMinutes(wh.breakStart), end: hhmmToMinutes(wh.breakEnd) } : null;
      const dayBlocks = blocksByKey.get(`${barberId}|${dayKey}`) ?? [];

      const closed = buildClosedSegments({ working, timeOff: onTimeOff, breakInterval, blocks: dayBlocks });
      const open =
        !working || onTimeOff
          ? []
          : subtractIntervals([working], [...(busyByKey.get(`${barberId}|${dayKey}`) ?? []), ...closed]);

      result.set(`${barberId}|${dayKey}`, { open, closed });
    }
  }
  return result;
}
