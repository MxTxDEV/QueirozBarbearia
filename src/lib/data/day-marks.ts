import { shopNow } from "@/lib/shop-time";
import "server-only";
import { prisma } from "@/lib/prisma";

export type DayMarkRow = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  kind: string;
  barberId: string | null;
  barberName: string | null;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
};

const toRow = (m: {
  id: string;
  date: Date;
  kind: string;
  barberId: string | null;
  barber: { name: string } | null;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
}): DayMarkRow => ({
  id: m.id,
  date: m.date.toISOString().slice(0, 10),
  kind: m.kind,
  barberId: m.barberId,
  barberName: m.barber?.name ?? null,
  title: m.title,
  startTime: m.startTime,
  endTime: m.endTime,
});

/** Marcas no intervalo [from, to) (datas), já serializáveis pra ir pra tela. */
export async function listDayMarksInRange(companyId: string, from: Date, to: Date): Promise<DayMarkRow[]> {
  const marks = await prisma.calendarDayMark.findMany({
    where: { companyId, date: { gte: from, lt: to } },
    include: { barber: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { kind: "asc" }],
  });
  return marks.map(toRow);
}

/** Próximas marcas (de hoje em diante) pra lista da tela de marcação. */
export async function listUpcomingDayMarks(companyId: string, limit = 60): Promise<DayMarkRow[]> {
  const now = shopNow();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const marks = await prisma.calendarDayMark.findMany({
    where: { companyId, date: { gte: today } },
    include: { barber: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { kind: "asc" }],
    take: limit,
  });
  return marks.map(toRow);
}
