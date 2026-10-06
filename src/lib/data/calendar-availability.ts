import "server-only";
import { prisma } from "@/lib/prisma";
import { hhmmToMinutes, subtractIntervals, type Interval } from "@/lib/quick-slots";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

function minutesOfDay(d: Date) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

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
): Promise<Map<string, Interval[]>> {
  const result = new Map<string, Interval[]>();
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

  const busyByKey = new Map<string, Interval[]>();
  const addBusy = (barberId: string, day: string, start: Date, end: Date) => {
    const key = `${barberId}|${day}`;
    const list = busyByKey.get(key) ?? [];
    const endMinute = minutesOfDay(end);
    list.push({ start: minutesOfDay(start), end: endMinute === 0 ? 24 * 60 : endMinute });
    busyByKey.set(key, list);
  };
  for (const b of blocks) addBusy(b.barberId, isoDay(b.date), b.startTime, b.endTime);
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
      if (!wh) continue;
      const onTimeOff = timeOffs.some((t) => t.barberId === barberId && t.startDate <= day && t.endDate >= day);
      if (onTimeOff) continue;

      const busy = [...(busyByKey.get(`${barberId}|${dayKey}`) ?? [])];
      if (wh.breakStart && wh.breakEnd) busy.push({ start: hhmmToMinutes(wh.breakStart), end: hhmmToMinutes(wh.breakEnd) });

      result.set(
        `${barberId}|${dayKey}`,
        subtractIntervals([{ start: hhmmToMinutes(wh.startTime), end: hhmmToMinutes(wh.endTime) }], busy)
      );
    }
  }
  return result;
}
